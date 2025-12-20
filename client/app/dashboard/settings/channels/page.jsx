'use client';

import { useState } from 'react';
import { FaWhatsapp, FaInstagram, FaToggleOn } from 'react-icons/fa';

export default function ChannelsSettingsPage() {
  const [channels, setChannels] = useState([
    { id: 'whatsapp', name: 'WhatsApp', icon: <FaWhatsapp/>, status: 'connected' },
    { id: 'instagram', name: 'Instagram', icon: <FaInstagram/>, status: 'not-connected' },
    { id: 'rcs', name: 'RCS (Coming Soon)', icon: <FaToggleOn/>, status: 'disabled' },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Channels</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Connect messaging channels</p>
      </div>

      <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-6">
        {channels.map(ch => (
          <div key={ch.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl text-green-600">
                {ch.icon}
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{ch.name}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{ch.status.replace('-', ' ')}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <a href={ch.id==='whatsapp'?'/dashboard/settings/whatsapp-profile':'#'} className="px-3 py-2 text-sm rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">{ch.status==='connected'?'Manage':'Connect'}</a>
              <button className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300" disabled>Docs</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
