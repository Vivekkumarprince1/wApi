'use client';

import { useState } from 'react';
import { FaStream, FaTrash } from 'react-icons/fa';

export default function EventsSettingsPage() {
  const [events] = useState([
    { id: 1, type: 'message.received', status: 'enabled', deliveries: 123 },
    { id: 2, type: 'message.read', status: 'enabled', deliveries: 89 },
    { id: 3, type: 'message.failed', status: 'disabled', deliveries: 5 },
  ]);

  return (
    <div className=" p-6">
      <div className="max-w-5xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
          <FaStream className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events & Webhooks</h1>
          <p className="text-sm text-muted-foreground">Configure event subscriptions and view logs</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto bg-card rounded-xl shadow-premium p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Subscribed Events</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">Event</th>
              <th className="py-2">Status</th>
              <th className="py-2">Deliveries</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map(ev => (
              <tr key={ev.id} className="text-foreground">
                <td className="py-3 font-mono">{ev.type}</td>
                <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs ${ev.status==='enabled'?'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':'bg-muted text-muted-foreground'}`}>{ev.status}</span></td>
                <td className="py-3">{ev.deliveries}</td>
                <td className="py-3"><button className="text-destructive hover:text-destructive/80"><FaTrash/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-4">TODO: Add event creation and webhook management</p>
      </div>
    </div>
  );
}
