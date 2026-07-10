"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BottomCTA({ isDark }: { isDark: boolean }) {
  const router = useRouter();
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'ConnectSphere';

  return (
    <section className="w-full bg-[#f4ffe9] dark:bg-black py-8 sm:py-12 md:py-16 flex flex-col items-center" style={{ backgroundColor: isDark ? '#000' : '#f4ffe9' }}>
      <div className="text-center max-w-4xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4" style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}>
          Ready to <span className="text-primary">Transform</span> Your Business?
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground dark:text-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
          Join thousands of businesses already using {appName} to grow their customer engagement and drive conversions.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={() => {
              router.push('/auth/register');
            }}
            className="font-bold px-8 py-4 rounded-xl text-sm sm:text-base md:text-lg shadow-premium transition-all duration-500 transform bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] text-white hover:shadow-2xl hover:scale-105 hover:-translate-y-1"
          >
            Get Started With Free Trial
          </button>
          <Link
            href="/privacy"
            className="px-8 py-4 rounded-xl text-sm sm:text-base md:text-lg font-semibold border border-border text-foreground bg-white/80 dark:bg-gray-900/60 hover:border-gray-400 hover:shadow-md transition-all duration-300"
          >
            View Privacy Policy
          </Link>
        </div>
      </div>
    </section>
  );
}
