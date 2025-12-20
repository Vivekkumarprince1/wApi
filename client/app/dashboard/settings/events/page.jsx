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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
          <FaStream className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events & Webhooks</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Configure event subscriptions and view logs</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subscribed Events</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 dark:text-gray-300">
              <th className="py-2">Event</th>
              <th className="py-2">Status</th>
              <th className="py-2">Deliveries</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {events.map(ev => (
              <tr key={ev.id} className="text-gray-800 dark:text-gray-100">
                <td className="py-3 font-mono">{ev.type}</td>
                <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs ${ev.status==='enabled'?'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300':'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>{ev.status}</span></td>
                <td className="py-3">{ev.deliveries}</td>
                <td className="py-3"><button className="text-red-500 hover:text-red-700"><FaTrash/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">TODO: Add event creation and webhook management</p>
      </div>
    </div>
  );
}
