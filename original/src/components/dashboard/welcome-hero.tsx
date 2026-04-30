"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, Rocket } from 'lucide-react';

interface WelcomeHeroProps {
  currentTime: Date;
  greeting: string;
  userName: string;
  showTrial: boolean;
  trialDaysLeft: number | null;
}

const WelcomeHero = ({ currentTime, greeting, userName, showTrial, trialDaysLeft }: WelcomeHeroProps) => {
  const router = useRouter();

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-primary via-[#0fb07e] to-primary/80 rounded-2xl mb-8 shadow-premium">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />

      <div className="relative py-8 sm:py-10 px-6 sm:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">{greeting}, {userName}! 👋</h1>
            {showTrial ? (
              <p className="text-white/90 text-sm sm:text-base">You have <span className="font-bold bg-white/20 px-2 py-0.5 rounded">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</span> left in your trial</p>
            ) : (
              <p className="text-white/90 text-sm sm:text-base">Your WhatsApp engagement hub is ready. Let&apos;s crush it today! 🚀</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {showTrial && trialDaysLeft !== null && (
              <div className="hidden sm:block bg-white/15 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/20">
                <div className="text-white/70 text-xs font-medium mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Trial Ends In</div>
                <div className="text-white text-2xl font-bold">{trialDaysLeft} <span className="text-sm font-normal">Days</span></div>
              </div>
            )}
            <button onClick={() => router.push('/dashboard/campaign')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl font-semibold transition-all border border-white/30 flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105">
              <Rocket className="h-4 w-4" /> New Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeHero;
