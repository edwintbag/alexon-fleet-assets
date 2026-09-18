import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.isActive) return new NextResponse("Unauthorised", { status: 401 });
  const { id } = await params;
  const supabase = await createClient();
  const { data: file } = await supabase.from("asset_files").select("file_path").eq("id", id).maybeSingle();
  if (!file?.file_path) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from("asset-files").createSignedUrl(file.file_path, 300);
  if (error || !data) return new NextResponse("File unavailable", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
