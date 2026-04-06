'use client';

import { useState, useEffect } from 'react';
import { get, post, put, del } from '@/lib/api';
import { toast } from '@/lib/toast';
import { FaPlus, FaReply, FaTrash, FaEdit, FaSearch, FaBolt } from 'react-icons/fa';

export default function QuickReplyManager() {
  const [quickReplies, setQuickReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReply, setEditingReply] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    shortcut: '',
    content: '',
    mediaUrl: '',
    mediaType: 'image'
  });

  useEffect(() => {
    fetchQuickReplies();
  }, []);

  const fetchQuickReplies = async () => {
    try {
      setLoading(true);
      const res = await get('/quick-replies');
      setQuickReplies(res.data || []);
    } catch (err) {
      toast.error('Failed to load quick replies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (reply = null) => {
    if (reply) {
      setEditingReply(reply);
      setFormData({
        name: reply.name,
        shortcut: reply.shortcut || '',
        content: reply.content,
        mediaUrl: reply.mediaUrl || '',
        mediaType: reply.mediaType || 'image'
      });
    } else {
      setEditingReply(null);
      setFormData({
        name: '',
        shortcut: '',
        content: '',
        mediaUrl: '',
        mediaType: 'image'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingReply) {
        await put(`/quick-replies/${editingReply._id}`, formData);
        toast.success('Quick reply updated');
      } else {
        await post('/quick-replies', formData);
        toast.success('Quick reply created');
      }
      setIsModalOpen(false);
      fetchQuickReplies();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this quick reply?')) return;
    try {
      await del(`/quick-replies/${id}`);
      toast.success('Deleted successfully');
      fetchQuickReplies();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const filteredReplies = quickReplies.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.shortcut?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quick Replies</h1>
          <p className="text-gray-500 text-sm">Manage canned responses for your Shared Team Inbox.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <FaPlus size={14} />
          <span>New Quick Reply</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1 group">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            <input 
              type="text"
              placeholder="Search by name or shortcut (e.g. /greeting)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-green-500/20 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider bg-gray-50/50">
                <th className="px-6 py-4 font-semibold">Name & Shortcut</th>
                <th className="px-6 py-4 font-semibold">Content Preview</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="3" className="px-6 py-12 text-center text-gray-400">Loading replies...</td></tr>
              ) : filteredReplies.length === 0 ? (
                <tr><td colSpan="3" className="px-6 py-12 text-center text-gray-400">No quick replies found.</td></tr>
              ) : (
                filteredReplies.map(reply => (
                  <tr key={reply._id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-700">{reply.name}</div>
                      {reply.shortcut && (
                        <div className="text-xs text-green-600 font-mono mt-0.5">{reply.shortcut}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-500 line-clamp-1 max-w-sm">
                        {reply.content}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(reply)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(reply._id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FaBolt className="text-green-600" />
                {editingReply ? 'Edit Quick Reply' : 'New Quick Reply'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FaPlus className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Internal Name</label>
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Welcome Message"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Shortcut (Optional)</label>
                  <input 
                    type="text"
                    value={formData.shortcut}
                    onChange={(e) => setFormData({...formData, shortcut: e.target.value})}
                    placeholder="e.g. /hi"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Message Content</label>
                <textarea 
                  required
                  rows="4"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Type your canned response here..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm resize-none"
                ></textarea>
                <p className="mt-1.5 text-[10px] text-gray-400">Pro-tip: Use variables like {"{{name}}"} for personalization.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  {editingReply ? 'Save Changes' : 'Create Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
