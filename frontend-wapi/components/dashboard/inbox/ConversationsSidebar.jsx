import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaArchive, FaUser, FaChartBar, FaLock } from 'react-icons/fa';
import FlashLoader from '@/components/ui/FlashLoader';
import { toast } from '@/lib/toast';

const statusStyles = {
  open: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  closed: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  resolved: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  snoozed: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  spam: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
};

export default function ConversationsSidebar({
  conversations,
  loading,
  searchTerm,
  setSearchTerm,
  selectedConversationId,
  handleSelectContact,
  currentView,
  setCurrentView,
  activeFilters,
  setActiveFilters,
  agents,
  contactLabels,
  connected,
  typingUsers,
  currentUser,
  permissions
}) {
  const allViews = ['all', 'mine', 'team', 'unassigned', 'resolved', 'snoozed'];

  return (
    <div className="w-[300px] lg:w-[340px] flex-shrink-0 border-r border-border bg-card/80 backdrop-blur-xl flex flex-col z-10 transition-all duration-500">
      {/* Search Bar section */}
      <div className="px-4 py-4 bg-transparent border-b border-border/40">
        <div className="relative group/search">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <FaSearch className="text-muted-foreground/50 text-xs group-focus-within/search:text-primary transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-muted/50 border border-transparent rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:bg-card focus:border-primary/30 focus:ring-4 focus:ring-primary/5 outline-none font-medium transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Link
            href="/dashboard/inbox/analytics"
            className="p-2.5 bg-card border border-border text-muted-foreground hover:text-primary rounded-xl hover:bg-primary/5 hover:border-primary/20 shadow-sm transition-all group"
            title="Inbox Analytics"
          >
            <FaChartBar size={16} className="group-hover:scale-110 transition-transform" />
          </Link>
        </div>
      </div>

      <div className="px-4 py-3 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-border/40 scrollbar-hide">
        {allViews.map(view => {
          const isRestricted = !permissions?.viewAllConversations && (view === 'all');
          const isTeamRestricted = view === 'team' && !currentUser?.team;
          
          if (view === 'team' && !currentUser?.team) return null; // Hide team tab if user has no team

          return (
            <button
              key={view}
              onClick={() => {
                if (isRestricted) {
                  toast.error('Permission required to view all conversations');
                } else if (isTeamRestricted) {
                  toast.error('You are not assigned to any team');
                } else {
                  setCurrentView(view);
                }
              }}
              className={`px-3.5 py-1.5 text-[11px] font-bold rounded-lg capitalize transition-all border whitespace-nowrap flex items-center gap-1.5 ${currentView === view
                ? 'bg-primary/10 border-primary/20 text-primary shadow-sm'
                : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                } ${isRestricted ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span>{view}</span>
              {isRestricted && <FaLock size={8} className="opacity-70" />}
            </button>
          );
        })}
      </div>

      {/* Connection Indicator */}
      <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 bg-muted/20 text-muted-foreground/70 border-b border-border/40">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]'} animate-pulse`} />
        <span>{connected ? 'Real-time Linked' : 'Stream Disconnected'}</span>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent">
        {loading ? (
          <div className="p-8"><FlashLoader /></div>
        ) : conversations.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center"
          >
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4 border border-border/50">
              <FaArchive className="text-2xl opacity-30" />
            </div>
            <p className="text-sm font-semibold tracking-tight">No conversations found</p>
            <p className="text-xs opacity-60 mt-1">Try adjusting your filters or search term</p>
          </motion.div>
        ) : (
          <div className="py-2 px-2 flex flex-col gap-1">
            <AnimatePresence mode="popLayout">
              {conversations.map((conversation, idx) => {
                const isSelected = selectedConversationId === (conversation._id || conversation.id);
                return (
                  <motion.div
                    key={conversation._id || conversation.id || `conv-${idx}`}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.03, type: "spring", stiffness: 300, damping: 30 }}
                    onClick={() => handleSelectContact(conversation)}
                    className={`group relative px-3 py-3.5 cursor-pointer rounded-2xl transition-all flex items-start gap-3.5 ${isSelected
                      ? 'bg-primary/5 shadow-premium border border-primary/10'
                      : 'hover:bg-muted/60 border border-transparent hover:border-border/50'
                      }`}
                  >
                    {/* Active Indicator Bar */}
                    {isSelected && (
                      <motion.div 
                        layoutId="active-nav"
                        className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full shadow-[0_0_8px_rgba(20,184,166,0.4)]"
                      />
                    )}

                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border-2 transition-colors ${isSelected ? 'border-primary/20 bg-background' : 'border-border bg-muted/80'}`}>
                        {conversation.contact?.avatarUrl || conversation.contact?.avatar ? (
                          <img src={conversation.contact.avatarUrl || conversation.contact.avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <FaUser className={`text-xl ${isSelected ? 'text-primary' : 'text-muted-foreground/40'}`} />
                        )}
                      </div>
                      {/* SLA Indicator */}
                      {conversation.status === 'open' && conversation.slaDeadline && (
                        <div className={`absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm z-10 ${conversation.slaBreached ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`} title={conversation.slaBreached ? "SLA Breached" : "Response Due Soon"}>
                          <div className="w-2 h-2 border-[1.5px] border-current rounded-full relative">
                            <div className="absolute top-1/2 left-1/2 w-0.5 h-1 bg-current -translate-x-1/2 -translate-y-full origin-bottom rotate-0" />
                          </div>
                        </div>
                      )}

                      {(conversation.myUnreadCount || conversation.unreadCount || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                        </span>
                      )}
                    </div>

                    {/* Preview */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className={`font-bold truncate text-[14px] leading-tight ${isSelected ? 'text-foreground' : 'text-foreground/90'}`}>
                          {conversation.contact?.displayName || conversation.contact?.name || conversation.contact?.phone}
                        </h3>
                        {conversation.lastMessageAt && (
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                             <span className="text-[10px] font-bold text-muted-foreground/60">
                               {new Date(conversation.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                             {conversation.priority === 'urgent' && (
                               <div className="text-amber-500 text-[10px]">★</div>
                             )}
                          </div>
                        )}
                      </div>

                      {conversation.label && (
                        <div className="flex mb-1.5">
                          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/10">
                            {conversation.label}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${statusStyles[conversation.status] || 'bg-muted text-muted-foreground border-border/60'}`}>
                          {conversation.status || 'open'}
                        </span>
                        {conversation.assignedTo?.name && (
                          <span className="px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[9px] font-black uppercase tracking-widest border border-border/60">
                            {conversation.assignedTo.name === currentUser?.name ? 'Assigned to me' : `Assigned to ${conversation.assignedTo.name}`}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <p className={`text-[12.5px] truncate font-medium ${isSelected ? 'text-muted-foreground' : 'text-muted-foreground/80'}`}>
                          {typingUsers?.[conversation._id]?.isTyping && typingUsers?.[conversation._id]?.agentId !== currentUser?._id ? (
                            <span className="text-primary italic animate-pulse">Typing...</span>
                          ) : (
                            conversation.lastMessage?.body || conversation.lastMessagePreview || 'No messages'
                          )}
                        </p>
                        {(conversation.myUnreadCount || conversation.unreadCount || 0) > 0 && (
                          <div className="px-1.5 py-0.5 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-[10px] font-black shadow-sm ring-4 ring-background">
                            {conversation.myUnreadCount || conversation.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
