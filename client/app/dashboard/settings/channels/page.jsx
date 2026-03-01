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
    <div className=" p-6">
      <div className="max-w-5xl mx-auto mb-6">
        <h1 className="text-2xl font-bold text-foreground">Channels</h1>
        <p className="text-sm text-muted-foreground">Connect messaging channels</p>
      </div>

      <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-6">
        {channels.map(ch => (
          <div key={ch.id} className="bg-card rounded-xl shadow-premium p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl text-primary">
                {ch.icon}
              </div>
              <div>
                <h3 className="font-medium text-foreground">{ch.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{ch.status.replace('-', ' ')}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <a href={ch.id==='whatsapp'?'/dashboard/settings/whatsapp-profile':'#'} className="px-3 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{ch.status==='connected'?'Manage':'Connect'}</a>
              <button className="px-3 py-2 text-sm rounded border border-border text-foreground" disabled>Docs</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
