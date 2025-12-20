'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTemplates, getTemplateCategories, getTemplateLibraryStats, deleteTemplate, syncTemplatesFromMeta, submitTemplateToMeta, getTemplateLibrary, copyFromTemplateLibrary, createTemplate } from '../../../lib/api';
import CreateTemplateModal from '../../../components/CreateTemplateModal.jsx';
import UseTemplateModal from '../../../components/UseTemplateModal.jsx';
import EditTemplateModal from '../../../components/EditTemplateModal.jsx';

const TemplatesDashboard = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('library');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [metaLibraryCategory, setMetaLibraryCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ANY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copying, setCopying] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [useTemplateModal, setUseTemplateModal] = useState({ isOpen: false, template: null });
  const [editTemplateModal, setEditTemplateModal] = useState({ isOpen: false, template: null });
  
  // Data from backend
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTemplates, setActiveTemplates] = useState([]);
  const [deletedTemplates, setDeletedTemplates] = useState([]);
  const [libraryStats, setLibraryStats] = useState(null);
  
  // Meta Template Library (pre-made templates)
  const [metaLibraryTemplates, setMetaLibraryTemplates] = useState([]);
  const [metaLibraryStats, setMetaLibraryStats] = useState({});
  const [loadingMetaLibrary, setLoadingMetaLibrary] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Load Meta Library templates when tab changes
  useEffect(() => {
    if (activeTab === 'meta-library') {
      loadMetaLibrary();
    }
  }, [activeTab, metaLibraryCategory]);

  const loadMetaLibrary = async () => {
    try {
      setLoadingMetaLibrary(true);
      const category = metaLibraryCategory === 'all' ? null : metaLibraryCategory;
      const data = await getTemplateLibrary(category);
      setMetaLibraryTemplates(data.templates || []);
      setMetaLibraryStats(data.categories || {});
    } catch (err) {
      console.error('Error loading Meta Library:', err);
    } finally {
      setLoadingMetaLibrary(false);
    }
  };

  const handleCopyFromLibrary = async (template) => {
    // Open edit modal instead of directly copying
    setEditTemplateModal({ isOpen: true, template });
  };

  // Handle template submission from edit modal
  const handleEditTemplateSubmit = async (templateData) => {
    try {
      setCopying(templateData.name);
      
      // Create template via API with the edited data
      const result = await copyFromTemplateLibrary(
        editTemplateModal.template?.name || templateData.name,
        templateData.name, // Use the (possibly edited) name
        templateData.language,
        templateData.category,
        {
          headerText: templateData.headerText,
          bodyText: templateData.bodyText,
          footerText: templateData.footerText,
          buttonLabels: templateData.buttonLabels,
          variables: templateData.variables,
          variableSamples: templateData.variableSamples
        }
      );
      
      alert(`✅ Template "${templateData.name}" created and submitted to Meta for approval!`);
      loadData(); // Reload to show new template
      setEditTemplateModal({ isOpen: false, template: null });
    } catch (err) {
      throw new Error(err.message || 'Failed to create template');
    } finally {
      setCopying(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch templates, categories, and stats
      const [templatesData, categoriesData, statsData] = await Promise.all([
        fetchTemplates(),
        getTemplateCategories(),
        getTemplateLibraryStats().catch(() => null) // Don't fail if stats endpoint not available
      ]);

      // Store library stats
      if (statsData) {
        setLibraryStats(statsData);
      }

      // Process templates
      if (templatesData && templatesData.templates) {
        const allTemplates = templatesData.templates;
        
        // Separate templates by status
        const approved = allTemplates.filter(t => t.status === 'APPROVED');
        const deleted = allTemplates.filter(t => t.status === 'DELETED');
        
        setTemplates(allTemplates);
        setActiveTemplates(approved);
        setDeletedTemplates(deleted);
      }

      // Process categories
      if (categoriesData && categoriesData.categories) {
        const allCategories = [
          { id: 'ALL', label: 'ALL', count: 'All templates' },
          ...categoriesData.categories.map(cat => ({
            id: cat.name || cat._id || cat.id || 'UNKNOWN',
            label: (cat.name || cat._id || cat.id || 'UNKNOWN').replace(/_/g, ' '),
            count: `${cat.count || 0} template${cat.count !== 1 ? 's' : ''}`
          }))
        ];
        setCategories(allCategories);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await deleteTemplate(templateId);
      loadData(); // Reload data after deletion
    } catch (err) {
      alert(err.message || 'Failed to delete template');
    }
  };

  const handleSyncTemplates = async () => {
    try {
      setSyncing(true);
      const result = await syncTemplatesFromMeta();
      alert(`✅ Templates synced successfully!\n\n📊 Summary:\n• Total synced: ${result.syncedCount || 0}\n• New templates: ${result.newCount || 0}\n• Updated: ${result.updatedCount || 0}`);
      loadData(); // Reload data after sync
    } catch (err) {
      alert('❌ ' + (err.message || 'Failed to sync templates'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmitTemplate = async (templateId) => {
    if (!confirm('Submit this template to Meta for approval? This will change the status to PENDING.')) return;
    
    try {
      setSubmitting(true);
      await submitTemplateToMeta(templateId);
      alert('Template submitted to Meta for approval! Status: PENDING. Check back in 24-48 hours.');
      loadData(); // Reload data after submission
    } catch (err) {
      alert(err.message || 'Failed to submit template');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter templates for library view
  const libraryTemplates = templates.filter(t => {
    if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Filter active templates
  const filteredActiveTemplates = activeTemplates.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'ANY' && t.status !== statusFilter) return false;
    return true;
  });

  // Filter deleted templates
  const filteredDeletedTemplates = deletedTemplates.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'ANY' && t.status !== statusFilter) return false;
    return true;
  });

  const getTemplateBodyText = (template) => {
    // Check for body in components first
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      return bodyComponent.text;
    }
    // Fall back to direct body property
    return template.body || template.content || 'No content available';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-500';
      case 'PENDING': return 'bg-yellow-500';
      case 'REJECTED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 mb-4">⚠️ {error}</div>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Library Stats Banner */}
      {libraryStats && (
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-3 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📚</span>
                <div>
                  <span className="text-lg font-bold">{libraryStats.total || 0}</span>
                  <span className="text-sm ml-1 opacity-90">Total Templates</span>
                </div>
              </div>
              <div className="h-8 w-px bg-white/30"></div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  {libraryStats.byStatus?.APPROVED || 0} Approved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  {libraryStats.byStatus?.PENDING || 0} Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  {libraryStats.byStatus?.DRAFT || 0} Draft
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  {libraryStats.byStatus?.REJECTED || 0} Rejected
                </span>
              </div>
            </div>
            {libraryStats.lastSyncedAt && (
              <div className="text-xs opacity-75">
                Last synced: {new Date(libraryStats.lastSyncedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Template Library</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Sync and manage WhatsApp message templates from Meta</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleSyncTemplates}
              disabled={syncing}
              className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Sync from Meta</span>
                </>
              )}
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <span>+ Create New</span>
            </button>
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('library')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'library'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            My Templates
          </button>
          <button
            onClick={() => setActiveTab('meta-library')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'meta-library'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <span>📚</span> Meta Template Library
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'active'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab('deleted')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'deleted'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Deleted
          </button>
        </div>
      </div>

      {/* Conditional Content Based on Active Tab */}
      {activeTab === 'library' && (
        <>
          {/* Category Filter */}
          <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex flex-col items-start px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors border ${
                    selectedCategory === category.id
                      ? 'bg-gray-50 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                      : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-750'
                  }`}
                >
                  <span className="font-semibold text-gray-900 dark:text-white">{category.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{category.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {libraryTemplates.map((template) => (
                <div
                  key={template._id}
                  className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 group relative"
                >
                  {/* Source Badge */}
                  {template.source === 'META' && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        Meta
                      </span>
                    </div>
                  )}
                  
                  {/* Template Content */}
                  <div className="p-4">
                    {/* Header Preview */}
                    {template.headerText && (
                      <div className="text-xs text-teal-600 dark:text-teal-400 font-medium mb-1 truncate">
                        📝 {template.headerText}
                      </div>
                    )}
                    
                    <h3 className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">
                      {template.name}
                    </h3>
                    
                    {/* Body Preview */}
                    <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 line-clamp-3">
                      {template.bodyText || getTemplateBodyText(template)}
                    </p>
                    
                    {/* Footer Preview */}
                    {template.footerText && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic truncate">
                        {template.footerText}
                      </p>
                    )}
                    
                    {/* Buttons Preview */}
                    {template.buttonLabels?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.buttonLabels.slice(0, 2).map((label, i) => (
                          <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                            🔘 {label}
                          </span>
                        ))}
                        {template.buttonLabels.length > 2 && (
                          <span className="text-xs text-gray-400">+{template.buttonLabels.length - 2}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Meta Info Row */}
                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(template.status)}`}></span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{template.status}</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {template.language?.toUpperCase() || 'EN'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Hidden by default, shown on hover */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex flex-col gap-2 px-4 w-full">
                      {template.status === 'DRAFT' && (
                        <button 
                          onClick={() => handleSubmitTemplate(template._id)}
                          disabled={submitting}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-2 px-3 rounded transition-colors font-medium flex items-center justify-center gap-1"
                        >
                          {submitting ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                              Submitting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                              </svg>
                              Submit for Approval
                            </>
                          )}
                        </button>
                      )}
                      <button 
                        onClick={() => setUseTemplateModal({ isOpen: true, template })}
                        disabled={template.status !== 'APPROVED'}
                        className={`flex-1 ${template.status === 'APPROVED' ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'} border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs py-2 px-4 rounded transition-colors font-medium disabled:opacity-50`}
                      >
                        Use this template
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {libraryTemplates.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">No templates found in this category.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Meta Template Library Tab */}
      {activeTab === 'meta-library' && (
        <>
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 px-6 py-4 mx-6 mt-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  📚 Meta Template Library
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  Pre-made templates from Meta for common use cases. Click "Edit & Create" to customize and submit for approval.
                </p>
              </div>
              <a
                href="https://business.facebook.com/latest/whatsapp_manager/template_library"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <span>🔗</span> Open in Meta
              </a>
            </div>
          </div>

          {/* Category Filter */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {[
                { id: 'all', label: 'All Templates', icon: '📚', count: Object.values(metaLibraryStats).reduce((a, b) => a + b, 0) },
                { id: 'UTILITY', label: 'Utility', icon: '🔧', count: metaLibraryStats.UTILITY || 0 },
                { id: 'AUTHENTICATION', label: 'Authentication', icon: '🔐', count: metaLibraryStats.AUTHENTICATION || 0 },
                { id: 'MARKETING', label: 'Marketing', icon: '📢', count: metaLibraryStats.MARKETING || 0 }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setMetaLibraryCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors border ${
                    metaLibraryCategory === cat.id
                      ? 'bg-teal-50 border-teal-500 text-teal-700 dark:bg-teal-900/30 dark:border-teal-500 dark:text-teal-400'
                      : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="font-medium">{cat.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    metaLibraryCategory === cat.id 
                      ? 'bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-300' 
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="p-6">
            {loadingMetaLibrary ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
              </div>
            ) : metaLibraryTemplates.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300">No templates found</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  Try a different category or visit Meta's Template Library directly
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metaLibraryTemplates.map((template, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all"
                  >
                    {/* WhatsApp Style Preview */}
                    <div className="bg-[#e5ddd5] dark:bg-gray-700 p-4">
                      <div className="bg-white dark:bg-gray-600 rounded-lg p-3 shadow-sm max-w-[260px] ml-auto">
                        {template.headerText && (
                          <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                            {template.headerText}
                          </p>
                        )}
                        <p className="text-gray-700 dark:text-gray-200 text-sm whitespace-pre-wrap">
                          {template.bodyText?.substring(0, 120)}
                          {template.bodyText?.length > 120 && '...'}
                        </p>
                        {template.footerText && (
                          <p className="text-gray-500 dark:text-gray-400 text-xs mt-2 italic">{template.footerText}</p>
                        )}
                        {template.buttonLabels?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-500">
                            {template.buttonLabels.map((btn, i) => (
                              <div key={i} className="text-center text-blue-600 dark:text-blue-400 text-sm py-1">
                                {btn}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-right text-xs text-gray-400 mt-1">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Template Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {template.name.replace(/_/g, ' ')}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          template.category === 'UTILITY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          template.category === 'AUTHENTICATION' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                          'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                        }`}>
                          {template.category}
                        </span>
                      </div>

                      {template.subcategory && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          📁 {template.subcategory}
                        </p>
                      )}

                      {template.preview && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{template.preview}</p>
                      )}

                      {template.variables?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Variables:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.variables.map((v, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                                {`{{${v}}}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => handleCopyFromLibrary(template)}
                        disabled={copying === template.name}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors font-medium"
                      >
                        {copying === template.name ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Creating...
                          </>
                        ) : (
                          <>
                            <span>✏️</span> Edit & Create
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Active Tab - Table View */}
      {activeTab === 'active' && (
        <>
          {/* Search and Filter Bar */}
          <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Search a template by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">🔽 Status is:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="ANY">Any</option>
                  <option value="Approved">● Approved</option>
                  <option value="Disabled">● Disabled</option>
                  <option value="In Appeal">● In Appeal</option>
                  <option value="Pending">● Pending</option>
                  <option value="Pending Deletion">● Pending Deletion</option>
                  <option value="Rejected">● Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 px-6 py-3 mx-6 mt-4">
            <div className="flex items-start">
              <span className="text-yellow-600 dark:text-yellow-400 mr-2">⚠️</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Showing {filteredActiveTemplates.length} of {activeTemplates.length} templates<br />
                WhatsApp can take up to 24 hours to review (approve / reject) a template.{' '}
                <a href="#" className="text-blue-600 dark:text-blue-400 underline">See More</a>
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="p-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Template Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Language(s)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredActiveTemplates.map((template) => (
                    <tr key={template._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {template.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {template.technicalName || template.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs">
                          <span className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(template.status)}`}></span>
                          {template.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {template.category}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {template.language || 'English (en)'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {template.createdBy?.name || 'Admin'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {template.status === 'DRAFT' && (
                            <button 
                              onClick={() => handleSubmitTemplate(template._id)}
                              disabled={submitting}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 flex items-center gap-1 text-xs font-medium"
                              title="Submit template to Meta for approval"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                              </svg>
                              Submit
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteTemplate(template._id)}
                            className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                            title="Delete template"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredActiveTemplates.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No active templates found</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Deleted Tab - Empty State */}
      {activeTab === 'deleted' && (
        <>
          {/* Search and Filter Bar */}
          <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Search a template by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">🔽 Status is:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="ANY">Any</option>
                  <option value="Approved">● Approved</option>
                  <option value="Disabled">● Disabled</option>
                  <option value="In Appeal">● In Appeal</option>
                  <option value="Pending">● Pending</option>
                  <option value="Pending Deletion">● Pending Deletion</option>
                  <option value="Rejected">● Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Empty State or Table */}
          <div className="p-6">
            {filteredDeletedTemplates.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No Template Found</p>
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">No result found</p>
                </div>

                {/* Table Header (Empty) */}
                <div className="mt-8">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Template Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Language(s)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Created By
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Template Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Language(s)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredDeletedTemplates.map((template) => (
                      <tr key={template._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {template.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {template.technicalName || template.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center text-xs">
                            <span className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(template.status)}`}></span>
                            {template.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {template.category}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {template.language || 'English (en)'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {template.createdBy?.name || 'Admin'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Use Template Modal */}
      <UseTemplateModal
        isOpen={useTemplateModal.isOpen}
        onClose={() => setUseTemplateModal({ isOpen: false, template: null })}
        template={useTemplateModal.template}
      />

      {/* Edit Template Modal - for editing library templates before submission */}
      <EditTemplateModal
        isOpen={editTemplateModal.isOpen}
        onClose={() => setEditTemplateModal({ isOpen: false, template: null })}
        template={editTemplateModal.template}
        onSubmit={handleEditTemplateSubmit}
      />
    </div>
  );
};

export default TemplatesDashboard; 