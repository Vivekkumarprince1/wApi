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

const statusStyles = {
  open: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  closed: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  resolved: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  snoozed: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  spam: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
};

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
  workspace,
  assignmentTeamId,
  onToggleContactDetails,
  isContactDetailsOpen = false
}) {
  const visibleAgents = assignmentTeamId
    ? agents.filter(agent => {
        const agentTeamId = agent.team?._id?.toString?.() || agent.team?.toString?.() || null;
        return agentTeamId === String(assignmentTeamId);
      })
    : agents;

  const formatAgentOption = (agent) => {
    const teamName = agent.team?.name ? ` · ${agent.team.name}` : '';
    const clickability = agent.canAccept === false ? 'unclickable' : 'clickable';

    return `${agent.name === currentUser?.name ? 'Me' : agent.name}${teamName} · ${clickability}`;
  };

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
    <div className="flex-1 flex flex-col min-h-0 relative border-r border-border z-20 overflow-hidden bg-background">
      {!workspace?.loading && !bspReady && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-0 left-0 right-0 z-50 bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between"
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
      <div className="px-5 py-2.5 bg-background border-b border-border flex items-center justify-between sticky top-0 z-30 transition-all">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 bg-muted/70 rounded-lg flex items-center justify-center overflow-hidden border border-border">
              {selectedContact?.avatarUrl || selectedContact?.avatar ? (
                <img src={selectedContact.avatarUrl || selectedContact.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <FaUser className="text-muted-foreground text-[10px]" />
              )}
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-foreground text-[13px] truncate">
              {selectedContact?.displayName || selectedContact?.name || selectedContact?.phone}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0 truncate">
              {selectedContact?.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-muted/20">
          {/* Label Display */}
          {selectedConversation?.label && (
            <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-primary`}>
              {selectedConversation.label}
            </div>
          )}
          
          <button
            onClick={() => setShowLabelModal(!showLabelModal)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-all"
            title="Label"
          >
            <FaFlag size={10} />
          </button>

          <AnimatePresence>
            {showLabelModal && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute top-full mt-2 right-0 w-48 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50 p-2"
              >
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest px-3 py-2 border-b border-border/40 mb-1">Choose Segment</p>
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

          <div className="w-[1px] h-3 bg-border/40 mx-0.5" />

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-border bg-muted/30 rounded-lg">
            <FaUserCircle className="text-muted-foreground/60 text-sm" />
            <select
              value={selectedConversation?.assignedTo?._id || selectedConversation?.assignedTo || ''}
              onChange={(e) => handleAssignConversation(e.target.value)}
              className="bg-transparent border-none text-[12px] font-semibold text-foreground outline-none cursor-pointer"
            >
              <option value="">Unassigned</option>
              {visibleAgents.map((agent, idx) => (
                <option
                  key={agent._id || `agent-${idx}`}
                  value={agent._id}
                >
                  {formatAgentOption(agent)}
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-border/40 mx-1 hidden md:block"></div>

          <button
            onClick={handleResolveConversation}
            disabled={sending}
            className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-50"
            title="Resolve Conversation"
          >
            {sending ? <FaSpinner className="animate-spin text-sm" /> : <FaCheck className="text-sm" />}
          </button>

          <button
            type="button"
            onClick={onToggleContactDetails}
            className={`p-2.5 rounded-xl transition-all border ${isContactDetailsOpen ? 'text-primary bg-primary/10 border-primary/20 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/80 border-transparent hover:border-border/50'}`}
            title="Contact details"
          >
            <FaEllipsisV className="text-sm" />
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-border bg-background flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Team
          <span className="text-foreground font-bold">
            {selectedConversation?.team?.name || 'No team'}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Assignee
          <span className="text-foreground font-bold">
            {selectedConversation?.assignedTo?.name || 'Unassigned'}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Last update
          <span className="text-foreground font-bold">
            {selectedConversation?.updatedAt ? new Date(selectedConversation.updatedAt).toLocaleString() : 'Live'}
          </span>
        </span>
      </div>

      {/* Chat Messages */}
      <div
        className="flex-1 overflow-y-auto pt-6 pb-2 px-4 flex flex-col-reverse relative bg-background custom-scrollbar"
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
                  <span className="px-4 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
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
                  <span className="px-4 py-2 rounded-lg bg-muted/40 border border-border/60 text-[10px] font-medium text-muted-foreground text-center leading-relaxed">
                    {item.body}
                  </span>
                </motion.div>
              );
            }

            const message = item;
            const isOutbound = message.direction === 'outbound';
            const isNote = message.type === 'note' || message.isInternalNote;
            const isTemplate = message.type === 'template';
            const hideBodyText = !message.body || message.body === `[${message.type}]` || message.body === '[template]' || (['image', 'video', 'document', 'audio', 'sticker', 'location'].includes(message.type) && message.body === `[${message.type}]`);

            // Media extraction...
            // ... (rest of media logic)
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
                  className={`relative max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] transition-all pb-1 ${isNote
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 border border-amber-200/50 dark:border-amber-700/30'
                    : isOutbound
                      ? 'bg-primary/15 text-foreground dark:text-foreground border border-primary/20'
                      : 'bg-muted/40 text-foreground border border-border/60'
                    } ${item.isStartOfGroup
                      ? (isOutbound ? 'rounded-2xl rounded-br-lg' : 'rounded-2xl rounded-bl-lg')
                      : 'rounded-2xl'
                    }`}
                >
                  {/* Internal Note Tag */}
                  {isNote && (
                    <div className="px-3 pt-2 pb-0 flex items-center gap-1.5 opacity-70">
                      <FaFlag className="text-[9px]" />
                      <span className="text-[9px] font-semibold uppercase tracking-widest">Team Note</span>
                      {message.sentBy?.name && (
                        <span className="text-[9px] font-semibold uppercase tracking-widest">• {message.sentBy.name}</span>
                      )}
                    </div>
                  )}

                  {/* Message Detail (Tails - only on start of group) */}
                  {item.isStartOfGroup && !isNote && (
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
