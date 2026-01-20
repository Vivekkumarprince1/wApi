/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * USE TEMPLATE STATUS HOOK
 * Stage 2: Real-time template status tracking via WebSocket + polling fallback
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/lib/SocketContext';
import { get, post } from '@/lib/api';

// Type definitions
interface TemplateStatusOptions {
  pollInterval?: number;
  enablePolling?: boolean;
  onStatusChange?: ((data: StatusChangeData) => void) | null;
}

interface StatusChangeData {
  templateId: string;
  previousStatus: string | null;
  newStatus: string;
  template?: any;
  reason?: string;
  rejectionDetails?: any;
}

interface ApprovedTemplatesOptions {
  category?: string | null;
  language?: string | null;
  search?: string;
}

/**
 * Hook for monitoring template status changes
 * @param {string} templateId - Template ID to monitor (optional for list mode)
 * @param {Object} options - Configuration options
 * @returns {Object} Template status and controls
 */
export function useTemplateStatus(templateId: string | null = null, options: TemplateStatusOptions = {}) {
  const {
    pollInterval = 30000, // 30 seconds default
    enablePolling = true,
    onStatusChange = null
  } = options;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const socket = useSocket();
  const pollTimerRef = useRef(null);

  // Fetch template status
  const fetchStatus = useCallback(async () => {
    if (!templateId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await get(`/templates/${templateId}`);
      if (response.success) {
        const newStatus = response.template.status;
        const prevStatus = status;
        
        setStatus(newStatus);
        setLastUpdated(new Date());

        // Trigger callback if status changed
        if (prevStatus && prevStatus !== newStatus && onStatusChange) {
          onStatusChange({
            templateId,
            previousStatus: prevStatus,
            newStatus,
            template: response.template
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch template status');
    } finally {
      setLoading(false);
    }
  }, [templateId, status, onStatusChange]);

  // WebSocket listener
  useEffect(() => {
    if (!socket) return;

    const handleTemplateStatus = (data) => {
      // Update if this is the template we're monitoring
      if (templateId && data.templateId === templateId) {
        const prevStatus = status;
        setStatus(data.status);
        setLastUpdated(new Date(data.timestamp));

        if (prevStatus && prevStatus !== data.status && onStatusChange) {
          onStatusChange({
            templateId,
            previousStatus: prevStatus,
            newStatus: data.status,
            reason: data.reason,
            rejectionDetails: data.rejectionDetails
          });
        }
      }
    };

    socket.on('template.status', handleTemplateStatus);

    return () => {
      socket.off('template.status', handleTemplateStatus);
    };
  }, [socket, templateId, status, onStatusChange]);

  // Polling fallback
  useEffect(() => {
    if (!enablePolling || !templateId) return;

    // Initial fetch
    fetchStatus();

    // Set up polling
    pollTimerRef.current = setInterval(fetchStatus, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [templateId, enablePolling, pollInterval, fetchStatus]);

  // Manual refresh
  const refresh = useCallback(() => {
    return fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    lastUpdated,
    refresh,
    isConnected: !!socket?.connected
  };
}

/**
 * Hook for fetching only approved templates
 * Use in campaign/auto-reply/workflow template selectors
 */
export function useApprovedTemplates(options: ApprovedTemplatesOptions = {}) {
  const { category = null, language = null, search = '' } = options;

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApprovedTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (language) params.append('language', language);
      if (search) params.append('search', search);

      const response = await get(`/templates/approved?${params.toString()}`);
      
      if (response.success) {
        setTemplates(response.templates);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch approved templates');
    } finally {
      setLoading(false);
    }
  }, [category, language, search]);

  useEffect(() => {
    fetchApprovedTemplates();
  }, [fetchApprovedTemplates]);

  return {
    templates,
    loading,
    error,
    refresh: fetchApprovedTemplates,
    count: templates.length
  };
}

/**
 * Hook for template status counts (dashboard)
 */
export function useTemplateStatusCounts() {
  const [counts, setCounts] = useState({
    DRAFT: 0,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    PAUSED: 0,
    DISABLED: 0
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socket = useSocket();

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await get('/templates/status-counts');
      
      if (response.success) {
        setCounts(response.counts);
        setTotal(response.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch template counts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh counts when template status changes
  useEffect(() => {
    if (!socket) return;

    const handleTemplateStatus = () => {
      // Refresh counts when any template status changes
      fetchCounts();
    };

    socket.on('template.status', handleTemplateStatus);

    return () => {
      socket.off('template.status', handleTemplateStatus);
    };
  }, [socket, fetchCounts]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    total,
    loading,
    error,
    refresh: fetchCounts
  };
}

/**
 * Hook for template submission with status tracking
 */
export function useTemplateSubmission() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const submit = useCallback(async (templateId: string) => {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await post(`/templates/${templateId}/submit`, {});
      
      if (response.success) {
        setResult({
          success: true,
          message: response.message,
          metaTemplateName: response.metaTemplateName,
          estimatedApprovalTime: response.estimatedApprovalTime,
          warnings: response.warnings
        });
        return response;
      }
    } catch (err: any) {
      const errorData = err || {};
      setError({
        message: errorData.message || 'Failed to submit template',
        code: errorData.code,
        helpText: errorData.helpText,
        errors: errorData.errors
      });
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSubmitting(false);
    setError(null);
    setResult(null);
  }, []);

  return {
    submit,
    submitting,
    error,
    result,
    reset
  };
}

export default useTemplateStatus;
