/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE MANAGER PAGE (INTERAKT-STYLE)
 * 
 * Main page component that integrates:
 * - Template List with filtering
 * - Template Builder with live preview
 * - Template Detail View
 * - All CRUD operations
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FaArrowLeft, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimes
} from 'react-icons/fa';
import TemplateList from './TemplateList';
import TemplateBuilder from './TemplateBuilder';
import WhatsAppPreview from './WhatsAppPreview';
import { get, post, put, del } from '../../lib/api';
import { useWorkspace } from '../../lib/useWorkspace';

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  const styles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  };
  
  const icons = {
    success: FaCheckCircle,
    error: FaTimes,
    warning: FaExclamationTriangle,
    info: FaInfoCircle
  };
  
  const Icon = icons[type] || icons.info;
  
  return (
    <div className={`fixed bottom-4 right-4 ${styles[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-in`}>
      <Icon />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <FaTimes />
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const ConfirmModal = ({ isOpen, title, message, confirmText = 'Confirm', onConfirm, onCancel, variant = 'danger' }) => {
  if (!isOpen) return null;
  
  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    primary: 'bg-green-600 hover:bg-green-700'
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg ${buttonStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════════

const TemplateDetailView = ({ template, canSubmitTemplates, onBack, onEdit, onSubmit, onDelete, onDuplicate }) => {
  const canEdit = ['DRAFT', 'REJECTED'].includes(template.status);
  const canSubmit = canSubmitTemplates && ['DRAFT', 'REJECTED'].includes(template.status);
  
  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <FaArrowLeft />
          Back to Templates
        </button>
        
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => onEdit(template)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit Template
            </button>
          )}
          {canSubmit && (
            <button
              onClick={() => onSubmit(template._id)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Submit for Approval
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Details */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{template.name}</h2>
            
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className={`font-medium ${
                  template.status === 'APPROVED' ? 'text-green-600' :
                  template.status === 'REJECTED' ? 'text-red-600' :
                  template.status === 'PENDING' ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>{template.status}</dd>
              </div>
              
              <div className="flex justify-between">
                <dt className="text-gray-500">Category</dt>
                <dd className="font-medium">{template.category}</dd>
              </div>
              
              <div className="flex justify-between">
                <dt className="text-gray-500">Language</dt>
                <dd className="font-medium">{template.language}</dd>
              </div>
              
              {template.metaTemplateId && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Meta ID</dt>
                  <dd className="font-mono text-sm">{template.metaTemplateId}</dd>
                </div>
              )}
              
              {template.qualityScore && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Quality Score</dt>
                  <dd className="font-medium">{template.qualityScore}</dd>
                </div>
              )}
              
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd>{formatDate(template.createdAt)}</dd>
              </div>
              
              {template.submittedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Submitted</dt>
                  <dd>{formatDate(template.submittedAt)}</dd>
                </div>
              )}
              
              {template.approvedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Approved</dt>
                  <dd className="text-green-600">{formatDate(template.approvedAt)}</dd>
                </div>
              )}
            </dl>
          </div>
          
          {/* Rejection Reason */}
          {template.status === 'REJECTED' && template.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">Rejection Reason</h4>
              <p className="text-red-700">{template.rejectionReason}</p>
            </div>
          )}
          
          {/* Approval History */}
          {template.approvalHistory?.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-medium text-gray-900 mb-4">Approval History</h4>
              <div className="space-y-3">
                {template.approvalHistory.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      entry.status === 'APPROVED' ? 'bg-green-500' :
                      entry.status === 'REJECTED' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium">{entry.status}</p>
                      <p className="text-gray-500">{formatDate(entry.timestamp)}</p>
                      {entry.reason && <p className="text-gray-600 mt-1">{entry.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Preview */}
        <div>
          <h4 className="font-medium text-gray-900 mb-4">Message Preview</h4>
          <WhatsAppPreview template={template} />
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const TemplateManager = () => {
  const router = useRouter();
  const workspace = useWorkspace();
  const bspReady = workspace.stage1Complete && ['CONNECTED', 'RESTRICTED'].includes(workspace.phoneStatus);
  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────
  
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit' | 'detail'
  const [templates, setTemplates] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });
  const [filters, setFilters] = useState({ search: '', status: '', category: '' });
  
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // API CALLS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };
      
      // Remove empty params
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });
      
      const response = await get('/templates', { params });
      setTemplates(response.templates || []);
      setCounts(response.counts || {});
      setPagination(prev => ({
        ...prev,
        ...response.pagination
      }));
    } catch (error) {
      const message = error.message || 'Failed to load templates';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);
  
  const createTemplate = async (templateData) => {
    try {
      setSaving(true);
      const response = await post('/templates', templateData);
      showToast('Template created successfully', 'success');
      setView('list');
      loadTemplates();
      return response.template;
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create template', 'error');
      throw error;
    } finally {
      setSaving(false);
    }
  };
  
  const updateTemplate = async (templateId, templateData) => {
    try {
      setSaving(true);
      const response = await put(`/templates/${templateId}`, templateData);
      showToast('Template updated successfully', 'success');
      setView('list');
      loadTemplates();
      return response.template;
    } catch (error) {
      const message = error.message || 'Failed to update template';
      showToast(message, 'error');
      throw error;
    } finally {
      setSaving(false);
    }
  };
  
  const deleteTemplate = async (templateId) => {
    try {
      await del(`/templates/${templateId}`);
      showToast('Template deleted successfully', 'success');
      loadTemplates();
    } catch (error) {
      const message = error.message || 'Failed to delete template';
      showToast(message, 'error');
    }
  };
  
  const submitTemplate = async (templateId) => {
    try {
      if (!bspReady) {
        showToast('Connect WhatsApp to submit templates for approval', 'warning');
        return;
      }
      setSubmitting(true);
      await post(`/templates/${templateId}/submit`);
      showToast('Template submitted for approval', 'success');
      loadTemplates();
    } catch (error) {
      const message = error.message || 'Failed to submit template';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const duplicateTemplate = async (templateId) => {
    try {
      const response = await post(`/templates/${templateId}/duplicate`);
      showToast('Template duplicated successfully', 'success');
      loadTemplates();
      return response.template;
    } catch (error) {
      const message = error.message || 'Failed to duplicate template';
      showToast(message, 'error');
    }
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };
  
  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setView('create');
  };
  
  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setView('edit');
  };
  
  const handleView = (template) => {
    setSelectedTemplate(template);
    setView('detail');
  };
  
  const handleDelete = (templateId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Template',
      message: 'Are you sure you want to delete this template? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: () => {
        deleteTemplate(templateId);
        setConfirmModal({ isOpen: false });
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    });
  };
  
  const handleSubmit = (templateId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Submit for Approval',
      message: 'Submit this template to Meta for approval? The review process typically takes 24-48 hours.',
      confirmText: 'Submit',
      variant: 'primary',
      onConfirm: () => {
        submitTemplate(templateId);
        setConfirmModal({ isOpen: false });
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    });
  };
  
  const handleDuplicate = (templateId) => {
    duplicateTemplate(templateId);
  };
  
  const handleSave = async (templateData) => {
    if (view === 'edit' && selectedTemplate) {
      await updateTemplate(selectedTemplate._id, templateData);
    } else {
      await createTemplate(templateData);
    }
  };
  
  const handleBuilderSubmit = async (templateData) => {
    try {
      let template;
      if (view === 'edit' && selectedTemplate) {
        template = await updateTemplate(selectedTemplate._id, templateData);
      } else {
        template = await createTemplate(templateData);
      }
      
      if (template?._id) {
        if (!bspReady) {
          showToast('Template saved as draft. Connect WhatsApp to submit for approval.', 'warning');
          return;
        }
        await submitTemplate(template._id);
      }
    } catch (error) {
      // Error already handled in individual functions
    }
  };
  
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };
  
  const handleBack = () => {
    setSelectedTemplate(null);
    setView('list');
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  
  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {!workspace.loading && !bspReady && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-medium">WhatsApp not connected</p>
            <p className="text-sm">Connect your WhatsApp account to submit templates for approval.</p>
          </div>
          <button
            onClick={() => router.push('/onboarding/esb')}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Connect Now
          </button>
        </div>
      )}
      {/* List View */}
      {view === 'list' && (
        <TemplateList
          templates={templates}
          loading={loading}
          counts={counts}
          pagination={pagination}
          canSubmitTemplates={bspReady}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
          onDuplicate={handleDuplicate}
          onView={handleView}
          onFilterChange={handleFilterChange}
          onPageChange={handlePageChange}
        />
      )}
      
      {/* Create View */}
      {view === 'create' && (
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <FaArrowLeft />
              Back to Templates
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Create New Template</h2>
            <p className="text-gray-500">Build a new WhatsApp message template</p>
          </div>
          
          <TemplateBuilder
            onSave={handleSave}
            onSubmit={handleBuilderSubmit}
            onCancel={handleBack}
            isSaving={saving}
            isSubmitting={submitting}
          />
        </div>
      )}
      
      {/* Edit View */}
      {view === 'edit' && selectedTemplate && (
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <FaArrowLeft />
              Back to Templates
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Edit Template</h2>
            <p className="text-gray-500">Modify template: {selectedTemplate.name}</p>
          </div>
          
          <TemplateBuilder
            initialData={selectedTemplate}
            onSave={handleSave}
            onSubmit={handleBuilderSubmit}
            onCancel={handleBack}
            isEditing={true}
            isSaving={saving}
            isSubmitting={submitting}
          />
        </div>
      )}
      
      {/* Detail View */}
      {view === 'detail' && selectedTemplate && (
        <div className="max-w-6xl mx-auto">
          <TemplateDetailView
            template={selectedTemplate}
            canSubmitTemplates={bspReady}
            onBack={handleBack}
            onEdit={handleEdit}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </div>
      )}
      
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Confirm Modal */}
      <ConfirmModal {...confirmModal} />
    </div>
  );
};

export default TemplateManager;
