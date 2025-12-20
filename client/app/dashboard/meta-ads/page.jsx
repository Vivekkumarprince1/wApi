'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function MetaAdsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white dark:from-gray-900 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Click to WhatsApp Ads</h1>
          <a
            href="https://www.facebook.com/business/help/208570955497175"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-teal-700 hover:text-teal-800 dark:text-teal-400"
          >
            Learn how
          </a>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Boost ROAS with Click-to-WhatsApp ads—set up in minutes, no Ads Manager needed.
        </p>
      </div>

      {/* Content */}
      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Steps */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step 1 */}
          <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Create/Connect your facebook page</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Create a new facebook page or connect an existing one</p>
              </div>
              <button className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm">Connect</button>
            </div>
          </div>
          {/* Step 2 */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Create/Connect your Meta Ads Manager account</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create a new Meta Ads Manager account or connect an existing one</p>
          </div>
          {/* Step 3 */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Create CTWA Ad Campaign</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Set live ads which direct to your WhatsApp chat</p>
            <div className="mt-3">
              <button
                onClick={() => router.push('/campaign/new?type=ctwa')}
                className="px-4 py-2 rounded bg-green-700 hover:bg-green-800 text-white text-sm"
              >
                + New Campaign
              </button>
            </div>
          </div>
        </div>

        {/* Video */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="aspect-video w-full rounded overflow-hidden">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="CTWA Ad Campaign Creation"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Introducing Interakt's Native Click to WhatsApp Ad Launcher</div>
        </div>
      </div>
    </div>
  );
}
