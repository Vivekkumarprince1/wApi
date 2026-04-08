import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaUser,
  FaInfoCircle,
  FaFlag,
  FaUserCircle,
  FaSpinner,
  FaCheck,
  FaEllipsisV,
  FaFileAlt,
  FaPhoneAlt,
  FaExternalLinkAlt,
  FaClock,
  FaDownload,
  FaCheckDouble
} from 'react-icons/fa';

const getStatusIcon = (status) => {
  switch (status) {
    case 'sent':
      return <FaCheck className="text-muted-foreground/60 text-[10px]" />;
    case 'delivered':
      return <FaCheckDouble className="text-muted-foreground/70 text-[10px]" />;
    case 'read':
      return <FaCheckDouble className="text-sky-400 text-[10px]" />;
    case 'failed':
      return <div className="w-2 h-2 rounded-full bg-destructive" />;
    case 'queued':
    default:
      return <FaClock className="text-muted-foreground/40 text-[10px] animate-pulse" />;
  }
};

const formatDateSeparator = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default function MessageThread({
  selectedContact,
  selectedConversationId,
  selectedConversation,
  messages,
  currentUser,
  typingUsers,
  agents,
  handleAssignConversation,
  handleResolveConversation,
  sending,
  showLabelModal,
  setShowLabelModal,
  handleSetLabel,
  handleClearLabel,
  contactLabels,
  messagesEndRef,
  bspReady,
  workspace
}) {

  // Group messages with date separators and grouping logic
  const renderItems = [];
  let lastDate = null;
  let lastSender = null;
  let lastType = null;

  messages.forEach((message, idx) => {
    const msgDate = new Date(message.createdAt).toDateString();
    const isOutbound = message.direction === 'outbound';
    const senderId = isOutbound ? (message.sentBy?._id || 'agent') : 'contact';

    // Date Separator
    if (msgDate !== lastDate) {
      renderItems.push({
        type: 'date-separator',
        id: `date-${msgDate}`,
        date: formatDateSeparator(message.createdAt)
      });
      lastDate = msgDate;
      lastSender = null; // Reset grouping on new day
    }

    // Is this a system message? (e.g. assignment logs)
    const isSystem = message.type === 'system' || message.isSystem;

    // Is this the start of a new group?
    const isStartOfGroup = senderId !== lastSender || isSystem;

    renderItems.push({
      type: isSystem ? 'system-message' : 'message',
      isStartOfGroup,
      ...message
    });

    if (!isSystem) {
      lastSender = senderId;
    } else {
      lastSender = null;
    }
  });

  // Reverse for flex-col-reverse
  const reversedItems = [...renderItems].reverse();

  return (
    <div className="flex-1 flex flex-col min-h-0 relative border-r border-border shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20 overflow-hidden">
      {!workspace?.loading && !bspReady && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-0 left-0 right-0 z-50 bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between shadow-lg backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
            <FaInfoCircle className="text-lg" />
            <p className="text-xs font-black uppercase tracking-widest">WhatsApp Disconnected • Action Required</p>
          </div>
          <button
            onClick={() => (window.location.href = '/dashboard?connectWhatsApp=1')}
            className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
          >
            Connect Now
          </button>
        </motion.div>
      )}

      {/* Chat Thread Header */}
      <div className={`px-6 py-4 bg-card/80 backdrop-blur-xl border-b border-border/50 flex items-center justify-between sticky top-0 z-30 shadow-sm transition-all ${!bspReady ? 'mt-14' : ''}`}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-primary/20 shadow-inner">
              {selectedContact?.avatarUrl || selectedContact?.avatar ? (
                <img src={selectedContact.avatarUrl || selectedContact.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <FaUser className="text-primary/60 text-xl" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-background rounded-full shadow-sm"></div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-black text-foreground text-[16px] tracking-tight leading-none truncate">
                {selectedContact?.displayName || selectedContact?.name || selectedContact?.phone}
              </h2>

            </div>
            <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest">
              {typingUsers?.[selectedConversationId]?.isTyping && typingUsers[selectedConversationId]?.agentId !== currentUser?._id ? (
                <span className="text-primary animate-pulse">Typing...</span>
              ) : (
                selectedContact?.phone
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Label Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLabelModal(!showLabelModal)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all text-[11px] font-black uppercase tracking-wider ${selectedConversation?.label ? 'border-primary/20 bg-primary/10 text-primary shadow-sm' : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/80'}`}
            >
              <FaFlag size={10} />
              <span>{selectedConversation?.label || 'Label'}</span>
            </button>

            <AnimatePresence>
              {showLabelModal && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute top-full mt-3 right-0 w-52 bg-card/95 backdrop-blur-xl border border-border shadow-premium rounded-2xl overflow-hidden z-50 p-2"
                >
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.15em] px-3 py-2.5 border-b border-border/50 mb-1.5 opacity-50">Choose Segment</p>
                  <div className="max-h-60 overflow-y-auto no-scrollbar">
                    {contactLabels.map((l, idx) => (
                      <button
                        key={l || `label-${idx}`}
                        onClick={() => handleSetLabel(l)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedConversation?.label === l ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground/80'}`}
                      >
                        {l}
                      </button>
                    ))}
                    {selectedConversation?.label && (
                      <button
                        onClick={handleClearLabel}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 mt-2 transition-all border-t border-border/50"
                      >
                        Remove Label
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 border border-border/60 rounded-xl bg-muted/40 backdrop-blur-md">
            <FaUserCircle className="text-muted-foreground/50" />
            <select
              value={selectedConversation?.assignedTo?._id || selectedConversation?.assignedTo || ''}
              onChange={(e) => handleAssignConversation(e.target.value)}
              className="bg-transparent border-none text-[12px] font-bold text-foreground/80 outline-none cursor-pointer pr-4"
            >
              <option value="">Unassigned</option>
              {agents.map((agent, idx) => (
                <option key={agent._id || `agent-${idx}`} value={agent._id}>
                  {agent.name === currentUser?.name ? 'Me' : agent.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-border/40 mx-1 hidden md:block"></div>

          <button
            onClick={handleResolveConversation}
            disabled={sending}
            className="p-2.5 rounded-xl bg-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.2)] text-white hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
            title="Resolve Conversation"
          >
            {sending ? <FaSpinner className="animate-spin text-sm" /> : <FaCheck className="text-sm" />}
          </button>

          <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-all border border-transparent hover:border-border/50">
            <FaEllipsisV className="text-sm" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        className="flex-1 overflow-y-auto pt-6 pb-2 px-4 flex flex-col-reverse relative bg-[#efeae2] dark:bg-[#0b141a] custom-scrollbar transition-colors duration-500"
        style={{
          backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
          backgroundBlendMode: 'overlay',
          backgroundSize: '400px'
        }}
      >
        <div ref={messagesEndRef} className="h-4 flex-shrink-0" />

        <AnimatePresence initial={false}>
          {reversedItems.map((item, idx) => {
            if (item.type === 'date-separator') {
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center my-6"
                >
                  <span className="px-5 py-2 rounded-xl bg-card/60 backdrop-blur-xl border border-border/30 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground shadow-premium">
                    {item.date}
                  </span>
                </motion.div>
              );
            }

            if (item.type === 'system-message') {
              return (
                <motion.div
                  key={item._id || `system-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center my-4 px-10"
                >
                  <span className="px-6 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-black/5 dark:border-white/5 text-[11px] font-bold text-muted-foreground text-center leading-relaxed">
                    {item.body}
                  </span>
                </motion.div>
              );
            }

            const message = item;
            const isOutbound = message.direction === 'outbound';
            const isTemplate = message.type === 'template';
            const hideBodyText = !message.body || message.body === `[${message.type}]` || message.body === '[template]' || (['image', 'video', 'document', 'audio', 'sticker', 'location'].includes(message.type) && message.body === `[${message.type}]`);

            // Media extraction
            let mediaUrl = message.media?.url || message.media?.link || message.meta?.media?.url || message.meta?.media?.link;
            let mediaType = message.type;
            let mediaFilename = message.media?.filename || message.meta?.media?.filename || "Document";

            if (isTemplate && message.meta?.components) {
              const headerComponent = message.meta.components.find(c => c.type === 'header');
              if (headerComponent && headerComponent.parameters?.length > 0) {
                const p = headerComponent.parameters[0];
                if (p.type === 'image' && p.image?.link) {
                  mediaType = 'image';
                  mediaUrl = p.image.link;
                } else if (p.type === 'video' && p.video?.link) {
                  mediaType = 'video';
                  mediaUrl = p.video.link;
                } else if (p.type === 'document' && p.document?.link) {
                  mediaType = 'document';
                  mediaUrl = p.document.link;
                  mediaFilename = p.document.filename || "Document";
                }
              }
            }

            return (
              <motion.div
                key={message._id || `msg-${idx}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} w-full group relative px-2 ${item.isStartOfGroup ? 'mt-4' : 'mt-0.5'}`}
              >
                <div
                  className={`relative max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] shadow-sm transition-all pb-1 ${isOutbound
                    ? 'bg-[#dcf8c6] dark:bg-[#005c4b] text-foreground dark:text-white border-[0.5px] border-black/5'
                    : 'bg-white dark:bg-[#202c33] text-foreground dark:text-white border-[0.5px] border-black/5'
                    } ${item.isStartOfGroup
                      ? (isOutbound ? 'rounded-2xl rounded-tr-none' : 'rounded-2xl rounded-tl-none')
                      : 'rounded-2xl'
                    }`}
                >
                  {/* Message Detail (Tails - only on start of group) */}
                  {item.isStartOfGroup && (
                    <div className={`absolute top-0 w-3 h-4 ${isOutbound ? '-right-2' : '-left-2'}`}>
                      <div className={`w-full h-full ${isOutbound ? 'bg-[#dcf8c6] dark:bg-[#005c4b]' : 'bg-white dark:bg-[#202c33]'}`} style={{ clipPath: isOutbound ? 'polygon(0 0, 0 100%, 100% 0)' : 'polygon(100% 0, 100% 100%, 0 0)' }}></div>
                    </div>
                  )}

                  {/* Enhanced Media Rendering */}
                  {mediaUrl && (
                    <div className="p-1 pb-0">
                      <div className="rounded-xl overflow-hidden bg-black/5">
                        {mediaType === 'image' && (
                          <img src={mediaUrl} alt="media" className="w-full h-auto max-h-[400px] object-cover hover:scale-[1.02] transition-transform duration-500 cursor-zoom-in" />
                        )}
                        {mediaType === 'video' && (
                          <video src={mediaUrl} className="w-full h-auto max-h-[400px]" controls />
                        )}
                        {mediaType === 'document' && (
                          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="p-4 flex items-center gap-4 bg-black/5 hover:bg-black/10 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-md flex items-center justify-center shadow-sm">
                              <FaFileAlt className="text-primary text-xl" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black truncate uppercase tracking-widest">{mediaFilename}</p>
                              <p className="text-[9px] font-black opacity-50 uppercase tracking-widest mt-1">Document Attachment</p>
                            </div>
                            <FaDownload className="text-muted-foreground/40" />
                          </a>
                        )}
                        {mediaType === 'audio' && (
                          <div className="px-2 py-3">
                            <audio src={mediaUrl} controls className={`w-full h-8 ${isOutbound ? 'invert opacity-70' : ''}`} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="px-3 pt-2.5 pb-1 relative">
                    {!hideBodyText && (
                      <div className="text-[14.5px] leading-[1.45] whitespace-pre-wrap font-medium break-words pr-12 kerning-normal">
                        {message.body}
                      </div>
                    )}

                    {/* Timestamp & Status (Anchored to bottom right) */}
                    <div className="flex items-center justify-end gap-1.5 mt-1 -mb-0.5 ml-auto w-fit">
                      <span className="text-[10px] opacity-60 font-black tracking-tighter">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOutbound && getStatusIcon(message.status)}
                    </div>
                  </div>

                  {/* Buttons (WhatsApp style) */}
                  {message.template?.buttons?.length > 0 && (
                    <div className="mt-1 border-t border-black/5 flex flex-col overflow-hidden rounded-b-2xl bg-black/5">
                      {message.template.buttons.map((btn, bidx) => (
                        <button key={bidx} className="w-full py-3 px-4 text-[13px] font-black uppercase tracking-widest text-sky-600 border-b last:border-b-0 border-black/5 hover:bg-black/10 transition-colors active:scale-[0.98]">
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
