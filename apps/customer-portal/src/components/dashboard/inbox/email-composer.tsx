"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Clock,
  Loader2,
  X,
  Plus,
  AlertCircle,
  CheckCircle2,
  Mail,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { fetchTemplatesByChannel } from '@/lib/api/templates';

interface EmailComposerProps {
  onSendMessage: (data: EmailMessage) => void;
  onSendMedia: (file: File) => void;
  isSending: boolean;
  disabled: boolean;
  onTyping: () => void;
  conversationId?: string;
}

interface EmailMessage {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: File[];
  templateId?: string;
  scheduledFor?: Date;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  html?: string;
}

export default function EmailComposer({
  onSendMessage,
  onSendMedia,
  isSending,
  disabled,
  onTyping,
  conversationId,
}: EmailComposerProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [useHtml, setUseHtml] = useState(false);
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);
      const data = await fetchTemplatesByChannel('email', 10);
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load email templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [conversationId]);

  const handleSend = () => {
    if (!subject.trim() || !(useHtml ? htmlBody.trim() : body.trim()) || disabled || isSending) {
      toast.error('Subject and message body are required');
      return;
    }

    const messageData: EmailMessage = {
      to: '', // Will be filled by conversation context
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      subject,
      body: useHtml ? htmlBody : body,
      html: useHtml ? htmlBody : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      scheduledFor: scheduledFor || undefined,
    };

    onSendMessage(messageData);
    resetForm();
  };

  const resetForm = () => {
    setSubject('');
    setBody('');
    setHtmlBody('');
    setCc([]);
    setBcc([]);
    setCcInput('');
    setBccInput('');
    setAttachments([]);
    setShowTemplates(false);
    setScheduledFor(null);
    setShowHtmlEditor(false);
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSubject(template.subject);
    if (template.html) {
      setHtmlBody(template.html);
      setUseHtml(true);
    } else {
      setBody(template.body);
      setUseHtml(false);
    }
    setShowTemplates(false);
  };

  const handleAddCc = () => {
    if (ccInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ccInput.trim())) {
      setCc([...cc, ccInput.trim()]);
      setCcInput('');
    } else {
      toast.error('Please enter a valid email address');
    }
  };

  const handleAddBcc = () => {
    if (bccInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bccInput.trim())) {
      setBcc([...bcc, bccInput.trim()]);
      setBccInput('');
    } else {
      toast.error('Please enter a valid email address');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Email supports most file types, limit to 25MB per file
    const validFiles = files.filter((file) => {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 25MB per file)`);
        return false;
      }
      return true;
    });

    if (attachments.length + validFiles.length > 10) {
      toast.error('Maximum 10 attachments allowed');
      return;
    }

    setAttachments([...attachments, ...validFiles]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full border-t border-gray-200 bg-white">
      {/* Subject Line */}
      <div className="border-b border-gray-200 p-4">
        <input
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            onTyping();
          }}
          placeholder="Email subject"
          className="w-full border-0 text-lg font-semibold focus:outline-none focus:ring-0 placeholder-gray-400"
          disabled={disabled || isSending}
        />
      </div>

      {/* CC/BCC Fields */}
      {(cc.length > 0 || bcc.length > 0) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-b border-gray-200 px-4 py-2"
        >
          {cc.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {cc.map((email, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {email}
                  <button
                    onClick={() => setCc(cc.filter((_, i) => i !== idx))}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {bcc.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bcc.map((email, idx) => (
                <Badge key={idx} variant="outline" className="gap-1">
                  BCC: {email}
                  <button
                    onClick={() => setBcc(bcc.filter((_, i) => i !== idx))}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Attachments Display */}
      {attachments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-b border-gray-200 bg-gray-50 p-3"
        >
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Attachments ({attachments.length})
          </h3>
          <div className="space-y-2">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded bg-white p-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveAttachment(idx)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Body Editor */}
      <div className="p-4">
        {useHtml ? (
          <textarea
            value={htmlBody}
            onChange={(e) => {
              setHtmlBody(e.target.value);
              onTyping();
            }}
            placeholder="Compose your HTML email..."
            className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
            rows={8}
            disabled={disabled || isSending}
          />
        ) : (
          <Textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              onTyping();
            }}
            placeholder="Compose your email message..."
            className="resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            rows={8}
            disabled={disabled || isSending}
          />
        )}
      </div>

      {/* Toolbar */}
      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Attach File */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending || attachments.length >= 10}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Attach ({attachments.length})
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              multiple
              disabled={disabled || isSending}
            />

            {/* Templates */}
            {templates.length > 0 && (
              <DropdownMenu open={showTemplates} onOpenChange={setShowTemplates}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || isSending || loadingTemplates}
                  >
                    {loadingTemplates ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    Templates
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {templates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="flex flex-col items-start"
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-gray-500 truncate max-w-40">
                        {template.subject}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* More Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  More...
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    setCcInput('');
                    setCc(cc.length === 0 ? [''] : []);
                  }}
                >
                  {cc.length > 0 ? 'Remove CC' : 'Add CC'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setBccInput('');
                    setBcc(bcc.length === 0 ? [''] : []);
                  }}
                >
                  {bcc.length > 0 ? 'Remove BCC' : 'Add BCC'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSchedule(!showSchedule)}>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Send
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setUseHtml(!useHtml)}
                >
                  {useHtml ? 'Plain Text' : 'HTML Editor'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSubject('');
                    setBody('');
                    setHtmlBody('');
                  }}
                >
                  Clear All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right Actions - Send Button */}
          <Button
            onClick={handleSend}
            disabled={disabled || isSending || !subject.trim() || !(useHtml ? htmlBody.trim() : body.trim())}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </div>

        {/* CC/BCC Input Section */}
        {(cc.length === 0 || bcc.length === 0) && (cc.length > 0 || bcc.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 flex flex-wrap gap-2"
          >
            {cc.length === 0 && (
              <div className="flex gap-1">
                <input
                  type="email"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCc()}
                  placeholder="Add CC..."
                  className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddCc}
                  disabled={!ccInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {bcc.length === 0 && (
              <div className="flex gap-1">
                <input
                  type="email"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddBcc()}
                  placeholder="Add BCC..."
                  className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddBcc}
                  disabled={!bccInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Schedule Section */}
        {showSchedule && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 rounded-lg bg-blue-50 p-3"
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule for later:
            </label>
            <input
              type="datetime-local"
              onChange={(e) => setScheduledFor(e.target.value ? new Date(e.target.value) : null)}
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              min={new Date().toISOString().slice(0, 16)}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
