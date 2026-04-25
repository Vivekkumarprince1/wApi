import React, { useState, useRef } from 'react';
import { FaTimes, FaBriefcase } from 'react-icons/fa';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Users, Eye, Send } from 'lucide-react';
import { uploadContacts } from '@/lib/api';

const TABS = ['individual', 'bulk'];

const CreateContactModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('individual');

  // Individual contact state
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactLoading, setContactLoading] = useState(false);

  // Bulk upload state
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [csvData, setCsvData] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);

  // ── Bulk helpers ────────────────────────────────────────────────────────────

  const parseCsvData = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const contact = { phone_number: '' };
      headers.forEach((header, index) => {
        if (values[index]) {
          switch (header) {
            case 'phone_number':
            case 'phone':
            case 'mobile':
              contact.phone_number = values[index]; break;
            case 'first_name':
            case 'firstname':
              contact.first_name = values[index]; break;
            case 'last_name':
            case 'lastname':
              contact.last_name = values[index]; break;
            case 'email':
              contact.email = values[index]; break;
          }
        }
      });
      if (contact.phone_number) data.push(contact);
    }
    return data;
  };

  const handleFile = (file) => {
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      setUploadedFile(file);
      setUploadStatus('uploading');
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvText = e.target?.result;
        const parsedData = parseCsvData(csvText);
        if (parsedData.length === 0) {
          setUploadStatus('error');
          setTimeout(() => setUploadStatus('idle'), 3000);
          return;
        }
        try {
          await uploadContacts(parsedData);
          setCsvData(parsedData);
          setUploadStatus('success');
          setShowResults(true);
          if (typeof window !== 'undefined' && typeof window.refreshContacts === 'function') {
            window.refreshContacts();
          }
        } catch {
          setUploadStatus('error');
          setTimeout(() => setUploadStatus('idle'), 3000);
        }
      };
      reader.readAsText(file);
    } else {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e) => {
    e.preventDefault();
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const downloadTemplate = () => {
    const csvContent = "phone_number,first_name,last_name,email\n+919876543210,John,Doe,john@example.com\n+919876543211,Jane,Smith,jane@example.com\n+919876543212,Mike,Johnson,mike@example.com";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setUploadStatus('idle');
    setCsvData([]);
    setShowResults(false);
  };

  // ── Individual helpers ──────────────────────────────────────────────────────

  const splitName = (fullName) => {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  };

  const submitSingleContact = async () => {
    setContactError('');
    if (!contactName.trim() || !contactPhone.trim()) {
      setContactError('Name and phone are required');
      return;
    }
    const { firstName, lastName } = splitName(contactName);
    setContactLoading(true);
    try {
      await uploadContacts([{ first_name: firstName, last_name: lastName, phone_number: contactPhone, email: contactEmail }]);
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      if (typeof window !== 'undefined' && typeof window.refreshContacts === 'function') {
        await window.refreshContacts();
      }
      onClose();
    } catch {
      setContactError('Failed to add contact');
    } finally {
      setContactLoading(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const validContacts = csvData.filter(c => c.phone_number);
  const invalidContacts = csvData.length - validContacts.length;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out">
        {/* Green accent bar */}
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-green-500" />

        <div className="h-full flex flex-col">
          {/* ── Header ── */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <FaBriefcase className="text-white text-sm" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Create Contacts</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted hover:bg-border flex items-center justify-center transition-colors"
            >
              <FaTimes className="text-gray-600 text-sm" />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-border px-6 pt-4">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`mr-6 pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'individual' ? 'Individual' : 'Bulk Upload'}
              </button>
            ))}
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ═══════════ INDIVIDUAL TAB ═══════════ */}
            {activeTab === 'individual' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-muted-foreground">
                  Add a single contact by filling in the details below.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Enter contact name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="e.g. +919876543210"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                </div>

                {contactError && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {contactError}
                  </p>
                )}

                <button
                  onClick={submitSingleContact}
                  disabled={contactLoading || !contactName.trim() || !contactPhone.trim()}
                  className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors mt-2 ${
                    !contactLoading && contactName.trim() && contactPhone.trim()
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {contactLoading ? 'Adding…' : 'Add Contact'}
                </button>
              </div>
            )}

            {/* ═══════════ BULK UPLOAD TAB ═══════════ */}
            {activeTab === 'bulk' && (
              <div className="space-y-5">
                {!showResults ? (
                  <>
                    {/* Drop zone */}
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                        dragActive
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : uploadStatus === 'success'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : uploadStatus === 'error'
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                      }`}
                      onDragEnter={() => setDragActive(true)}
                      onDragLeave={() => setDragActive(false)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleDrop}
                    >
                      <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />

                      {uploadStatus === 'error' ? (
                        <div className="space-y-3">
                          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                          <div>
                            <p className="font-semibold text-foreground">Upload failed</p>
                            <p className="text-sm text-muted-foreground mt-1">Please upload a valid CSV file</p>
                          </div>
                        </div>
                      ) : uploadStatus === 'uploading' ? (
                        <div className="space-y-3">
                          <div className="w-12 h-12 mx-auto">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Processing…</p>
                            <p className="text-sm text-muted-foreground mt-1">{uploadedFile?.name}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                          <div>
                            <p className="font-semibold text-foreground">Drop your CSV file here</p>
                            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                          </div>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            Choose File
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Format guide */}
                    <div className="bg-gray-50 dark:bg-card rounded-xl border border-border p-4">
                      <div className="flex items-center mb-2">
                        <FileText className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                        <p className="text-sm font-medium text-foreground">CSV format requirements</p>
                      </div>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        <li>• Phone numbers with country code (+91)</li>
                        <li>• Required column: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">phone_number</code></li>
                        <li>• Optional: first_name, last_name, email</li>
                        <li>• Maximum 10,000 contacts per file</li>
                      </ul>
                      <button
                        onClick={downloadTemplate}
                        className="mt-3 w-full bg-white dark:bg-muted text-foreground border border-border py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-xs font-medium flex items-center justify-center"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download CSV template
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── Results ── */
                  <div className="space-y-5">
                    {/* Summary banner */}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-foreground text-sm">Upload successful!</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Contacts have been processed</p>
                          </div>
                        </div>
                        <button
                          onClick={resetUpload}
                          className="text-xs text-green-700 dark:text-green-400 font-medium hover:underline"
                        >
                          Upload new file
                        </button>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-card border border-border rounded-xl p-3 text-center">
                        <Users className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                        <p className="text-xl font-bold text-foreground">{validContacts.length}</p>
                        <p className="text-xs text-muted-foreground">Valid contacts</p>
                      </div>
                      <div className="bg-card border border-border rounded-xl p-3 text-center">
                        <AlertCircle className="w-6 h-6 text-orange-400 mx-auto mb-1" />
                        <p className="text-xl font-bold text-foreground">{invalidContacts}</p>
                        <p className="text-xs text-muted-foreground">Invalid entries</p>
                      </div>
                    </div>

                    {/* Preview table */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 dark:bg-background border-b border-border flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">Preview</p>
                        <div className="flex gap-2">
                          <button className="flex items-center px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">
                            <Eye className="w-3 h-3 mr-1" /> Preview campaign
                          </button>
                          <button className="flex items-center px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs">
                            <Send className="w-3 h-3 mr-1" /> Send messages
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 dark:bg-background">
                            <tr>
                              {['Phone', 'First', 'Last', 'Status'].map(h => (
                                <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {validContacts.slice(0, 10).map((contact, i) => (
                              <tr key={i} className="hover:bg-accent">
                                <td className="px-3 py-2 font-medium text-foreground">{contact.phone_number}</td>
                                <td className="px-3 py-2 text-muted-foreground">{contact.first_name || '—'}</td>
                                <td className="px-3 py-2 text-muted-foreground">{contact.last_name || '—'}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">Valid</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {validContacts.length > 10 && (
                        <div className="px-4 py-2 border-t border-border bg-gray-50 dark:bg-background text-center">
                          <p className="text-xs text-muted-foreground">
                            Showing 10 of {validContacts.length} contacts.{' '}
                            <button className="text-green-600 hover:text-green-700 font-medium">View all</button>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateContactModal;