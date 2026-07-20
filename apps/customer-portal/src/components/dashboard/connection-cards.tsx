"use client";

import React from 'react';
import { MessageCircle } from 'lucide-react';

interface ConnectionCardsProps {
  isWhatsAppConnected: boolean;
  workspace: any;
  onConnectWhatsApp: () => void;
}

const ConnectionCards = ({ isWhatsAppConnected, workspace, onConnectWhatsApp }: ConnectionCardsProps) => {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="group bg-card rounded-2xl p-5 border border-border/50 hover:shadow-premium transition-all duration-300 hover:border-emerald-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <MessageCircle className="text-white h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground mb-1">WhatsApp Business</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {isWhatsAppConnected
                ? (workspace?.phoneNumber ? `Connected: ${workspace.phoneNumber}` : 'Your number is connected')
                : 'Connect your number to start'}
            </p>
            <button
              onClick={() => !isWhatsAppConnected && onConnectWhatsApp()}
              disabled={isWhatsAppConnected}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${isWhatsAppConnected
                ? 'bg-primary/10 text-primary cursor-default'
                : 'bg-primary hover:brightness-110 text-primary-foreground hover:shadow-lg'
                }`}
            >
              {isWhatsAppConnected ? 'Connected' : 'Connect Now'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ConnectionCards;
