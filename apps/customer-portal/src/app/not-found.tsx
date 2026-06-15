"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        The page you tried to open doesn't exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
