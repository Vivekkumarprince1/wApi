'use client';

import { useState, useEffect } from 'react';
import { FaWhatsapp, FaClock, FaCheckCircle, FaSpinner, FaTimes } from 'react-icons/fa';
import { get, put } from '@/lib/api';

export default function WhatsAppSetupRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const endpoint = filter === 'all' 
        ? '/admin/whatsapp-setup-requests'
        : `/admin/whatsapp-setup-requests?status=${filter}`;
      
      const data = await get(endpoint);
      if (data.success) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (workspaceId, status, notes = '') => {
    try {
      setUpdating(true);
      
      const data = await put(`/admin/whatsapp-setup-requests/${workspaceId}`, { status, notes });
      if (data.success) {
        await loadRequests();
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: FaClock },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', icon: FaSpinner },
      connected: { bg: 'bg-green-100', text: 'text-green-800', icon: FaCheckCircle },
      failed: { bg: 'bg-red-100', text: 'text-red-800', icon: FaTimes }
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        <Icon className={status === 'in_progress' ? 'animate-spin' : ''} />
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            WhatsApp Number Activation Requests
          </h1>
          <p className="text-gray-600">
            Activate customer WhatsApp numbers on the platform
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {['all', 'pending', 'in_progress', 'connected', 'failed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-12">
            <FaSpinner className="animate-spin text-4xl text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FaWhatsapp className="text-6xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No requests found</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <div key={request.workspaceId} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {request.workspaceName}
                    </h3>
                    {request.owner && (
                      <div className="text-sm text-gray-600">
                        <p>{request.owner.name} • {request.owner.email}</p>
                        {request.owner.phone && <p>{request.owner.phone}</p>}
                      </div>
                    )}
                  </div>
                  {getStatusBadge(request.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-500">WhatsApp Number:</span>
                    <p className="font-medium text-gray-900">{request.whatsappNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Has Existing Account:</span>
                    <p className="font-medium text-gray-900">
                      {request.hasExistingAccount ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Requested:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(request.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  {request.completedAt && (
                    <div>
                      <span className="text-gray-500">Completed:</span>
                      <p className="font-medium text-gray-900">
                        {new Date(request.completedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {request.notes && (
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-500">Notes:</span>
                    <p className="text-sm text-gray-700">{request.notes}</p>
                  </div>
                )}

                {request.status !== 'connected' && (
                  <div className="flex gap-2">
                    {request.status === 'pending' && (
                      <button
                        onClick={() => updateRequestStatus(request.workspaceId, 'in_progress')}
                        disabled={updating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
                      >
                        Start Working
                      </button>
                    )}
                    {(request.status === 'pending' || request.status === 'in_progress') && (
                      <>
                        <button
                          onClick={() => setSelectedRequest(request)}
                          disabled={updating}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                        >
                          Mark as Connected
                        </button>
                        <button
                          onClick={() => updateRequestStatus(request.workspaceId, 'failed', 'Unable to connect')}
                          disabled={updating}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
                        >
                          Mark as Failed
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Connection Details Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">
                Mark as Connected
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                WhatsApp setup for {selectedRequest.workspaceName} has been completed.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateRequestStatus(selectedRequest.workspaceId, 'connected')}
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {updating ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
