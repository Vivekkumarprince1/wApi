"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Send, 
  Paperclip, 
  Smile, 
  StickyNote, 
  Layout, 
  Zap, 
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  Box,
  Gift,
  MapPin,
  User,
  Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ChatInputProps {
  onSendMessage: (text: string, isNote: boolean, extraData?: any) => void;
  onSendMedia: (file: File) => void;
  isSending: boolean;
  disabled: boolean;
  onTyping: () => void;
}

export default function ChatInput({ 
  onSendMessage, 
  onSendMedia, 
  isSending, 
  disabled, 
  onTyping 
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileAccept, setFileAccept] = useState('*/*');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'stickers' | 'gifs'>('stickers');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if ((!text.trim() && !selectedFile) || disabled || isSending) return;
    
    if (selectedFile) {
      // Mock sticker/gif detection based on type or extension if needed, 
      // but usually let the backend handle media detection
      onSendMedia(selectedFile);
      setSelectedFile(null);
      setPreview(null);
    } else {
      onSendMessage(text, isNote);
    }
    setText('');
    setIsNote(false);
    setShowEmojiPicker(false);
    setShowMediaPicker(false);
  };

  const validateFileType = (file: File, accept: string) => {
    if (accept === '*/*') return true;
    const acceptedTypes = accept.split(',').map(t => t.trim());
    
    return acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      if (type.endsWith('/*')) {
        const baseType = type.split('/')[0];
        return file.type.startsWith(`${baseType}/`);
      }
      return file.type === type;
    });
  };

  const handleSendLocationMock = () => {
    onSendMessage('📍 Shared Location', false, {
       type: 'location',
       location: {
         latitude: 28.6139,
         longitude: 77.2090,
         name: "Connaught Place",
         address: "New Delhi, Delhi 110001"
       }
    });
  };

  const handleSendContactMock = () => {
    onSendMessage('👤 Shared Contact', false, {
       type: 'contacts',
       contacts: [{
          name: { first_name: "Vivek", last_name: "Admin", formatted_name: "Vivek Admin" },
          phones: [{ phone: "+919999999999", type: "WORK" }]
       }]
    });
  };

  const handleSendPixMock = () => {
    onSendMessage('💳 PIX Payment', false, {
       type: 'pix',
       pix: {
         amount: "150.00",
         currency: "BRL",
         transaction_id: `PIX-${Math.random().toString(36).substring(7).toUpperCase()}`
       }
    });
  };

  const handleSendBoletoMock = () => {
    onSendMessage('📄 Boleto Payment', false, {
       type: 'boleto',
       boleto: {
         amount: "250.00",
         currency: "BRL",
         transaction_id: `BOL-${Math.random().toString(36).substring(7).toUpperCase()}`
       }
    });
  };

  const handleOpenPicker = (mode: 'all' | 'media' | 'document' | 'audio') => {
    if (mode === 'media') {
      setFileAccept('image/*,video/*');
    } else if (mode === 'document') {
      setFileAccept('.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv');
    } else if (mode === 'audio') {
      setFileAccept('audio/*');
    } else {
      setFileAccept('*/*');
    }
    
    // We use a small timeout to ensure the accept attribute is updated on the DOM before the system dialog opens
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 10);
  };

  const insertEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const emojis = ['😀', '😄', '😎', '😍', '😂', '🥳', '🙏', '👍', '🔥', '💯', '🎉', '✅', '❤️', '✨', '🚀', '⭐', '👋', '🙌', '👏', '👀', '💡', '📌', '📅', '💬'];
  const stickers = [
    { name: 'Happy', emoji: '😊' },
    { name: 'Cool', emoji: '😎' },
    { name: 'Love', emoji: '❤️' },
    { name: 'Success', emoji: '🚀' },
    { name: 'Wow', emoji: '😲' },
    { name: 'Done', emoji: '✅' }
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Strict validation based on current mode
      if (!validateFileType(file, fileAccept)) {
        toast.error(`Selection rejected: Please pick a file matching "${fileAccept}"`);
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(file));
      } else {
        setPreview(null);
      }
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className="p-4 bg-card border-t border-border/50 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Attachment Preview */}
        <AnimatePresence>
          {selectedFile && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="p-3 bg-muted/50 rounded-2xl flex items-center gap-4 relative group border border-border/50"
            >
              <div className="h-12 w-12 rounded-xl bg-background overflow-hidden border border-border/50 flex items-center justify-center">
                 {preview ? <img src={preview} className="w-full h-full object-cover" /> : <FileText className="h-6 w-6 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                 <p className="text-xs font-black truncate">{selectedFile.name}</p>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setSelectedFile(null); setPreview(null); }}
                className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-3 relative">
          <div className="flex items-center gap-1 mb-1">
             <DropdownMenu>
                <DropdownMenuTrigger className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/50 hover:bg-muted transition-all cursor-pointer outline-none">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-2xl p-2 shadow-premium border-border/50">
                   <DropdownMenuItem className="rounded-xl font-bold gap-3 h-11 cursor-pointer" onClick={() => handleOpenPicker('media')}>
                     <ImageIcon className="h-4 w-4 text-blue-500" /> Image or Video
                   </DropdownMenuItem>
                   <DropdownMenuItem className="rounded-xl font-bold gap-3 h-11 cursor-pointer" onClick={() => handleOpenPicker('document')}>
                     <FileText className="h-4 w-4 text-emerald-500" /> Document
                   </DropdownMenuItem>
                   <DropdownMenuItem className="rounded-xl font-bold gap-3 h-11 cursor-pointer" onClick={() => handleOpenPicker('audio')}>
                     <Mic className="h-4 w-4 text-sky-500" /> Audio
                   </DropdownMenuItem>
                   <DropdownMenuItem className="rounded-xl font-bold gap-3 h-11 cursor-pointer" onClick={handleSendLocationMock}>
                     <MapPin className="h-4 w-4 text-rose-500" /> Location
                   </DropdownMenuItem>
                   <DropdownMenuItem className="rounded-xl font-bold gap-3 h-11 cursor-pointer" onClick={handleSendContactMock}>
                     <User className="h-4 w-4 text-violet-500" /> Contact (vCard)
                   </DropdownMenuItem>
                   <DropdownMenuItem className="rounded-xl font-bold gap-3 h-11 cursor-pointer" onClick={handleSendPixMock}>
                     <Zap className="h-4 w-4 text-emerald-600" /> PIX Session
                   </DropdownMenuItem>
                   <DropdownMenuItem className="rounded-xl font-bold gap-3 h-11 cursor-pointer" onClick={handleSendBoletoMock}>
                     <FileText className="h-4 w-4 text-blue-600" /> Boleto Message
                   </DropdownMenuItem>
                   <DropdownMenuItem className="rounded-xl font-bold gap-3 h-11 cursor-pointer">
                     <Box className="h-4 w-4 text-amber-500" /> Quick Replies
                   </DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>
             
             <Button 
                variant="ghost" 
                size="icon" 
                className={`h-10 w-10 border border-border/50 rounded-xl transition-all ${isNote ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 ring-1 ring-amber-500/30' : 'text-muted-foreground hover:bg-muted'}`}
                onClick={() => setIsNote(!isNote)}
              >
                <StickyNote className="h-5 w-5" />
              </Button>

              <div className="relative">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-10 w-10 border border-border/50 rounded-xl transition-all ${showEmojiPicker ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground hover:bg-muted'}`}
                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowMediaPicker(false); }}
                >
                    <Smile className="h-5 w-5" />
                </Button>
                
                <AnimatePresence>
                    {showEmojiPicker && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full mb-3 left-0 w-64 bg-card border border-border/50 shadow-premium rounded-2xl z-50 p-3"
                        >
                            <div className="grid grid-cols-6 gap-2">
                                {emojis.map(emoji => (
                                    <button 
                                        key={emoji} 
                                        onClick={() => insertEmoji(emoji)}
                                        className="h-8 rounded-lg hover:bg-primary/10 transition-all text-lg flex items-center justify-center hover:scale-110"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-10 w-10 border border-border/50 rounded-xl transition-all ${showMediaPicker ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground hover:bg-muted'}`}
                    onClick={() => { setShowMediaPicker(!showMediaPicker); setShowEmojiPicker(false); }}
                >
                    <Gift className="h-5 w-5" />
                </Button>
                
                <AnimatePresence>
                    {showMediaPicker && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full mb-3 left-0 w-80 bg-card border border-border/50 shadow-premium rounded-2xl z-50 overflow-hidden"
                        >
                            <div className="flex border-b border-border/50 p-1 bg-muted/20">
                                <button 
                                    onClick={() => setActiveMediaTab('stickers')}
                                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeMediaTab === 'stickers' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    Stickers
                                </button>
                                <button 
                                    onClick={() => setActiveMediaTab('gifs')}
                                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeMediaTab === 'gifs' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    GIFs
                                </button>
                            </div>
                            <div className="p-3 max-h-60 overflow-y-auto">
                                {activeMediaTab === 'stickers' ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        {stickers.map(sticker => (
                                            <button 
                                                key={sticker.name}
                                                className="aspect-square rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center hover:bg-primary/5 transition-all group"
                                            >
                                                <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">{sticker.emoji}</span>
                                                <span className="text-[8px] font-black uppercase tracking-tighter opacity-40">{sticker.name}</span>
                                            </button>
                                        ))}
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-square rounded-xl border border-dashed border-border/50 flex flex-col items-center justify-center hover:bg-muted transition-all"
                                        >
                                            <Plus className="h-4 w-4 mb-1 text-muted-foreground" />
                                            <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground">Upload</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4 py-4 text-center">
                                         <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-2">
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground opacity-30" />
                                         </div>
                                         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Fetching Trending GIFs...</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>
          </div>

          <div className="flex-1 relative group">
            {isNote && (
               <div className="absolute top-2 right-4 z-10">
                 <Badge className="bg-amber-500 text-white border-none rounded-full px-2 h-4 text-[8px] font-black uppercase tracking-tighter">Internal Note</Badge>
               </div>
            )}
            <Textarea 
              ref={textareaRef}
              placeholder={isNote ? "Type a note for the team..." : "Type a message..."}
              className={`
                min-h-[48px] max-h-48 rounded-2xl p-4 pr-12 text-sm font-medium border-border/50 transition-all resize-none
                ${isNote ? 'bg-amber-50/50 dark:bg-amber-900/10 focus:ring-amber-500/20 focus:border-amber-500/30' : 'bg-muted/30 focus:bg-background'}
              `}
              value={text}
              onChange={(e) => { setText(e.target.value); onTyping(); }}
              onKeyDown={handleKeyDown}
              disabled={disabled || isSending}
            />
          </div>

          <Button 
            onClick={handleSend}
            disabled={(!text.trim() && !selectedFile) || disabled || isSending}
            className={`
              h-12 w-12 rounded-2xl shadow-lg transition-all flex items-center justify-center p-0
              ${isNote ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'}
            `}
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept={fileAccept}
            className="hidden" 
          />
        </div>
        
        <div className="flex items-center justify-between px-1">
           <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
              <span className="flex items-center gap-1.5"><Layout className="h-3 w-3" /> Templates (/)</span>
              <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Quick Replies (\)</span>
           </div>
           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
             Press Shift+Enter for new line
           </p>
        </div>
      </div>
    </div>
  );
}
