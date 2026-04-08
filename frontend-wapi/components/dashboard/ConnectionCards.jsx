import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';

const ConnectionCards = ({ isWhatsAppConnected, workspace, onConnectWhatsApp, onConnectInstagram }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="group bg-card rounded-2xl p-5 border border-border/50 hover:shadow-premium transition-all duration-300 hover:border-emerald-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <FaWhatsapp className="text-white text-xl" />
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

      <div className="group bg-card rounded-2xl p-5 border border-border/50 hover:shadow-premium transition-all duration-300 hover:border-pink-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground mb-1">Instagram Business</h3>
            <p className="text-xs text-muted-foreground mb-3">Expand your reach</p>
            <button onClick={onConnectInstagram}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg">
              Connect Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionCards;
