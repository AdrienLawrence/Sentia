"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#080a0e] px-6 text-slate-100">
        <main className="w-full max-w-md rounded-xl border border-slate-700 bg-[#11151c] p-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-300">
            SENTIA
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            The error was recorded. You can safely try loading this screen again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
