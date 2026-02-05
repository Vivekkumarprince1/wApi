'use client';

import { FaShoppingCart, FaSearch, FaFilter, FaEye, FaCheck, FaTruck, FaSpinner } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { get, put } from '@/lib/api';
import { toast } from 'react-toastify';
import FeatureGate from '@/components/FeatureGate';

function OrderPanelContent(){
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const data = await get(`/checkout-bot/orders${params.toString() ? '?' + params : ''}`);
      setOrders(data.orders || data || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
      toast?.error?.('Failed to load orders') || alert('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await put(`/checkout-bot/orders/${orderId}/status`, { status: newStatus });
      setOrders(prev => prev.map(o => 
        (o._id || o.id) === orderId ? { ...o, status: newStatus } : o
      ));
      toast?.success?.(`Order updated to ${newStatus}`) || alert(`✅ Order updated to ${newStatus}`);
    } catch (err) {
      toast?.error?.(err.message || 'Failed to update order') || alert(err.message);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-700',
      'processing': 'bg-blue-100 text-blue-700',
      'shipped': 'bg-purple-100 text-purple-700',
      'delivered': 'bg-green-100 text-green-700',
      'cancelled': 'bg-red-100 text-red-700',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const filteredOrders = searchQuery 
    ? orders.filter(o => 
        o.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : orders;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <FaSpinner className="animate-spin text-3xl text-[#13C18D]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <FaShoppingCart className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Order Panel</h1>
                <p className="text-white/90 text-sm mt-1">Manage all your WhatsApp Commerce orders</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Orders</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] bg-clip-text text-transparent">{orders.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-500">{orders.filter(o => o.status?.toLowerCase() === 'pending').length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Shipped</p>
            <p className="text-3xl font-bold text-purple-500">{orders.filter(o => o.status?.toLowerCase() === 'shipped').length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Delivered</p>
            <p className="text-3xl font-bold text-green-500">{orders.filter(o => o.status?.toLowerCase() === 'delivered').length}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders by ID or customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#13C18D]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No orders found.</p>
              </div>
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOrders.map((order) => (
                  <tr key={order._id || order.id || order.orderId} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{order.orderId || order._id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{order.contact?.name || order.customer || 'Unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{order.items?.length || order.itemCount || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">₹{order.total || order.totalAmount || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(order.status)}`}>
                        {order.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : order.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-[#13C18D] hover:text-[#0e8c6c] mr-3" title="View Details">
                        <FaEye />
                      </button>
                      {order.status?.toLowerCase() === 'pending' && (
                        <button 
                          onClick={() => updateOrderStatus(order._id || order.id, 'processing')}
                          className="text-blue-500 hover:text-blue-700 mr-3" 
                          title="Mark as Processing"
                        >
                          <FaCheck />
                        </button>
                      )}
                      {order.status?.toLowerCase() === 'processing' && (
                        <button 
                          onClick={() => updateOrderStatus(order._id || order.id, 'shipped')}
                          className="text-purple-500 hover:text-purple-700" 
                          title="Ship Order"
                        >
                          <FaTruck />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderPanelPage() {
  return (
    <FeatureGate feature="products">
      <OrderPanelContent />
    </FeatureGate>
  );
}
