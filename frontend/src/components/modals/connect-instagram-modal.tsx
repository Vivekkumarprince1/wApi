'use client';

import React from 'react';
import { X, Camera, Link2, Zap } from 'lucide-react';

interface ConnectInstagramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConnectInstagramModal = ({ isOpen, onClose }: ConnectInstagramModalProps) => {
  if (!isOpen) return null;

  const handleGoToInstagram = () => {
    window.open('https://www.instagram.com/accounts/login/', '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-premium max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-end p-4">
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {/* Icons */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                <Zap className="h-10 w-10 text-emerald-600" />
              </div>

              <div className="text-muted-foreground">
                <Link2 className="h-8 w-8" />
              </div>

              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg">
                <Camera className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-xl font-bold text-foreground text-center mb-6">
            Connect Instagram Business
          </h2>

          <div className="flex items-start space-x-3 mb-6 bg-muted/30 rounded-xl p-4">
            <div className="flex-shrink-0 mt-1">
              <Camera className="h-6 w-6 text-pink-500" />
            </div>
            <div>
              <p className="text-sm text-foreground leading-relaxed">
                Log in with Instagram and set your permissions. Once that's done, you're all set to connect to our platform!
              </p>
            </div>
          </div>

          <button
            onClick={handleGoToInstagram}
            className="w-full bg-primary hover:brightness-110 text-primary-foreground px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg"
          >
            Go to Instagram
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectInstagramModal;
