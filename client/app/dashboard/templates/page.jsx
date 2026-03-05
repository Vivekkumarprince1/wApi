'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import CreateTemplateModal from '../../../components/CreateTemplateModal';
import EditTemplateModal from '../../../components/EditTemplateModal';
import UseTemplateModal from '../../../components/UseTemplateModal';
import {
  fetchTemplates,
  getTemplateCategories,
  getTemplateLibraryStats,
  deleteTemplate,
  submitTemplateToMeta,
  syncTemplatesFromGupshup,
  updateTemplate,
  fetchTemplatesFromLibrary,
  createTemplate
} from '../../../lib/api';
import {
  FaSync, FaPlus, FaSearch, FaFilter, FaList, FaThLarge,
  FaEllipsisV, FaCheckCircle, FaClock, FaTimesCircle,
  FaFileAlt, FaImage, FaVideo, FaFilePdf, FaMapMarkerAlt, FaPaperPlane
} from 'react-icons/fa';

const TemplatesDashboard = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'pending', 'rejected', 'deleted', 'drafts'
  const [selectedCategories, setSelectedCategories] = useState(['ALL']);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittingTemplateId, setSubmittingTemplateId] = useState(null);
  const [generatingSamples, setGeneratingSamples] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [useTemplateModal, setUseTemplateModal] = useState({ isOpen: false, template: null });

  // Data from backend
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [libraryStats, setLibraryStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError('');

      const [templatesData, deletedTemplatesData, categoriesData, statsData] = await Promise.all([
        fetchTemplates(),
        fetchTemplates({ status: 'DELETED' }),
        getTemplateCategories(),
        getTemplateLibraryStats().catch(() => null)
      ]);

      if (statsData) setLibraryStats(statsData);

      let allTemplates = [];
      if (templatesData?.templates) allTemplates = [...templatesData.templates];
      if (deletedTemplatesData?.templates) allTemplates = [...allTemplates, ...deletedTemplatesData.templates];

      setTemplates(allTemplates);

      if (categoriesData && categoriesData.categories) {
        const allCategories = [
          { id: 'ALL', label: 'All Categories' },
          ...categoriesData.categories.map(cat => ({
            id: cat.category || cat.name || cat._id || cat.id || 'UNKNOWN',
            label: (cat.category || cat.name || cat._id || cat.id || 'UNKNOWN').replace(/_/g, ' ')
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
      toast.success('Template deleted successfully');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  const handleSubmitTemplate = async (templateId) => {
    if (!confirm('Submit this template to Meta for approval?')) return;
    try {
      setSubmitting(true);
      setSubmittingTemplateId(templateId);
      await submitTemplateToMeta(templateId);
      toast.success('Template submitted! Status: PENDING.');
      try { await syncTemplatesFromGupshup(); } catch (e) { }
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit template');
    } finally {
      setSubmitting(false);
      setSubmittingTemplateId(null);
    }
  };

  const handleOpenEdit = (template) => {
    setEditingTemplate(template);
    setIsEditModalOpen(true);
  };

  const handleSyncTemplates = async () => {
    const toastId = toast.loading('Syncing templates from WhatsApp...');
    try {
      await syncTemplatesFromGupshup();
      await loadData(true);
      toast.success('Templates synced successfully', { id: toastId });
    } catch (error) {
      toast.error('Failed to sync templates', { id: toastId });
    }
  };

  // Status mapping to logical tabs
  const getTabCount = (tabName) => {
    switch (tabName) {
      case 'active': return templates.filter(t => t.status === 'APPROVED').length;
      case 'pending': return templates.filter(t => t.status === 'PENDING' || t.status === 'IN_APPEAL').length;
      case 'rejected': return templates.filter(t => t.status === 'REJECTED').length;
      case 'drafts': return templates.filter(t => t.status === 'DRAFT').length;
      case 'deleted': return templates.filter(t => t.status === 'DELETED').length;
      default: return templates.length;
    }
  };

  const filteredTemplates = templates.filter(t => {
    // Tab Filter
    if (activeTab === 'active' && t.status !== 'APPROVED') return false;
    if (activeTab === 'pending' && !['PENDING', 'IN_APPEAL'].includes(t.status)) return false;
    if (activeTab === 'rejected' && t.status !== 'REJECTED') return false;
    if (activeTab === 'drafts' && t.status !== 'DRAFT') return false;
    if (activeTab === 'deleted' && t.status !== 'DELETED') return false;

    // Category Filter
    if (!selectedCategories.includes('ALL') && !selectedCategories.includes(t.category)) return false;

    // Search Filter
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="bg-[#e6f4ea] text-[#137333] px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><FaCheckCircle /> Approved</span>;
      case 'PENDING':
      case 'IN_APPEAL':
        return <span className="bg-[#fef7e0] text-[#b06000] px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><FaClock /> Pending</span>;
      case 'REJECTED':
        return <span className="bg-[#fce8e6] text-[#c5221f] px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><FaTimesCircle /> Rejected</span>;
      case 'DRAFT':
        return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><FaFileAlt /> Draft</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold w-max">{status}</span>;
    }
  };

  const getHeaderIcon = (format) => {
    switch (format) {
      case 'IMAGE': return <FaImage className="text-gray-400" title="Image Header" />;
      case 'VIDEO': return <FaVideo className="text-gray-400" title="Video Header" />;
      case 'DOCUMENT': return <FaFilePdf className="text-gray-400" title="Document Header" />;
      case 'LOCATION': return <FaMapMarkerAlt className="text-gray-400" title="Location Header" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f4f5f7]">
        <div className="w-10 h-10 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] font-sans text-gray-800 pb-10">

      {/* Page Header */}
      <div className="bg-white px-8 py-5 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and sync your business message templates</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncTemplates}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm"
          >
            <FaSync className="text-gray-500" />
            Sync from WhatsApp
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-[#00a884] hover:bg-[#008f6f] text-white px-5 py-2 rounded-md text-sm font-bold transition-colors shadow-sm"
          >
            <FaPlus />
            Create Template
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-6 flex flex-col gap-6">

        {/* Filters and Tabs Row */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">

          {/* Top Filter Bar */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">

            <div className="flex items-center gap-3 flex-1">
              <div className="relative max-w-md w-full">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search template name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:bg-white focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] outline-none transition-all"
                />
              </div>

              <select
                value={selectedCategories[0]}
                onChange={(e) => setSelectedCategories([e.target.value])}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-md px-3 py-2 outline-none focus:border-[#00a884] cursor-pointer"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            <div className="flex items-center bg-gray-100 rounded-md p-0.5 border border-gray-200">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-[#00a884]' : 'text-gray-500 hover:text-gray-700'}`}
                title="List View"
              >
                <FaList />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#00a884]' : 'text-gray-500 hover:text-gray-700'}`}
                title="Grid View"
              >
                <FaThLarge />
              </button>
            </div>

          </div>

          {/* Status Tabs */}
          <div className="flex overflow-x-auto custom-scrollbar">
            {[
              { id: 'active', label: 'Active', count: getTabCount('active') },
              { id: 'pending', label: 'Pending Review', count: getTabCount('pending') },
              { id: 'rejected', label: 'Rejected', count: getTabCount('rejected') },
              { id: 'drafts', label: 'Drafts', count: getTabCount('drafts') },
              { id: 'deleted', label: 'Deleted', count: getTabCount('deleted') }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                  ? 'border-[#00a884] text-[#00a884]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-[#00a884]/10' : 'bg-gray-100'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-16 text-center shadow-sm">
            <FaFileAlt className="text-gray-300 text-6xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-500 mb-6">There are no templates matching your current filters.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategories(['ALL']); setActiveTab('active'); }}
              className="text-[#00a884] font-medium hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/3">Template Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Language</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTemplates.map((template) => (
                    <tr key={template._id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            {template.header?.enabled && template.header.format !== 'TEXT' && template.header.format !== 'NONE'
                              ? getHeaderIcon(template.header.format)
                              : <FaFileAlt className="text-gray-400" />
                            }
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm group-hover:text-[#00a884] transition-colors cursor-pointer" onClick={() => handleOpenEdit(template)}>
                              {template.name}
                            </p>
                            <p className="text-xs text-gray-500 line-clamp-1 max-w-sm mt-0.5">
                              {template.bodyText || template.body?.text || 'No content preview'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        {getStatusBadge(template.status)}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {template.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className="text-sm font-medium text-gray-600">
                          {template.language?.toUpperCase() || 'EN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle text-right">
                        <div className="flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {['DRAFT', 'REJECTED'].includes(template.status) && (
                            <button onClick={() => handleSubmitTemplate(template._id)} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors">Submit</button>
                          )}
                          {template.status === 'APPROVED' && (
                            <button onClick={() => setUseTemplateModal({ isOpen: true, template })} className="text-xs font-bold text-[#00a884] hover:bg-green-50 px-3 py-1.5 rounded transition-colors border border-[#00a884]">Use</button>
                          )}
                          <button onClick={() => handleOpenEdit(template)} className="text-gray-500 hover:text-gray-900 p-2 rounded-full hover:bg-gray-200 transition-colors">
                            <FaEllipsisV />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTemplates.map((template) => (
              <div key={template._id} className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow group relative overflow-hidden">
                <div className="p-5 flex-1 flex flex-col border-b border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    {getStatusBadge(template.status)}
                    {template.header?.enabled && template.header.format !== 'TEXT' && template.header.format !== 'NONE' && (
                      <div className="bg-gray-100 p-1.5 rounded text-gray-500 text-xs">
                        {getHeaderIcon(template.header.format)}
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 text-[15px] mb-2 cursor-pointer hover:text-[#00a884] transition-colors" onClick={() => handleOpenEdit(template)}>
                    {template.name}
                  </h3>

                  <div className="bg-[#f0f2f5] p-3 rounded-md text-sm text-[#111b21] flex-1 line-clamp-4 leading-relaxed font-normal whitespace-pre-wrap shadow-inner">
                    {template.bodyText || template.body?.text || ''}
                  </div>

                  {template.buttons?.enabled && template.buttons?.items?.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {template.buttons.items.slice(0, 2).map((btn, i) => (
                        <div key={i} className="text-center text-xs font-bold text-[#00a884] bg-white border border-gray-200 py-1.5 rounded">
                          {btn.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 bg-gray-50 flex items-center justify-between mt-auto">
                  <div className="flex gap-2">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{template.category}</span>
                    <span className="text-[11px] font-bold text-gray-400">•</span>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{template.language}</span>
                  </div>
                  <div className="flex gap-1">
                    {['DRAFT', 'REJECTED'].includes(template.status) && (
                      <button onClick={() => handleSubmitTemplate(template._id)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="Submit for Approval">
                        <FaPaperPlane className="text-xs" />
                      </button>
                    )}
                    {template.status === 'APPROVED' && (
                      <button onClick={() => setUseTemplateModal({ isOpen: true, template })} className="p-1.5 bg-[#00a884]/10 text-[#00a884] rounded hover:bg-[#00a884]/20 transition-colors" title="Use">
                        <FaPlus className="text-xs" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteTemplate(template._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete">
                      <FaTimesCircle className="text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
      />

      <EditTemplateModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingTemplate(null); }}
        template={editingTemplate}
        onSubmit={async (data) => {
          // Provide basic bridging until Edit Modal is revamped
          try { await updateTemplate(editingTemplate._id, data); loadData(); setIsEditModalOpen(false); } catch (e) { }
        }}
      />

      <UseTemplateModal
        isOpen={useTemplateModal.isOpen}
        onClose={() => setUseTemplateModal({ isOpen: false, template: null })}
        template={useTemplateModal.template}
      />

    </div>
  );
};

export default TemplatesDashboard;
