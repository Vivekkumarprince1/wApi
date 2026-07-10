"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Info,
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

interface SMSComposerProps {
  onSendMessage: (text: string, extraData?: any) => void;
  onSendMedia: (file: File) => void;
  isSending: boolean;
  disabled: boolean;
  onTyping: () => void;
  conversationId?: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  charCount: number;
}

const SMS_CHAR_LIMIT = 160;
const SMS_LONG_CHAR_LIMIT = 918; // 6 concatenated messages

export default function SMSComposer({
  onSendMessage,
  onSendMedia,
  isSending,
  disabled,
  onTyping,
  conversationId,
}: SMSComposerProps) {
  const [text, setText] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate character count and SMS segments
  const charCount = text.length;
  const smsSegments = Math.max(1, Math.ceil(charCount / SMS_CHAR_LIMIT));
  const remainingChars = (SMS_CHAR_LIMIT - (charCount % SMS_CHAR_LIMIT)) % SMS_CHAR_LIMIT || SMS_CHAR_LIMIT;
  const isOverLimit = charCount > SMS_LONG_CHAR_LIMIT;

  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const data = await fetchTemplatesByChannel('sms', 10);
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load SMS templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, [conversationId, loadTemplates]);

  const handleSend = () => {
    if ((!text.trim() && !selectedFile) || disabled || isSending || isOverLimit) return;

    if (selectedFile) {
      onSendMedia(selectedFile);
      setSelectedFile(null);
      setPreview(null);
    } else {
      onSendMessage(text, { channel: 'sms', segments: smsSegments });
    }
    setText('');
    setShowTemplates(false);
  };

  const handleTemplateSelect = (template: Template) => {
    setText(template.content);
    setShowTemplates(false);
    if (textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // SMS only supports certain media types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type for SMS. Supported: Images, Audio, Video, PDF');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit for SMS media
      toast.error('File size too large. Max 5MB for SMS media');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const insertAtCursor = (insert: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + insert + text.substring(end);

    setText(newText);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + insert.length;
      textarea.focus();
    }, 0);
  };

  return (
    <div className="w-full border-t border-gray-200 bg-white p-4">
      {/* Selected File Preview */}
      {selectedFile && preview && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 p-3"
        >
          <div className="flex items-center gap-3">
            {preview.startsWith('data:image/') ? (
              <img src={preview} alt="preview" className="h-12 w-12 rounded object-cover" />
            ) : (
              <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center">
                <Paperclip className="h-6 w-6 text-gray-400" />
              </div>
            )}
            <div className="text-sm">
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearFile}
            disabled={isSending}
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </motion.div>
      )}

      {/* Character Counter & SMS Segment Info */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className={`text-sm font-medium ${
              isOverLimit ? 'text-red-600' : charCount > 140 ? 'text-amber-600' : 'text-gray-600'
            }`}>
              {charCount} / {SMS_LONG_CHAR_LIMIT} characters
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={smsSegments === 1 ? 'default' : 'secondary'}>
              {smsSegments} SMS{smsSegments > 1 ? 's' : ''}
            </Badge>
            {remainingChars > 0 && !isOverLimit && (
              <Badge variant="outline">
                {remainingChars} remaining
              </Badge>
            )}
          </div>
        </div>

        {/* Warning Messages */}
        {isOverLimit && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-700"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Message exceeds SMS length limit (max 918 characters)</span>
          </motion.div>
        )}

        {smsSegments > 1 && smsSegments <= 6 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-lg bg-blue-50 p-2 text-sm text-blue-700"
          >
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>
              Message will be sent as {smsSegments} concatenated SMS. Recipient may be charged {smsSegments} credits.
            </span>
          </motion.div>
        )}

        {smsSegments > 6 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-700"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              Consider splitting this message ({smsSegments} segments would be required)
            </span>
          </motion.div>
        )}
      </div>

      {/* Text Input */}
      <div className="mb-3 relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          placeholder="Type SMS message (160 characters per segment)..."
          className="resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          rows={3}
          disabled={disabled || isSending || isOverLimit}
          maxLength={SMS_LONG_CHAR_LIMIT}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* Attachment Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isSending}
            title="Attach file (images, audio, video, PDF)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,audio/*,video/*,.pdf"
            disabled={disabled || isSending}
          />

          {/* Templates Dropdown */}
          {templates.length > 0 && (
            <DropdownMenu open={showTemplates} onOpenChange={setShowTemplates}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || isSending || loadingTemplates}
                >
                  {loadingTemplates ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Smile className="h-4 w-4" />
                  )}
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
                      {template.content}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || isSending}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => insertAtCursor('[Name]')}>
                Insert {'{Name}'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertAtCursor('[Phone]')}>
                Insert {'{Phone}'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertAtCursor('[Company]')}>
                Insert {'{Company}'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setText('');
                  setSelectedFile(null);
                  setPreview(null);
                }}
              >
                Clear Message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={disabled || isSending || !text.trim() || isOverLimit}
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
              Send SMS
            </>
          )}
        </Button>
      </div>

      {/* Help Text */}
      <div className="mt-2 text-xs text-gray-500">
        💡 Tips: SMS messages are limited to 160 characters. Longer messages will be split into multiple segments. Media files must be under 5MB.
      </div>
    </div>
  );
}
