"use client";

import React, { useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface DeleteAccountSectionProps {
  userId: string;
  email: string;
  onSuccess?: () => void;
}

type DeletionStep = 'confirm' | 'verify' | 'processing' | 'completed';

export default function DeleteAccountSection({
  userId,
  email,
  onSuccess,
}: DeleteAccountSectionProps) {
  const [step, setStep] = useState<DeletionStep>('confirm');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeFromEmail, setCodeFromEmail] = useState('');
  const router = useRouter();

  // Request deletion mutation
  const requestDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/account/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to request deletion');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      setStep('verify');
      toast.success('Verification code sent to your email');
    },
    onError: (error) => {
      toast.error((error as Error).message);
    },
  });

  // Confirm deletion mutation
  const confirmDeletionMutation = useMutation({
    mutationFn: async () => {
      if (verificationCode !== codeFromEmail) {
        throw new Error('Verification code is incorrect');
      }

      const response = await fetch('/api/auth/account/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, verificationCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete account');
      }

      return await response.json();
    },
    onSuccess: () => {
      setStep('processing');
      
      // Simulate processing
      setTimeout(() => {
        setStep('completed');
        
        // Redirect after showing completion
        setTimeout(() => {
          onSuccess?.();
          router.push('/auth/login');
        }, 2000);
      }, 2000);
    },
    onError: (error) => {
      toast.error((error as Error).message);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
        <p className="mt-1 text-sm text-gray-600">
          Permanently delete your account and all associated data
        </p>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {step === 'confirm' && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold">Warning: This action cannot be undone</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>• Your account will be permanently deleted</li>
                    <li>• All your data will be removed</li>
                    <li>• All workspaces and conversations will be deleted</li>
                    <li>• This deletion is immediate and irreversible</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="font-semibold text-gray-900 text-sm">What happens next:</h4>
              <ol className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="font-semibold text-gray-900 min-w-6">1.</span>
                  <span>We'll send a verification code to <strong>{email}</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-gray-900 min-w-6">2.</span>
                  <span>Enter the code to confirm deletion</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-gray-900 min-w-6">3.</span>
                  <span>Your account will be deleted immediately</span>
                </li>
              </ol>
            </div>

            <Button
              onClick={() => requestDeletionMutation.mutate()}
              disabled={requestDeletionMutation.isPending}
              variant="destructive"
              className="w-full"
            >
              {requestDeletionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Verification Code...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Delete My Account
                </>
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              You can change your mind at any time before confirming
            </p>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm text-blue-900">
                ✉️ We sent a verification code to <strong>{email}</strong>
              </p>
              <p className="mt-2 text-xs text-blue-800">
                Check your inbox (including spam folder) for the code
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-lg font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                The code will expire in 10 minutes
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Type your verification code again to confirm
              </label>
              <input
                type="text"
                value={codeFromEmail}
                onChange={(e) => setCodeFromEmail(e.target.value.toUpperCase())}
                placeholder="Confirm code"
                maxLength={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-lg font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setStep('confirm');
                  setVerificationCode('');
                  setCodeFromEmail('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => confirmDeletionMutation.mutate()}
                disabled={
                  !verificationCode ||
                  !codeFromEmail ||
                  verificationCode !== codeFromEmail ||
                  confirmDeletionMutation.isPending
                }
                variant="destructive"
                className="flex-1"
              >
                {confirmDeletionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Confirm Deletion
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Loader2 className="h-12 w-12 animate-spin text-red-600 mb-4" />
            <p className="text-lg font-semibold text-gray-900">Deleting your account...</p>
            <p className="mt-2 text-sm text-gray-600">This may take a minute</p>
          </motion.div>
        )}

        {step === 'completed' && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
            <p className="text-lg font-semibold text-gray-900">Account Deleted</p>
            <p className="mt-2 text-sm text-gray-600">
              Your account has been permanently deleted
            </p>
            <p className="mt-4 text-xs text-gray-500">Redirecting to login...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Section */}
      {step === 'confirm' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">Need help?</p>
          <p className="mt-1">
            If you have concerns about your account, please{' '}
            <a href="/support" className="text-blue-600 hover:underline">
              contact support
            </a>{' '}
            before deleting your account.
          </p>
        </div>
      )}
    </div>
  );
}
