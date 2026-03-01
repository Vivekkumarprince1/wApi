'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { TemplateManager } from '../../../components/templates';
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

const TemplatesDashboard = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('library');
  const [selectedCategories, setSelectedCategories] = useState(['ALL']);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ANY');
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
  const [activeTemplates, setActiveTemplates] = useState([]);
  const [deletedTemplates, setDeletedTemplates] = useState([]);
  const [libraryStats, setLibraryStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const hasPendingTemplates = templates.some(template => template.status === 'PENDING');
    if (!hasPendingTemplates) return;

    const interval = setInterval(async () => {
      try {
        await syncTemplatesFromGupshup();
        await loadData(true);
      } catch (_error) {
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [templates]);

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError('');
      
      // Fetch templates, categories, and stats
      const [templatesData, deletedTemplatesData, categoriesData, statsData] = await Promise.all([
        fetchTemplates(),
        fetchTemplates({ status: 'DELETED' }),
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
        
        setTemplates(allTemplates);
        setActiveTemplates(approved);
      }
      
      if (deletedTemplatesData && deletedTemplatesData.templates) {
        setDeletedTemplates(deletedTemplatesData.templates);
      }

      if (categoriesData && categoriesData.categories) {
        const allCategories = [
          { id: 'ALL', label: 'ALL', count: 'All templates' },
          ...categoriesData.categories.map(cat => ({
            id: cat.category || cat.name || cat._id || cat.id || 'UNKNOWN',
            label: (cat.category || cat.name || cat._id || cat.id || 'UNKNOWN').replace(/_/g, ' '),
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
      toast.success('Template deleted successfully');
      loadData(); // Reload data after deletion
    } catch (err) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  const handleSubmitTemplate = async (templateId) => {
    if (!confirm('Submit this template to Meta for approval? This will change the status to PENDING.')) return;
    
    try {
      setSubmitting(true);
      setSubmittingTemplateId(templateId);

      await submitTemplateToMeta(templateId);

      setTemplates((prev) => prev.map((template) => (
        template._id === templateId ? { ...template, status: 'PENDING' } : template
      )));

      toast.success('Template submitted to Meta for approval! Status: PENDING. Check back in 24-48 hours.');

      try {
        await syncTemplatesFromGupshup();
      } catch (_syncError) {
      }

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

  const sanitizeTemplateName = (name) => {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  };

  const parseContainerMeta = (item) => {
    const raw = item?.containerMeta;
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return {};
    }
  };

  const getBodyText = (item, containerMeta) => {
    const combined = item?.data || containerMeta?.data || item?.bodyText || '';
    const footerText = containerMeta?.footer || '';

    if (combined && footerText && combined.endsWith(`\n${footerText}`)) {
      return combined.slice(0, -(footerText.length + 1));
    }

    return combined || 'Hello {{1}}';
  };

  const normalizeTemplateText = (value) => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';

    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.value === 'string') return value.value;

    return '';
  };

  const handleGenerateSamples = async () => {
    try {
      setGeneratingSamples(true);

      const libraryResponse = await fetchTemplatesFromLibrary({ languageCode: 'en' });
      const providerTemplates = Array.isArray(libraryResponse?.templates) ? libraryResponse.templates : [];

      if (providerTemplates.length === 0) {
        toast.info('No templates found in library to generate samples.');
        return;
      }

      const existingNames = new Set(templates.map((template) => String(template.name || '').toLowerCase()));
      const picked = providerTemplates.slice(0, 5);
      const suffix = Date.now().toString().slice(-6);

      let created = 0;
      for (let index = 0; index < picked.length; index++) {
        const item = picked[index];
        const languageCode = item.languageCode || item.language || 'en';
        const category = item.category || 'UTILITY';
        const containerMeta = parseContainerMeta(item);

        const baseName = sanitizeTemplateName(item.elementName || item.name || item.libraryTemplateName);
        if (!baseName) {
          continue;
        }

        const elementName = `${baseName}_sample_${suffix}${index}`.slice(0, 50);
        if (existingNames.has(elementName.toLowerCase())) {
          continue;
        }

        try {
          const bodyText = getBodyText(item, containerMeta);

          const payload = {
            name: elementName,
            category,
            language: languageCode,
            body: {
              text: bodyText,
              examples: []
            },
            header: containerMeta?.header
              ? {
                  enabled: true,
                  format: 'TEXT',
                  text: String(containerMeta.header)
                }
              : { enabled: false, format: 'NONE' },
            footer: containerMeta?.footer
              ? {
                  enabled: true,
                  text: String(containerMeta.footer)
                }
              : { enabled: false, text: '' },
            buttons: { enabled: false, items: [] }
          };

          await createTemplate(payload);
          existingNames.add(elementName.toLowerCase());
          created++;
        } catch (_error) {
        }
      }

      if (created > 0) {
        toast.success(`${created} sample template${created > 1 ? 's' : ''} added as draft.`);
      } else {
        toast.info('No sample templates were generated.');
      }

      await loadData();
    } catch (error) {
      toast.error(error?.message || 'Failed to generate sample templates from library');
    } finally {
      setGeneratingSamples(false);
    }
  };

  const handleEditTemplate = async (editedData) => {
    if (!editingTemplate?._id) {
      throw new Error('Template not selected for editing');
    }

    const variablesInOrder = Object.keys(editedData.variableSamples || {})
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => editedData.variableSamples[key])
      .filter(Boolean);

    const payload = {
      name: editedData.name,
      language: editedData.language,
      category: editedData.category,
      header: (() => {
        const fmt = editedData.headerFormat || 'NONE';
        if (fmt === 'TEXT' && editedData.headerText) {
          return { enabled: true, format: 'TEXT', text: editedData.headerText, example: variablesInOrder[0] || '' };
        }
        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(fmt)) {
          return {
            enabled: true,
            format: fmt,
            mediaHandle: editedData.mediaHandle || '',
            mediaUrl: editedData.mediaUrl || '',
          };
        }
        return { enabled: false, format: 'NONE' };
      })(),
      body: {
        text: editedData.bodyText,
        examples: variablesInOrder
      },
      footer: editedData.footerText
        ? { enabled: true, text: editedData.footerText }
        : { enabled: false, text: '' },
      buttons: (editedData.buttonLabels || editedData.buttons || []).length > 0
        ? {
            enabled: true,
            items: (editedData.buttonLabels || editedData.buttons).map((label) => ({
              type: 'QUICK_REPLY',
              text: label
            }))
          }
        : { enabled: false, items: [] },
      expectedVersion: editingTemplate.version,
      expectedStatus: editingTemplate.status
    };

    try {
      const response = await updateTemplate(editingTemplate._id, payload);

      if (response?.notification) {
        if (response.workflow === 'APPROVED_FORK_AND_SUBMIT') {
          toast.info(response.notification);
        } else {
          toast.success(response.notification);
        }
      } else {
        toast.success('Template updated successfully');
      }

      setIsEditModalOpen(false);
      setEditingTemplate(null);
      await loadData();
    } catch (error) {
      const message = error?.message || 'Failed to edit template';
      toast.error(message);
      throw error;
    }
  };

  // Filter templates for library view
  const libraryTemplates = templates.filter(t => {
    if (!selectedCategories.includes('ALL') && !selectedCategories.includes(t.category)) return false;
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
    // Fall back to direct body property using normalization
    return normalizeTemplateText(template.body) || template.content || 'No content available';
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
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Library Stats Banner */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-4 px-6 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-2xl">📚</span>
              </div>
              <div>
                <span className="text-3xl font-bold">{templates?.length || 0}</span>
                <p className="text-sm opacity-90">Total Templates</p>
              </div>
            </div>
            <div className="h-12 w-px bg-white/30 hidden md:block"></div>
            <div className="flex gap-4 sm:gap-6 text-sm flex-wrap">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                <span className="font-semibold">{templates?.filter(t => t.status === 'APPROVED').length || 0}</span>
                <span className="opacity-90">Approved</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                <span className="font-semibold">{templates?.filter(t => t.status === 'PENDING').length || 0}</span>
                <span className="opacity-90">Pending</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                <span className="font-semibold">{templates?.filter(t => t.status === 'REJECTED').length || 0}</span>
                <span className="opacity-90">Rejected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="bg-card border-b border-border px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Template Library</h1>
            <p className="text-muted-foreground">Create and manage WhatsApp message templates</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateSamples}
              disabled={generatingSamples}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-all shadow-premium hover:shadow-xl disabled:opacity-60"
            >
              {generatingSamples ? 'Generating...' : 'Generate Samples'}
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-premium hover:shadow-xl transform hover:scale-105"
            >
              <span className="text-lg">+</span>
              <span>Create New</span>
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
      <div className="bg-card border-b border-border px-8 shadow-sm">
        <div className="flex space-x-8 max-w-7xl mx-auto">
          <button
            onClick={() => setActiveTab('library')}
            className={`py-4 px-2 border-b-3 font-semibold text-sm transition-all ${
              activeTab === 'library'
                ? 'border-primary text-primary border-b-4'
                : 'border-transparent text-muted-foreground hover:text-gray-700 dark:text-muted-foreground hover:border-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>My Templates</span>
              <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                {templates.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'active'
                ? 'border-teal-600 text-primary'
                : 'border-transparent text-muted-foreground hover:text-gray-700 dark:text-muted-foreground'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab('deleted')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'deleted'
                ? 'border-teal-600 text-primary'
                : 'border-transparent text-muted-foreground hover:text-gray-700 dark:text-muted-foreground'
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
          <div className="bg-card px-6 py-4 border-b border-border">
            <div className="flex items-center space-x-3 overflow-x-auto pb-2">
              {categories.map((category) => {
                const isSelected = selectedCategories.includes(category.id);
                return (
                <button
                  key={category.id}
                  onClick={() => {
                    if (category.id === 'ALL') {
                      setSelectedCategories(['ALL']);
                    } else {
                      let next = selectedCategories.filter(c => c !== 'ALL');
                      if (next.includes(category.id)) {
                        next = next.filter(c => c !== category.id);
                      } else {
                        next.push(category.id);
                      }
                      if (next.length === 0) next = ['ALL'];
                      setSelectedCategories(next);
                    }
                  }}
                  className={`flex flex-col items-start px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors border ${
                    isSelected
                      ? 'bg-muted border-border dark:bg-muted dark:border-border'
                      : 'bg-white border-border hover:bg-muted dark:bg-card dark:border-border dark:hover:bg-gray-750'
                  }`}
                >
                  <span className="font-semibold text-foreground">{category.label}</span>
                  <span className="text-xs text-muted-foreground">{category.count}</span>
                </button>
                );
              })}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {libraryTemplates.map((template) => (
                <div
                  key={template._id}
                  className="bg-card rounded-lg overflow-hidden border border-border hover:shadow-lg transition-all duration-300 group relative flex flex-col h-72"
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
                  <div className="p-4 flex flex-col flex-grow">
                    {/* Header Preview */}
                    {template.header?.enabled && template.header?.format && template.header.format !== 'NONE' && (
                      <div className="text-xs text-primary font-medium mb-1 truncate">
                        {template.header.format === 'TEXT' && normalizeTemplateText(template.header)
                          ? `📝 ${normalizeTemplateText(template.header)}`
                          : template.header.format === 'IMAGE' ? '🖼️ Image header'
                          : template.header.format === 'VIDEO' ? '🎬 Video header'
                          : template.header.format === 'DOCUMENT' ? '📄 Document header'
                          : null}
                      </div>
                    )}
                    
                    <h3 className="font-semibold text-sm mb-2 text-foreground line-clamp-1">
                      {template.name}
                    </h3>
                    
                    {/* Body Preview */}
                    <div className="flex-grow">
                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-4">
                        {template.bodyText || normalizeTemplateText(template.body) || getTemplateBodyText(template)}
                      </p>
                      
                      {/* Footer Preview */}
                      {normalizeTemplateText(template.footer) && (
                        <p className="text-xs text-muted-foreground mt-1 italic truncate">
                          {normalizeTemplateText(template.footer)}
                        </p>
                      )}
                    </div>
                    
                    {/* Buttons Preview */}
                    {template.buttons?.enabled && template.buttons?.items?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 mb-3">
                        {template.buttons.items.slice(0, 2).map((button, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground truncate max-w-[120px]">
                            🔘 {button.text}
                          </span>
                        ))}
                        {template.buttons.items.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{template.buttons.items.length - 2}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Meta Info Row */}
                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(template.status)}`}></span>
                        <span className="text-xs text-muted-foreground">{template.status}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {template.language?.toUpperCase() || 'EN'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Hidden by default, shown on hover */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex flex-col gap-2 px-4 w-full">
                      {['DRAFT', 'REJECTED'].includes(template.status) && (
                        <button 
                          onClick={() => handleSubmitTemplate(template._id)}
                          disabled={submitting && submittingTemplateId === template._id}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-2 px-3 rounded transition-colors font-medium flex items-center justify-center gap-1"
                        >
                          {submitting && submittingTemplateId === template._id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                              Submitting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                              </svg>
                              {template.status === 'REJECTED' ? 'Resubmit for Approval' : 'Submit for Approval'}
                            </>
                          )}
                        </button>
                      )}
                      {['DRAFT', 'REJECTED', 'APPROVED'].includes(template.status) && (
                        <button
                          onClick={() => handleOpenEdit(template)}
                          className="w-full bg-white hover:bg-gray-100 text-gray-900 text-xs py-2 px-3 rounded transition-colors font-medium"
                        >
                          {template.status === 'APPROVED' ? 'Edit as New Version' : 'Edit Template'}
                        </button>
                      )}
                      <button 
                        onClick={() => setUseTemplateModal({ isOpen: true, template })}
                        disabled={template.status !== 'APPROVED'}
                        className={`flex-1 ${template.status === 'APPROVED' ? 'bg-card hover:bg-accent' : 'bg-gray-400 dark:bg-muted cursor-not-allowed'} border border-border text-foreground text-xs py-2 px-4 rounded transition-colors font-medium disabled:opacity-50`}
                      >
                        Use this template
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(template._id)}
                        className="w-full bg-red-500/90 hover:bg-red-600 text-white text-xs py-2 px-3 rounded transition-colors font-medium flex justify-center items-center gap-1 mt-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {libraryTemplates.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">No templates found in this category.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Active Tab - Table View */}
      {activeTab === 'active' && (
        <>
          {/* Search and Filter Bar */}
          <div className="bg-card px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Search a template by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">🔽 Status is:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
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
              <p className="text-sm text-foreground">
                Showing {filteredActiveTemplates.length} of {activeTemplates.length} templates<br />
                WhatsApp can take up to 24 hours to review (approve / reject) a template.{' '}
                <a href="#" onClick={(e) => e.preventDefault()} className="text-blue-600 dark:text-blue-400 underline">See More</a>
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="p-6">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Template Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Language(s)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredActiveTemplates.map((template) => (
                    <tr key={template._id} className="hover:bg-accent/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {template.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
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
                      <td className="px-6 py-4 text-sm text-foreground">
                        {template.category}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {template.language || 'English (en)'}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {template.createdBy?.name || 'Admin'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {['DRAFT', 'REJECTED'].includes(template.status) && (
                            <button 
                              onClick={() => handleSubmitTemplate(template._id)}
                              disabled={submitting && submittingTemplateId === template._id}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 flex items-center gap-1 text-xs font-medium"
                              title="Submit template to Meta for approval"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                              </svg>
                              Submit
                            </button>
                          )}
                          {['DRAFT', 'REJECTED', 'APPROVED'].includes(template.status) && (
                            <button
                              onClick={() => handleOpenEdit(template)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs font-medium"
                              title={template.status === 'APPROVED' ? 'Create a new version and submit automatically' : 'Edit template'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2M12 7v10m-7 0h14M5 17a2 2 0 00-2 2v1h18v-1a2 2 0 00-2-2H5z" />
                              </svg>
                              Edit
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteTemplate(template._id)}
                            className="bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 p-2 rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium"
                            title="Delete template"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredActiveTemplates.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No active templates found</p>
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
          <div className="bg-card px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Search a template by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">🔽 Status is:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
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
              <div className="bg-card rounded-lg border border-border p-12">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">No Template Found</p>
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">No result found</p>
                </div>

                {/* Table Header (Empty) */}
                <div className="mt-8">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Template Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Language(s)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Created By
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Template Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Language(s)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredDeletedTemplates.map((template) => (
                      <tr key={template._id} className="hover:bg-accent/50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {template.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
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
                        <td className="px-6 py-4 text-sm text-foreground">
                          {template.category}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {template.language || 'English (en)'}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {template.createdBy?.name || 'Admin'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-muted-foreground hover:text-gray-600 dark:hover:text-muted-foreground">
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

      <EditTemplateModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
        onSubmit={handleEditTemplate}
      />
    </div>
  );
};

export default TemplatesDashboard;
