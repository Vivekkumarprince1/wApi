'use client';

import { useState, useEffect } from 'react';
import { FaWhatsapp, FaInstagram, FaRegCommentDots } from 'react-icons/fa';
import { Smartphone, Mail, MessageSquare } from 'lucide-react';
import { get } from '@/lib/api';

export default function ChannelsSettingsPage() {
  const [channels, setChannels] = useState([
    { id: 'whatsapp', name: 'WhatsApp', icon: <FaWhatsapp/>, status: 'connected', description: 'Primary messaging channel' },
    { id: 'instagram', name: 'Instagram', icon: <FaInstagram/>, status: 'not-connected', description: 'Social media messaging' },
  ]);

  useEffect(() => {
    // checkChannelStatus();
  }, []);

  const checkChannelStatus = async () => {
    // ... remains for other channels if needed, but for now we only have whatsapp/instagram
  };

  return (
    <div className=" p-6 animate-fade-in">
      <div className="max-w-5xl mx-auto mb-8">
        <h1 className="text-2xl font-bold text-foreground">Message Channels</h1>
        <p className="text-sm text-muted-foreground">Manage multi-channel delivery and brand identity.</p>
      </div>

      <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map(ch => (
          <div key={ch.id} className="bg-card border border-border rounded-2xl shadow-premium p-6 hover:shadow-hover transition-all group">
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                ch.status === 'connected' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {ch.icon}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                ch.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {ch.status.replace('-', ' ')}
              </span>
            </div>
            
            <div className="mt-4">
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{ch.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{ch.description}</p>
            </div>

            <div className="mt-6 flex gap-2">
              <a 
                href={
                  ch.id === 'whatsapp' ? '/dashboard/settings/whatsapp-profile' : '#'
                } 
                className="flex-1 text-center py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                {ch.status === 'connected' ? 'Configure' : 'Connect'}
              </a>
              <button className="px-4 py-2 text-xs font-bold rounded-lg border border-border text-foreground hover:bg-accent transition-colors">
                Docs
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
