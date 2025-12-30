"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BusinessInfoPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding/esb");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center space-y-3">
        <p className="text-sm text-slate-600">Business info collection is handled in Embedded Signup.</p>
        <p className="text-base font-semibold text-slate-900">Redirecting to ESB...</p>
      </div>
    </div>
  );
}
