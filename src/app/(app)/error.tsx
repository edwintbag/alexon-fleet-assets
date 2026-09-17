"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-medium text-red-800">Something went wrong loading this page.</p>
      <p className="mt-1 text-sm text-red-700">Check your connection and try again.</p>
      <button onClick={reset} className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200">Try again</button>
    </div>
  );
}
