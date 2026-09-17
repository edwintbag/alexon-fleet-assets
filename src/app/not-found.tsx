import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/dashboard" className="text-navy underline">Back to dashboard</Link>
    </main>
  );
}
