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
    <div className="p-4 bg-background">
      <div className={`relative flex flex-col rounded-2xl border transition-all duration-300 ${internalNoteMode ? 'bg-amber-50/30 dark:bg-amber-900/10 border-amber-500/30 shadow-lg shadow-amber-500/5' : 'bg-muted/30 border-border shadow-sm'}`}>
        
        {/* Main Composition Area */}
        <div className="relative p-2">
          {selectedMedia && (
            <div className="m-2 p-2.5 rounded-xl bg-background/80 backdrop-blur-sm border border-border/40 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <FaFileAlt size={14} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-foreground truncate max-w-[240px]">{selectedMedia.name}</p>
                </div>
              </div>
              <button onClick={clearSelectedMedia} className="w-8 h-8 flex items-center justify-center hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10">
                <FaTimes size={12} />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={internalNoteMode ? 'Add a private team note...' : 'Type a message...'}
            className="w-full min-h-[80px] max-h-[250px] bg-transparent border-none px-4 py-2 text-[14px] focus:ring-0 resize-none text-foreground placeholder:text-muted-foreground/30 leading-relaxed font-medium transition-all"
            rows={1}
            disabled={sending}
          />

          {/* Integrated Toolbars - Not divided by lines */}
          <div className="mt-2 flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1.5 bg-background/40 p-1 rounded-xl border border-border/10">
              <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-border/20">
                <button
                  type="button"
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${selectedMedia ? 'text-primary bg-primary/10' : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted'}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Attach"
                >
                  <FaPaperclip className="text-sm" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${showEmojiPicker ? 'text-primary bg-primary/10' : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted'}`}
                  title="Emoji"
                >
                  <FaSmile className="text-sm" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${showQuickReplies ? 'text-primary bg-primary/10' : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted'}`}
                  disabled={internalNoteMode}
                  title="Quick Reply"
                >
                  <FaBolt className="text-sm" />
                </button>
              </div>

              <div className="flex items-center p-0.5">
                <button
                  onClick={() => setInternalNoteMode(false)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${!internalNoteMode ? 'bg-white dark:bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Reply
                </button>
                <button
                  onClick={() => setInternalNoteMode(true)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${internalNoteMode ? 'bg-amber-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Note
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.1em]">Enter to Send</span>
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!bspReady || sending || (!newMessage.trim() && !selectedMedia)}
                className={`h-10 px-6 rounded-xl flex items-center gap-3 transition-all font-black text-[10px] uppercase tracking-[0.1em] shadow-lg active:scale-95 ${internalNoteMode
                  ? (newMessage.trim() ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20' : 'bg-muted text-muted-foreground/20 cursor-not-allowed')
                  : ((newMessage.trim() || selectedMedia) && !sending && bspReady
                    ? 'bg-primary text-white shadow-primary/20 hover:brightness-105'
                    : 'bg-muted text-muted-foreground/20 cursor-not-allowed')
                }`}
              >
                {sending ? <FaSpinner className="animate-spin text-xs" /> : (
                  <>
                    <span>Send Message</span>
                    <FaPaperPlane size={11} className="-rotate-12" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Popups (Floating - no dividing lines) */}
          <AnimatePresence>
            {showMentions && agents && filteredAgents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute bottom-full mb-3 bg-card border border-border rounded-xl z-50 shadow-2xl overflow-hidden w-64"
                style={{ left: Math.min(Math.max(20, mentionCoords.left), 300) }}
              >
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <FaAt className="text-[9px]" /> Mention
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredAgents.map((agent, i) => (
                    <button
                      key={agent._id || `agent-${i}`}
                      onClick={() => insertMention(agent)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-primary/5 transition-colors border-l-2 border-transparent hover:border-primary"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                        {agent.name ? agent.name.charAt(0) : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold truncate text-foreground">{agent.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate font-medium">{agent.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95, originY: 'bottom' }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute bottom-full mb-3 left-4 w-72 bg-card border border-border shadow-2xl rounded-2xl z-50 p-4"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Emoji</p>
                  <button onClick={() => setShowEmojiPicker(false)} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Close</button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {emojiOptions.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="h-9 rounded-lg hover:bg-primary/10 transition-all text-xl flex items-center justify-center hover:scale-110">
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
                className="absolute bottom-full mb-3 left-4 w-80 bg-card border border-border shadow-2xl rounded-2xl z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Quick Replies</p>
                  <span className="text-[9px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{filteredQuickReplies.length}</span>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
                  {filteredQuickReplies.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground italic text-xs">No replies found.</div>
                  ) : (
                    filteredQuickReplies.map((reply, idx) => (
                      <button
                        key={reply._id || `reply-${idx}`}
                        onClick={() => handleSelectQuickReply(reply)}
                        className={`w-full text-left px-3 py-3 rounded-xl transition-all border ${newMessage.startsWith('/') && idx === 0 ? 'bg-primary/5 border-primary/20 shadow-sm' : 'hover:bg-muted border-transparent'}`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[12px] font-bold text-foreground">/{reply.name.toLowerCase().replace(/\s+/g, '-')}</p>
                          <span className="text-[9px] font-black opacity-30 uppercase tracking-tighter">shortcut</span>
                        </div>
                        <p className="text-[11px] line-clamp-1 text-muted-foreground font-medium">{reply.content}</p>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    // </div>
  );
}
