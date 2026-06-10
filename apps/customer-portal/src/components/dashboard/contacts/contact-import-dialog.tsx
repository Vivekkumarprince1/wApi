"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  X,
  Loader2,
  Play,
  Pause,
  Trash2,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';

interface ImportProgress {
  jobId: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{ row: number; error: string }>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  speed: number;
}

interface ContactImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CSV_TEMPLATE = `name,email,phone,company,jobTitle,tags
John Doe,john@example.com,+1234567890,Acme Corp,Sales Manager,"vip,hot-lead"
Jane Smith,jane@example.com,+1234567891,Tech Inc,Product Manager,"partner"
Bob Johnson,bob@example.com,+1234567892,Design Co,Designer,"designer,potential"`;

export default function ContactImportDialog({
  isOpen,
  onClose,
  onSuccess,
}: ContactImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'progress'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [preview, setPreview] = useState<any[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Query for progress polling
  const { data: progress, isLoading: isLoadingProgress } = useQuery({
    queryKey: ['import-progress', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const response = await fetch(`/api/contacts/csv-import/${jobId}/progress`);
      if (!response.ok) throw new Error('Failed to fetch progress');
      return (await response.json()).data as ImportProgress;
    },
    enabled: !!jobId && step === 'progress',
    refetchInterval: 1000, // Poll every second
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!csvContent) throw new Error('No CSV content');

      const response = await fetch('/api/contacts/csv-import/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          fileName: csvFile?.name || 'contacts.csv',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('progress');
      toast.success('Import started!');
    },
    onError: (error) => {
      toast.error((error as Error).message || 'Failed to start import');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error('No job ID');
      const response = await fetch(`/api/contacts/csv-import/${jobId}/cancel`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to cancel');
      return await response.json();
    },
    onSuccess: () => {
      setStep('upload');
      setJobId(null);
      toast.success('Import cancelled');
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);

      // Parse CSV for preview
      const lines = content.split('\n').slice(0, 6); // First 5 rows + header
      const headers = lines[0].split(',').map((h) => h.trim());

      const previewData = lines.slice(1).map((line) => {
        const values = line.split(',');
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx]?.trim();
        });
        return row;
      });

      setPreview(previewData.filter((row) => Object.values(row).some((v) => v)));
      setStep('preview');
    };

    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contact-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded!');
  };

  const handleClose = () => {
    if (uploadMutation.isPending || (progress && progress.status === 'processing')) {
      toast.error('Cannot close while import is in progress');
      return;
    }
    setStep('upload');
    setCsvFile(null);
    setCsvContent('');
    setPreview([]);
    setJobId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl rounded-lg bg-white shadow-xl"
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Import Contacts</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={uploadMutation.isPending}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'upload' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 font-semibold text-gray-900">Upload CSV File</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Select a CSV file with contacts to import
                </p>

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4" />
                  Choose File
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="mt-6 border-t border-gray-200 pt-6">
                  <p className="text-sm text-gray-600">
                    Need a template? Download one:
                  </p>
                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                    className="mt-3 gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </div>
              </div>

              {/* CSV Format Info */}
              <div className="rounded-lg bg-blue-50 p-4">
                <h4 className="font-semibold text-blue-900">CSV Format Requirements</h4>
                <ul className="mt-2 space-y-1 text-sm text-blue-800">
                  <li>• First row must contain column headers</li>
                  <li>• Required columns: phone OR email (at least one)</li>
                  <li>• Optional columns: name, company, jobTitle, tags</li>
                  <li>• Additional columns will be saved as custom fields</li>
                  <li>• Max file size: 10MB</li>
                  <li>• Supported format: .csv (comma-separated values)</li>
                </ul>
              </div>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">{csvFile?.name}</p>
                  <p className="text-sm text-green-700">
                    Ready to import {preview.length} contacts
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      {preview[0] &&
                        Object.keys(preview[0]).map((header) => (
                          <th
                            key={header}
                            className="border-b border-gray-200 px-4 py-2 text-left font-semibold text-gray-900"
                          >
                            {header}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        {Object.values(row).map((value: any, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-4 py-2 text-gray-700"
                          >
                            {value || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('upload');
                    setCsvFile(null);
                  }}
                  disabled={uploadMutation.isPending}
                >
                  Back
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending}
                  className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting Import...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Start Import
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'progress' && progress && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Progress Indicators */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-blue-900">
                    {progress.status === 'processing' && (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    )}
                    {progress.status === 'completed' && (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Completed
                      </>
                    )}
                    {progress.status === 'failed' && (
                      <>
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        Failed
                      </>
                    )}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">Speed</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900">
                    {progress.speed.toFixed(1)} rows/sec
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">Progress</p>
                  <p className="text-sm text-gray-600">
                    {progress.processedRows} / {progress.totalRows}
                  </p>
                </div>
                <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-600"
                    animate={{
                      width: `${Math.round((progress.processedRows / progress.totalRows) * 100)}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {Math.round((progress.processedRows / progress.totalRows) * 100)}% complete
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {progress.successfulRows}
                  </p>
                  <p className="text-xs text-green-700">Successful</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {progress.failedRows}
                  </p>
                  <p className="text-xs text-red-700">Failed</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-600">
                    {progress.processedRows}
                  </p>
                  <p className="text-xs text-gray-700">Processed</p>
                </div>
              </div>

              {/* Errors Display */}
              {progress.errors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-lg bg-amber-50 p-4"
                >
                  <button
                    onClick={() => setShowErrors(!showErrors)}
                    className="flex items-center gap-2 font-semibold text-amber-900"
                  >
                    <AlertCircle className="h-5 w-5" />
                    {progress.errors.length} Error{progress.errors.length !== 1 ? 's' : ''}
                    <Eye className="ml-auto h-4 w-4" />
                  </button>

                  {showErrors && (
                    <div className="mt-3 max-h-40 space-y-2 overflow-auto text-sm">
                      {progress.errors.map((error, idx) => (
                        <div key={idx} className="rounded bg-white p-2 text-red-700">
                          <p className="font-medium">Row {error.row}</p>
                          <p className="text-xs">{error.error}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {progress.status === 'processing' && (
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate()}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cancel Import
                  </Button>
                )}

                {progress.status === 'completed' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      className="flex-1"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        onSuccess?.();
                        handleClose();
                      }}
                      className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Done
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
