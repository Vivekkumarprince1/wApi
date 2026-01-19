/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE LIST COMPONENT (INTERAKT-STYLE)
 * 
 * Full-featured template list with:
 * - Status badges (Draft, Pending, Approved, Rejected, etc.)
 * - Category and language filters
 * - Search functionality
 * - Rejection reason viewer
 * - Template duplication
 * - Actions (Edit, Submit, Delete)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaCheckCircle, 
  FaClock, 
  FaTimes, 
  FaPaperPlane,
  FaSearch,
  FaCopy,
  FaExclamationTriangle,
  FaEye,
  FaEllipsisV,
  FaPause,
  FaBan,
  FaFilter,
  FaTags,
  FaGlobe,
  FaInfoCircle,
  FaChevronDown,
  FaExternalLinkAlt
} from 'react-icons/fa';
import { WhatsAppPreviewCompact } from './WhatsAppPreview';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  DRAFT: { 
    color: 'bg-gray-100 text-gray-700 border-gray-200', 
    icon: FaEdit,
    label: 'Draft',
    description: 'Not yet submitted for approval'
  },
  PENDING: { 
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200', 
    icon: FaClock,
    label: 'Pending',
    description: 'Waiting for Meta review'
  },
  APPROVED: { 
    color: 'bg-green-50 text-green-700 border-green-200', 
    icon: FaCheckCircle,
    label: 'Approved',
    description: 'Ready to use'
  },
  REJECTED: { 
    color: 'bg-red-50 text-red-700 border-red-200', 
    icon: FaTimes,
    label: 'Rejected',
    description: 'Rejected by Meta'
  },
  PAUSED: { 
    color: 'bg-orange-50 text-orange-700 border-orange-200', 
    icon: FaPause,
    label: 'Paused',
    description: 'Temporarily disabled'
  },
  DISABLED: { 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    icon: FaBan,
    label: 'Disabled',
    description: 'Permanently disabled'
  }
};

const CATEGORY_CONFIG = {
  MARKETING: { color: 'bg-purple-100 text-purple-700', label: 'Marketing' },
  UTILITY: { color: 'bg-blue-100 text-blue-700', label: 'Utility' },
  AUTHENTICATION: { color: 'bg-amber-100 text-amber-700', label: 'Auth' }
};

const QUALITY_SCORE_CONFIG = {
  GREEN: { color: 'text-green-600', label: 'High Quality' },
  YELLOW: { color: 'text-yellow-600', label: 'Medium Quality' },
  RED: { color: 'text-red-600', label: 'Low Quality' },
  UNKNOWN: { color: 'text-gray-400', label: 'Unknown' }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Status Badge
const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = config.icon;
  
  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}
      title={config.description}
    >
      <Icon className="text-[10px]" />
      {config.label}
    </span>
  );
};

// Category Badge
const CategoryBadge = ({ category }) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.MARKETING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

// Quality Indicator
const QualityIndicator = ({ score }) => {
  const config = QUALITY_SCORE_CONFIG[score] || QUALITY_SCORE_CONFIG.UNKNOWN;
  return (
    <span className={`text-xs ${config.color}`} title={config.label}>
      ● {config.label}
    </span>
  );
};

// Rejection Reason Card
const RejectionCard = ({ reason, onClose }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-3">
      <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <h4 className="font-medium text-red-800 mb-1">Template Rejected</h4>
        <p className="text-sm text-red-700">{reason || 'No reason provided'}</p>
        <div className="mt-3 flex gap-2">
          <a 
            href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
          >
            <FaExternalLinkAlt />
            View Template Guidelines
          </a>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-red-400 hover:text-red-600">
          <FaTimes />
        </button>
      )}
    </div>
  </div>
);

// Template Card
const TemplateCard = ({ 
  template, 
  onEdit, 
  onDelete, 
  onSubmit, 
  onDuplicate, 
  onView,
  showPreview = true 
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showRejection, setShowRejection] = useState(false);
  
  const canEdit = ['DRAFT', 'REJECTED'].includes(template.status);
  const canSubmit = ['DRAFT', 'REJECTED'].includes(template.status);
  const canDelete = true;
  const isApproved = template.status === 'APPROVED';
  
  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow overflow-hidden">
      {/* Rejection Banner */}
      {template.status === 'REJECTED' && template.rejectionReason && showRejection && (
        <RejectionCard 
          reason={template.rejectionReason} 
          onClose={() => setShowRejection(false)} 
        />
      )}
      
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Preview Thumbnail */}
          {showPreview && (
            <div className="w-32 flex-shrink-0 hidden sm:block">
              <WhatsAppPreviewCompact template={template} className="scale-75 origin-top-left" />
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 font-mono text-sm">{template.name}</h3>
                <StatusBadge status={template.status} />
                <CategoryBadge category={template.category} />
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FaGlobe className="text-[10px]" />
                  {template.language}
                </span>
              </div>
              
              {/* Actions Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <FaEllipsisV />
                </button>
                
                {showActions && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowActions(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                      <button
                        onClick={() => { onView(template); setShowActions(false); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FaEye className="text-gray-400" />
                        View Details
                      </button>
                      
                      {canEdit && (
                        <button
                          onClick={() => { onEdit(template); setShowActions(false); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FaEdit className="text-blue-500" />
                          Edit Template
                        </button>
                      )}
                      
                      {canSubmit && (
                        <button
                          onClick={() => { onSubmit(template._id); setShowActions(false); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FaPaperPlane className="text-green-500" />
                          Submit for Approval
                        </button>
                      )}
                      
                      <button
                        onClick={() => { onDuplicate(template._id); setShowActions(false); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FaCopy className="text-purple-500" />
                        Duplicate
                      </button>
                      
                      <hr className="my-1" />
                      
                      <button
                        onClick={() => { onDelete(template._id); setShowActions(false); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                      >
                        <FaTrash />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Body Preview */}
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {template.body?.text || 'No body content'}
            </p>
            
            {/* Rejection Toggle */}
            {template.status === 'REJECTED' && template.rejectionReason && !showRejection && (
              <button
                onClick={() => setShowRejection(true)}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1 mb-3"
              >
                <FaExclamationTriangle />
                View rejection reason
              </button>
            )}
            
            {/* Meta Info Row */}
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              {template.metaTemplateId && (
                <span className="flex items-center gap-1" title="Meta Template ID">
                  <FaInfoCircle />
                  {template.metaTemplateId}
                </span>
              )}
              
              {template.qualityScore && template.qualityScore !== 'UNKNOWN' && (
                <QualityIndicator score={template.qualityScore} />
              )}
              
              <span>Created: {formatDate(template.createdAt)}</span>
              
              {template.approvedAt && (
                <span className="text-green-600">Approved: {formatDate(template.approvedAt)}</span>
              )}
              
              {template.lastSyncedAt && (
                <span>Synced: {formatDate(template.lastSyncedAt)}</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
          {canEdit && (
            <button
              onClick={() => onEdit(template)}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1"
            >
              <FaEdit className="text-xs" />
              Edit
            </button>
          )}
          
          {canSubmit && (
            <button
              onClick={() => onSubmit(template._id)}
              className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 flex items-center gap-1"
            >
              <FaPaperPlane className="text-xs" />
              Submit
            </button>
          )}
          
          {isApproved && (
            <span className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded flex items-center gap-1">
              <FaCheckCircle className="text-xs" />
              Ready to Use
            </span>
          )}
          
          <button
            onClick={() => onDuplicate(template._id)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1 ml-auto"
          >
            <FaCopy className="text-xs" />
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
};

// Empty State
const EmptyState = ({ onCreateNew, hasFilters }) => (
  <div className="text-center py-12">
    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <FaEdit className="text-gray-400 text-2xl" />
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">
      {hasFilters ? 'No templates found' : 'No templates yet'}
    </h3>
    <p className="text-gray-500 mb-4">
      {hasFilters 
        ? 'Try adjusting your filters or search terms' 
        : 'Create your first message template to get started'
      }
    </p>
    {!hasFilters && (
      <button
        onClick={onCreateNew}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        <FaPlus />
        Create Template
      </button>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const TemplateList = ({
  templates = [],
  loading = false,
  counts = {},
  pagination = {},
  onCreateNew,
  onEdit,
  onDelete,
  onSubmit,
  onDuplicate,
  onView,
  onFilterChange,
  onPageChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange?.({ search: searchTerm, status: selectedStatus, category: selectedCategory });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedStatus, selectedCategory]);
  
  const hasFilters = searchTerm || selectedStatus || selectedCategory;
  
  return (
    <div className="space-y-4">
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* HEADER */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Message Templates</h2>
          <p className="text-gray-500 text-sm">
            {counts.all || 0} templates • {counts.approved || 0} approved
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <FaPlus />
            Create Template
          </button>
        </div>
      </div>
      
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* STATUS TABS */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { value: '', label: 'All', count: counts.all },
          { value: 'DRAFT', label: 'Drafts', count: counts.draft },
          { value: 'PENDING', label: 'Pending', count: counts.pending },
          { value: 'APPROVED', label: 'Approved', count: counts.approved },
          { value: 'REJECTED', label: 'Rejected', count: counts.rejected }
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedStatus === tab.value
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1.5 ${selectedStatus === tab.value ? 'text-green-600' : 'text-gray-400'}`}>
                ({tab.count || 0})
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SEARCH AND FILTERS */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FaTimes />
            </button>
          )}
        </div>
        
        {/* Category Filter */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">All Categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
          <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>
      
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TEMPLATE GRID/LIST */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
        </div>
      ) : templates.length === 0 ? (
        <EmptyState onCreateNew={onCreateNew} hasFilters={hasFilters} />
      ) : (
        <div className="grid gap-4">
          {templates.map(template => (
            <TemplateCard
              key={template._id}
              template={template}
              onEdit={onEdit}
              onDelete={onDelete}
              onSubmit={onSubmit}
              onDuplicate={onDuplicate}
              onView={onView}
            />
          ))}
        </div>
      )}
      
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* PAGINATION */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={!pagination.hasMore}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateList;
