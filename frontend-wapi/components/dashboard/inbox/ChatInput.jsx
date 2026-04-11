import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaComments, 
  FaFlag, 
  FaTimes, 
  FaSmile, 
  FaPaperclip, 
  FaBolt, 
  FaFileAlt, 
  FaSpinner, 
  FaPaperPlane,
  FaAt
} from 'react-icons/fa';

export default function ChatInput({
  newMessage,
  handleInputChange,
  handleSendMessage,
  internalNoteMode,
  setInternalNoteMode,
  mediaPreview,
  clearSelectedMedia,
  selectedMedia,
  isUploading,
  fileInputRef,
  showQuickReplies,
  setShowQuickReplies,
  quickReplies = [],
  handleSelectQuickReply,
  bspReady,
  sending,
  handleMediaSelect,
  agents = []
}) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionCoords, setMentionCoords] = useState({ top: 0, left: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const emojiOptions = ['😀', '😄', '😎', '😍', '😂', '🥳', '🙏', '👍', '🔥', '💯', '🎉', '✅'];

  // Deriving filtered lists for power-user commands
  const qrQuery = (newMessage.match(/\/([a-zA-Z0-9_]*)$/) || [])[1] || '';
  const filteredQuickReplies = qrQuery && !internalNoteMode
    ? quickReplies.filter(r => 
        r.name.toLowerCase().includes(qrQuery.toLowerCase()) || 
        r.content.toLowerCase().includes(qrQuery.toLowerCase())
      )
    : quickReplies;

  const filteredAgents = agents.filter(a => 
    a.name?.toLowerCase().includes(mentionFilter) || 
    a.email?.toLowerCase().includes(mentionFilter)
  );

  // Parse mentions and quick reply shortcuts when typing
  useEffect(() => {
    const cursorPosition = textareaRef.current?.selectionStart;
    if (cursorPosition === undefined) return;

    const textBeforeCursor = newMessage.slice(0, cursorPosition);
    
    // 1. Mentions (@)
    if (internalNoteMode) {
      const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
      if (mentionMatch) {
        setMentionFilter(mentionMatch[1].toLowerCase());
        setShowMentions(true);
        setMentionCoords({ left: Math.min(200, mentionMatch[1].length * 8 + 20) });
      } else {
        setShowMentions(false);
      }
    }

    // 2. Quick Replies (/)
    const qrMatch = textBeforeCursor.match(/\/([a-zA-Z0-9_]*)$/);
    if (qrMatch && !internalNoteMode) {
      setShowQuickReplies(true);
    }
  }, [newMessage, internalNoteMode, setShowQuickReplies]);

  const insertMention = (agent) => {
    const cursorPosition = textareaRef.current?.selectionStart || newMessage.length;
    const textBeforeCursor = newMessage.slice(0, cursorPosition);
    const textAfterCursor = newMessage.slice(cursorPosition);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtPos !== -1) {
      const newText = textBeforeCursor.slice(0, lastAtPos) + `@${agent.name} ` + textAfterCursor;
      handleInputChange({ target: { value: newText } });
    }
    
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const insertEmoji = (emoji) => {
    const cursorPosition = textareaRef.current?.selectionStart || newMessage.length;
    const newText = `${newMessage.slice(0, cursorPosition)}${emoji}${newMessage.slice(cursorPosition)}`;
    handleInputChange({ target: { value: newText } });
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Mention Tab/Enter
    if (showMentions && filteredAgents.length > 0) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredAgents[0]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    // Quick Reply Tab/Enter
    if (showQuickReplies && filteredQuickReplies.length > 0) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (qrQuery.length > 0) {
          e.preventDefault();
          handleSelectQuickReply(filteredQuickReplies[0]);
          return;
        }
      }
      if (e.key === 'Escape') {
        setShowQuickReplies(false);
        return;
      }
    }

    // Standard Message Send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() || selectedMedia) handleSendMessage(e);
    }
  };

  return (
    <div className={`p-5 flex flex-col gap-3 border-t border-border/50 z-30 w-full relative transition-all duration-500 ${internalNoteMode ? 'bg-amber-500/5' : 'bg-card/40 backdrop-blur-md'}`}>
      
      {/* Mode Toggles */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={() => setInternalNoteMode(false)}
          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 border ${!internalNoteMode 
            ? 'bg-primary text-white border-primary shadow-[0_4px_12px_rgba(20,184,166,0.3)] scale-105' 
            : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted active:scale-95'}`}
        >
          <FaComments size={12} /> Message
        </button>
        <button
          onClick={() => setInternalNoteMode(true)}
          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 border ${internalNoteMode 
            ? 'bg-amber-500 text-white border-amber-500 shadow-[0_4px_12px_rgba(245,158,11,0.3)] scale-105' 
            : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted active:scale-95'}`}
        >
          <FaFlag size={12} /> Internal Note
        </button>
      </div>

        <div className="flex items-center gap-1.5 mb-1 relative">
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(prev => !prev);
              setShowQuickReplies(false);
            }}
            title="Emoji picker"
            className={`p-3 transition-all rounded-xl border ${showEmojiPicker ? 'text-primary bg-primary/10 border-primary/20 shadow-inner scale-105' : 'text-muted-foreground/60 bg-muted/40 hover:text-primary hover:bg-primary/5 hover:border-primary/20 border-transparent'} active:scale-90`}
          >
            <FaSmile className="text-lg" />
          </button>

          <button
            type="button"
            className={`p-3 transition-all rounded-xl border ${selectedMedia ? 'text-primary bg-primary/10 border-primary/20 shadow-inner' : isUploading ? 'text-primary bg-primary/10 animate-pulse border-primary/20' : 'text-muted-foreground/60 bg-muted/40 hover:text-primary hover:bg-primary/5 hover:border-primary/20 border-transparent'} active:scale-90`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <FaPaperclip className="text-lg" />
          </button>

          <button
            type="button"
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className={`p-3 transition-all rounded-xl border ${showQuickReplies ? 'text-primary bg-primary/10 border-primary/20 shadow-inner scale-105' : 'text-muted-foreground/60 bg-muted/40 hover:text-primary hover:bg-primary/5 hover:border-primary/20 border-transparent'} active:scale-90`}
          >
            <FaBolt className="text-lg" />
          </button>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleMediaSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.gif,.webp"
          />

          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95, originY: 'bottom' }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full mb-6 left-0 w-72 bg-card/95 backdrop-blur-xl border border-border shadow-premium rounded-2xl z-50 p-3 overflow-hidden"
              >
                <div className="px-2 py-2 border-b border-border/50 mb-2 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-50">Emoji Picker</p>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="h-10 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showQuickReplies && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95, originY: 'bottom' }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute bottom-full mb-6 left-0 w-80 bg-card/95 backdrop-blur-xl border border-border shadow-premium rounded-2xl z-50 p-2 overflow-hidden"
              >
                <div className="px-3 py-3 border-b border-border/50 mb-2 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-50">Quick Replies (Type / to search)</p>
                  <span className="text-[9px] font-bold bg-muted px-2 py-0.5 rounded-full">{filteredQuickReplies.length}</span>
                </div>
                <div className="max-h-64 overflow-y-auto no-scrollbar flex flex-col gap-1 pr-1">
                  {filteredQuickReplies.length === 0 ? (
                    <div className="px-4 py-8 text-center space-y-3">
                      <p className="text-xs text-muted-foreground font-medium italic">No quick replies found.</p>
                      <Link
                        href="/dashboard/settings/quick-replies"
                        className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-primary/10 text-primary text-[11px] font-black uppercase tracking-[0.14em] hover:bg-primary/15 transition-colors"
                      >
                        Create in Settings
                      </Link>
                    </div>
                  ) : (
                    filteredQuickReplies.map((reply, idx) => (
                      <button
                        key={reply._id || `reply-${idx}`}
                        onClick={() => handleSelectQuickReply(reply)}
                        className={`w-full text-left px-3.5 py-3 rounded-xl group transition-all border ${newMessage.startsWith('/') && idx === 0 ? 'bg-primary/10 border-primary/20' : 'hover:bg-primary/5 border-transparent hover:border-primary/10'}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-[13px] font-black tracking-tight ${newMessage.startsWith('/') && idx === 0 ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>{reply.name}</p>
                          <span className="text-[9px] font-black opacity-30 group-hover:opacity-100 uppercase">/{reply.name.toLowerCase().replace(/\s+/g, '-')}</span>
                        </div>
                        <p className={`text-[11px] line-clamp-1 mt-1 font-medium ${newMessage.startsWith('/') && idx === 0 ? 'text-primary/70' : 'text-muted-foreground group-hover:text-primary/70'}`}>{reply.content}</p>
                      </button>
                    ))
                  )}
                </div>
                <div className="px-3 pt-2 pb-1 border-t border-border/50 mt-2 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-[0.18em]">Stored in Settings</p>
                  <Link href="/dashboard/settings/quick-replies" className="text-[10px] font-black uppercase tracking-[0.14em] text-primary hover:underline">
                    Open Manager
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={`flex-1 rounded-2xl shadow-inner border transition-all duration-500 overflow-hidden relative group/input ${internalNoteMode 
          ? 'bg-amber-500/5 border-amber-500/20 focus-within:ring-4 focus-within:ring-amber-500/5 focus-within:border-amber-500/40' 
          : 'bg-muted/40 border-border/40 focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/30'}`}>
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={internalNoteMode ? "Add a private team note... (Type @ to mention)" : "Type a message..."}
            className="w-full max-h-40 min-h-[48px] bg-transparent border-none py-3.5 px-4 text-[14.5px] focus:ring-0 resize-none text-foreground placeholder:text-muted-foreground/50 font-medium leading-relaxed"
            rows={1}
            disabled={sending}
          />
          
          {/* Mentions Popover */}
          <AnimatePresence>
            {showMentions && agents && filteredAgents.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute bottom-full mb-1 bg-card/95 backdrop-blur-xl border border-border/60 shadow-premium rounded-xl z-50 overflow-hidden w-64"
                style={{ left: Math.min(Math.max(10, mentionCoords.left), 300) }}
              >
                <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                    <FaAt className="text-[9px]" /> Mention
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredAgents.map((agent, i) => (
                    <button
                      key={agent._id || `agent-${i}`}
                      onClick={() => insertMention(agent)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-amber-500/10 transition-colors ${i === 0 ? 'bg-amber-500/5 border-l-2 border-amber-500' : 'border-l-2 border-transparent'}`}
                    >
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-600 uppercase flex-shrink-0">
                        {agent.name ? agent.name.charAt(0) : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold truncate">{agent.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{agent.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={handleSendMessage}
          disabled={!bspReady || sending || (!newMessage.trim() && !selectedMedia)}
          className={`p-3.5 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${internalNoteMode
            ? (newMessage.trim() ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' : 'bg-muted text-muted-foreground/40 cursor-not-allowed')
            : ((newMessage.trim() || selectedMedia) && !sending && bspReady
              ? 'bg-primary hover:brightness-110 text-white shadow-primary/20'
              : 'bg-muted text-muted-foreground/40 cursor-not-allowed')
            }`}
        >
          {sending ? <FaSpinner className="animate-spin text-lg" /> : <FaPaperPlane className="text-lg translate-x-[-1px] translate-y-[1px]" />}
        </button>
      </div>
  );
}
