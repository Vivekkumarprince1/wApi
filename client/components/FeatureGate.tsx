'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FEATURE GATE COMPONENT
 * Blocks access to features based on workspace/role status with Interakt-style UX
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useWorkspace } from '@/lib/useWorkspace';
import { useRouter } from 'next/navigation';
import { FaLock, FaExclamationTriangle, FaWhatsapp, FaUserShield } from 'react-icons/fa';

interface FeatureGateProps {
  feature: 'templates' | 'campaigns' | 'messaging' | 'team' | 'billing' | 'admin' | 'quick-replies' | 'roles' | 'contacts-settings' | 'interactives' | 'products';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  comingSoon?: boolean;  // Mark feature as coming soon
}

/**
 * Wrap any feature with this component to enforce role + workspace gates
 */
export default function FeatureGate({ feature, children, fallback, comingSoon }: FeatureGateProps) {
  const router = useRouter();
  const workspace = useWorkspace();

  // Show loading state while checking permissions
  if (workspace.loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#13C18D]" />
      </div>
    );
  }

  // Coming soon features - show placeholder
  if (comingSoon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FaLock className="text-4xl text-purple-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Coming Soon</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This feature is under development and will be available soon. Stay tuned!
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Determine if blocked and reason
  let blocked = false;
  let reason = '';
  let blockType: 'phone' | 'role' | 'auth' = 'role';

  // Auth check first
  if (!workspace.user) {
    blocked = true;
    reason = 'Please log in to access this feature';
    blockType = 'auth';
  }
  // Feature-specific checks
  else {
    switch (feature) {
      case 'templates':
        if (!workspace.stage1Complete) {
          blocked = true;
          reason = 'Connect your WhatsApp Business number to create and manage templates';
          blockType = 'phone';
        } else if (!['owner', 'manager'].includes(workspace.user.role)) {
          blocked = true;
          reason = 'You need Manager or Owner access to create templates';
          blockType = 'role';
        }
        break;

      case 'campaigns':
        if (!workspace.stage1Complete) {
          blocked = true;
          reason = 'Connect your WhatsApp Business number to create and send campaigns';
          blockType = 'phone';
        } else if (!['owner', 'manager'].includes(workspace.user.role)) {
          blocked = true;
          reason = 'You need Manager or Owner access to create campaigns';
          blockType = 'role';
        }
        break;

      case 'messaging':
        if (!workspace.stage1Complete) {
          blocked = true;
          reason = 'Connect your WhatsApp Business number to send messages';
          blockType = 'phone';
        }
        break;

      case 'team':
        if (!['owner', 'manager'].includes(workspace.user.role)) {
          blocked = true;
          reason = 'You need Manager or Owner access to manage team members';
          blockType = 'role';
        }
        break;

      case 'billing':
        if (workspace.user.role !== 'owner') {
          blocked = true;
          reason = 'Only the workspace Owner can access billing settings';
          blockType = 'role';
        }
        break;

      case 'admin':
        if (workspace.user.role !== 'owner') {
          blocked = true;
          reason = 'Only the workspace Owner can access admin settings';
          blockType = 'role';
        }
        break;
    }
  }

  // If not blocked, render children
  if (!blocked) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default blocked UI - Interakt style
  const icons = {
    phone: <FaWhatsapp className="text-4xl text-[#13C18D]" />,
    role: <FaUserShield className="text-4xl text-yellow-500" />,
    auth: <FaLock className="text-4xl text-red-500" />,
  };

  const actions = {
    phone: {
      label: 'Connect WhatsApp',
      action: () => router.push('/onboarding/connect-whatsapp'),
    },
    role: {
      label: 'Request Access',
      action: () => {
        // Could open a modal to request access from owner
        alert('Please contact your workspace owner to request access.');
      },
    },
    auth: {
      label: 'Log In',
      action: () => router.push('/auth/login'),
    },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          {icons[blockType]}
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          {blockType === 'phone' && 'WhatsApp Connection Required'}
          {blockType === 'role' && 'Access Restricted'}
          {blockType === 'auth' && 'Authentication Required'}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {reason}
        </p>
        
        <button
          onClick={actions[blockType].action}
          className="px-6 py-3 bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
        >
          {actions[blockType].label}
        </button>
        
        {blockType === 'phone' && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            You need to connect your WhatsApp Business number through the Meta Business Suite
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to check if a button should be disabled
 */
export function useFeatureAccess(feature: 'templates' | 'campaigns' | 'messaging' | 'team' | 'billing' | 'admin') {
  const workspace = useWorkspace();
  
  let disabled = false;
  let tooltip = '';

  if (!workspace.user) {
    return { disabled: true, tooltip: 'Please log in', loading: workspace.loading };
  }

  switch (feature) {
    case 'templates':
    case 'campaigns':
      if (!workspace.stage1Complete) {
        disabled = true;
        tooltip = 'Connect WhatsApp first';
      } else if (!['owner', 'manager'].includes(workspace.user.role)) {
        disabled = true;
        tooltip = 'Manager access required';
      }
      break;

    case 'messaging':
      if (!workspace.stage1Complete) {
        disabled = true;
        tooltip = 'Connect WhatsApp first';
      }
      break;

    case 'team':
      if (!['owner', 'manager'].includes(workspace.user.role)) {
        disabled = true;
        tooltip = 'Manager access required';
      }
      break;

    case 'billing':
    case 'admin':
      if (workspace.user.role !== 'owner') {
        disabled = true;
        tooltip = 'Owner access required';
      }
      break;
  }

  return { disabled, tooltip, loading: workspace.loading };
}

/**
 * Simple inline indicator for restricted features
 */
export function FeatureRestricted({ message }: { message?: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs rounded-full">
      <FaExclamationTriangle className="text-xs" />
      <span>{message || 'Restricted'}</span>
    </div>
  );
}
