"use client";

import React from 'react';
import { ExternalLink, Phone, MessageSquare } from 'lucide-react';
import type { CarouselCard } from './carousel-card-editor';

/**
 * WhatsApp-style carousel preview — shows cards in a horizontally scrollable
 * format that mimics the actual WhatsApp carousel message rendering.
 */

interface CarouselPreviewProps {
  bodyText: string;
  footerText?: string;
  cards: CarouselCard[];
}

export default function CarouselPreview({ bodyText, footerText, cards }: CarouselPreviewProps) {
  return (
    <div className="space-y-2">
      {/* Main message bubble */}
      <div className="bg-white dark:bg-[#202c33] rounded-lg shadow-sm max-w-[90%] float-left">
        <div className="p-3 space-y-1.5">
          <p className="text-[13px] text-slate-800 dark:text-slate-100 leading-relaxed font-medium whitespace-pre-wrap break-words">
            {bodyText || 'Your carousel message body will appear here...'}
          </p>
          {footerText && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{footerText}</p>
          )}
        </div>
      </div>

      {/* Carousel cards */}
      <div className="clear-both" />
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none -mx-1 px-1">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className="snap-start shrink-0 w-[200px] bg-white dark:bg-[#202c33] rounded-xl shadow-sm overflow-hidden border border-slate-200/50 dark:border-white/5"
          >
            {/* Card media */}
            <div className="aspect-[4/3] bg-slate-200 dark:bg-white/5 flex items-center justify-center overflow-hidden">
              {card.mediaUrl ? (
                card.headerFormat === 'IMAGE' ? (
                  <img src={card.mediaUrl} alt={`Card ${idx + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <video src={card.mediaUrl} className="w-full h-full object-cover" muted />
                )
              ) : (
                <div className="flex flex-col items-center gap-1 opacity-30">
                  <div className="h-8 w-8 rounded-full bg-slate-300 dark:bg-white/10" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    {card.headerFormat}
                  </span>
                </div>
              )}
            </div>

            {/* Card body */}
            <div className="p-2.5">
              <p className="text-[11px] text-slate-800 dark:text-slate-100 leading-snug font-medium line-clamp-3">
                {card.bodyText || `Card ${idx + 1} body text`}
              </p>
            </div>

            {/* Card buttons */}
            {card.buttons.length > 0 && (
              <div className="border-t border-slate-100 dark:border-white/5">
                {card.buttons.map((btn, btnIdx) => (
                  <div
                    key={btnIdx}
                    className="py-2 px-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#00a884] border-b last:border-b-0 border-slate-100/80 dark:border-white/5"
                  >
                    {btn.type === 'URL' && <ExternalLink className="h-2.5 w-2.5" />}
                    {btn.type === 'PHONE_NUMBER' && <Phone className="h-2.5 w-2.5" />}
                    {btn.type === 'QUICK_REPLY' && <MessageSquare className="h-2.5 w-2.5" />}
                    <span className="truncate">{btn.text || 'Button'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Visual hint for more cards */}
        {cards.length > 2 && (
          <div className="snap-start shrink-0 w-[40px] flex items-center justify-center">
            <div className="text-muted-foreground opacity-20 text-2xl font-black">›</div>
          </div>
        )}
      </div>
    </div>
  );
}
