import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSync, FaCheckCircle, FaClock, FaTimes, FaPaperPlane } from 'react-icons/fa';
import { 
  fetchTemplates, 
  createTemplate, 
  updateTemplate, 
  deleteTemplate,
  submitTemplateToMeta,
  syncTemplatesFromMeta,
  getTemplateCategories 
} from '../lib/api';

const TemplateManager = () => {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    language: 'en',
    category: 'MARKETING',
    components: [{
      type: 'BODY',
      text: ''
    }]
  });

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, [selectedStatus, searchTerm]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStatus) params.status = selectedStatus;
      if (searchTerm) params.search = searchTerm;
      
      const response = await fetchTemplates(params);
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await getTemplateCategories();
      setCategories(response.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await syncTemplatesFromMeta();
      loadTemplates();
      alert('Templates synced successfully!');
    } catch (error) {
      console.error('Error syncing templates:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingTemplate) {
        await updateTemplate(editingTemplate._id, formData);
      } else {
        await createTemplate(formData);
      }
      
      setShowForm(false);
      setEditingTemplate(null);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToMeta = async (templateId) => {
    if (window.confirm('Submit this template to Meta for approval?')) {
      try {
        await submitTemplateToMeta(templateId);
        loadTemplates();
        alert('Template submitted for approval!');
      } catch (error) {
        console.error('Error submitting template:', error);
        alert(`Error: ${error.message}`);
      }
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      language: template.language || 'en',
      category: template.category,
      components: template.components || [{ type: 'BODY', text: '' }]
    });
    setShowForm(true);
  };

  const handleDelete = async (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplate(templateId);
        loadTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
        alert(`Error: ${error.message}`);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      language: 'en',
      category: 'MARKETING',
      components: [{
        type: 'BODY',
        text: ''
      }]
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: { color: 'bg-gray-100 text-gray-800', icon: FaClock },
      PENDING: { color: 'bg-yellow-100 text-yellow-800', icon: FaClock },
      APPROVED: { color: 'bg-green-100 text-green-800', icon: FaCheckCircle },
      REJECTED: { color: 'bg-red-100 text-red-800', icon: FaTimes },
      PAUSED: { color: 'bg-orange-100 text-orange-800', icon: FaClock },
      DISABLED: { color: 'bg-gray-100 text-gray-600', icon: FaTimes }
    };
    
    const badge = badges[status] || badges.DRAFT;
    const Icon = badge.icon;
    
    return (
      <span className={`px-2 py-1 ${badge.color} text-xs rounded flex items-center gap-1`}>
        <Icon className="text-xs" />
        {status || 'DRAFT'}
      </span>
    );
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Message Templates</h2>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:bg-gray-400"
            >
              <FaSync className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync from Meta
            </button>
            <button
              onClick={() => {
                setEditingTemplate(null);
                resetForm();
                setShowForm(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <FaPlus className="mr-2" />
              Create Template
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg flex-1"
          />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Template Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="e.g., welcome_message"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and underscores only</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message Content
                </label>
                <textarea
                  value={formData.components[0]?.text || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    components: [{ type: 'BODY', text: e.target.value }]
                  }))}
                  rows={6}
                  placeholder="Enter your message template. Use {'{{1}}'} for variables."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <div className="mt-2 text-sm text-gray-600">
                  <p>Use {'{{1}}'}, {'{{2}}'}, etc. for placeholders</p>
                  <p className="text-xs mt-1">Example: Hello {'{{1}}'}, welcome to {'{{2}}'}!</p>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {loading ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No templates found. Create your first template!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div key={template._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    {getStatusBadge(template.status)}
                    <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">
                      {template.category}
                    </span>
                    <span className="text-xs text-gray-500">{template.language}</span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-2">
                    {template.components?.[0]?.text || 'No content'}
                  </p>
                  
                  {template.rejectionReason && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                      <p className="text-red-700 text-xs">
                        <strong>Rejected:</strong> {template.rejectionReason}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-4 text-xs text-gray-500">
                    {template.providerId && <span>ID: {template.providerId}</span>}
                    {template.qualityScore && <span>Quality: {template.qualityScore}</span>}
                    {template.approvedAt && (
                      <span>Approved: {new Date(template.approvedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {template.status === 'DRAFT' && (
                    <button
                      onClick={() => handleSubmitToMeta(template._id)}
                      className="p-2 text-blue-600 hover:text-blue-800"
                      title="Submit to Meta"
                    >
                      <FaPaperPlane />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-blue-600 hover:text-blue-800"
                    title="Edit template"
                    disabled={template.status !== 'DRAFT'}
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(template._id)}
                    className="p-2 text-red-600 hover:text-red-800"
                    title="Delete template"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateManager; 