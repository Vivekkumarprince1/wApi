import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUserCircle, 
  FaInfoCircle, 
  FaChevronDown, 
  FaTag, 
  FaPlus, 
  FaSearch, 
  FaFlag, 
  FaClock,
  FaUser
} from 'react-icons/fa';

export default function ContactDetailsSidebar({
  selectedContact,
  selectedConversation,
  expandedSections,
  toggleSection,
  handleAddTag,
  handleRemoveTag,
  activeDeal,
  crmLoading,
  newNote,
  setNewNote,
  handleAddNote,
  addingNote,
  conversationNotes = [],
  messages = []
}) {
  if (!selectedContact) return null;

  const contactTags = [...new Set([
    ...(selectedConversation?.contact?.tags || []),
    ...(selectedConversation?.tags || []),
    ...(selectedContact.tags || [])
  ])];
  const assignmentHistory = selectedConversation?.assignmentHistory || [];

  const timelineEvents = [
    ...assignmentHistory.map((event, index) => ({
      key: `assignment-${index}`,
      kind: 'assignment',
      date: event.assignedAt,
      title: event.action === 'unassigned'
        ? 'Unassigned'
        : event.action === 'reassigned'
          ? 'Reassigned'
          : 'Assigned',
      body: event.assignedTo?.name || event.assignedBy?.name || 'Team action'
    })),
    ...conversationNotes.map((note, index) => ({
      key: `note-${note._id || index}`,
      kind: 'note',
      date: note.createdAt,
      title: 'Internal Note',
      body: note.content,
      meta: note.createdBy?.name || 'Team'
    })),
    ...messages.slice(-8).map((message, index) => ({
      key: `message-${message._id || index}`,
      kind: message.direction === 'outbound' ? 'outbound' : 'inbound',
      date: message.createdAt,
      title: message.direction === 'outbound' ? 'Agent message' : 'Customer message',
      body: message.body || message.type || 'Message'
    }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10);

  return (
    <div className="w-[300px] lg:w-[336px] flex-shrink-0 bg-card/40 backdrop-blur-3xl border-l border-border/50 flex flex-col overflow-y-auto z-30 hidden xl:flex shadow-[-10px_0_30px_-5px_rgba(0,0,0,0.03)] transition-all duration-500 custom-scrollbar">

      {/* Contact Header Card */}
      <div className="p-10 flex flex-col items-center justify-center bg-transparent border-b border-border/40 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent opacity-80"></div>
        <div className="relative z-10">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-background/50 backdrop-blur-md rounded-3xl flex items-center justify-center mb-5 overflow-hidden border-4 border-background shadow-premium relative mx-auto"
          >
            {selectedContact.avatarUrl || selectedContact.avatar ? (
              <img src={selectedContact.avatarUrl || selectedContact.avatar} alt={selectedContact.name} className="w-full h-full object-cover" />
            ) : (
              <FaUserCircle className="text-[96px] text-muted-foreground/20" />
            )}
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-background rounded-full"></div>
          </motion.div>
          <motion.h2 
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-[20px] font-black text-foreground tracking-tight mb-1"
          >
            {selectedContact.name || selectedContact.phone}
          </motion.h2>
          <motion.p 
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-[12px] text-muted-foreground/70 font-black uppercase tracking-[0.2em]"
          >
            {selectedContact.phone}
          </motion.p>
        </div>
      </div>

      {/* Smart Cards Section */}
      <div className="p-2 flex-1 scroll-smooth">
        <div className="flex flex-col gap-2">
          {/* Personal Details Card */}
          <div className={`overflow-hidden rounded-2xl transition-all border ${expandedSections.details ? 'bg-card border-border/60 shadow-md' : 'bg-transparent border-transparent hover:bg-muted/40'}`}>
            <button
              onClick={() => toggleSection('details')}
              className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors text-foreground font-black uppercase tracking-widest text-[11px]"
            >
              <span className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-all ${expandedSections.details ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-500/10 text-blue-500'}`}>
                  <FaInfoCircle size={12} />
                </div>
                Contact Profile
              </span>
              <FaChevronDown className={`text-[10px] text-muted-foreground transition-transform duration-300 ${expandedSections.details ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandedSections.details && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-6 overflow-hidden"
                >
                  <div className="space-y-5 pt-2">
                    <div className="group/field">
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.25em] block mb-2 opacity-50">Email Frequency</label>
                      <div className="p-3.5 bg-muted/40 rounded-xl border border-border/50 font-bold text-xs text-foreground/80 hover:border-primary/20 transition-all flex items-center justify-between">
                        {selectedContact.email || 'No email attached'}
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30"></div>
                      </div>
                    </div>
                    <div className="group/field">
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.25em] block mb-2 opacity-50">Organization</label>
                      <input
                        type="text"
                        placeholder="Assign company..."
                        className="w-full bg-muted/40 border border-border/50 rounded-xl px-4 py-3 text-[13px] focus:ring-4 focus:ring-primary/5 focus:border-primary/30 outline-none transition-all font-bold text-foreground placeholder:opacity-30"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tags Card */}
          <div className={`overflow-hidden rounded-2xl transition-all border ${expandedSections.tags ? 'bg-card border-border/60 shadow-md' : 'bg-transparent border-transparent hover:bg-muted/40'}`}>
            <button
              onClick={() => toggleSection('tags')}
              className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors text-foreground font-black uppercase tracking-widest text-[11px]"
            >
              <span className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-all ${expandedSections.tags ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-purple-500/10 text-purple-500'}`}>
                  <FaTag size={12} />
                </div>
                Segmentation Tags
              </span>
              <FaChevronDown className={`text-[10px] text-muted-foreground transition-transform duration-300 ${expandedSections.tags ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandedSections.tags && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-6 overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 mb-5 pt-2">
                    {contactTags.map((tag) => (
                      <motion.span 
                        key={tag} 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-3 py-1.5 bg-muted/50 text-foreground/80 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 group/tag border border-border/50 hover:border-primary/30 transition-all hover:bg-primary/5"
                      >
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="text-muted-foreground/40 hover:text-destructive transition-all">
                          <FaPlus className="rotate-45 text-[10px]" />
                        </button>
                      </motion.span>
                    ))}
                    {contactTags.length === 0 && (
                      <span className="px-4 py-3 bg-muted/20 border border-dashed border-border/50 rounded-xl text-[11px] text-muted-foreground/60 w-full text-center italic font-bold">No active segments</span>
                    )}
                  </div>

                  <div className="relative group/search">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within/search:text-primary transition-colors" size={10} />
                    <input
                      type="text"
                      placeholder="Add marker (e.g. VIP)"
                      className="w-full pl-10 pr-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-[13px] focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all font-bold text-foreground placeholder:opacity-30"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          handleAddTag(e.target.value.trim());
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Internal Notes Card */}
          <div className={`overflow-hidden rounded-2xl transition-all border ${expandedSections.notes ? 'bg-card border-border/60 shadow-md' : 'bg-transparent border-transparent hover:bg-muted/40'}`}>
            <button
              onClick={() => toggleSection('notes')}
              className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors text-foreground font-black uppercase tracking-widest text-[11px]"
            >
              <span className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-all ${expandedSections.notes ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-amber-500/10 text-amber-500'}`}>
                  <FaFlag size={12} />
                </div>
                Collaboration Hub
              </span>
              <FaChevronDown className={`text-[10px] text-muted-foreground transition-transform duration-300 ${expandedSections.notes ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandedSections.notes && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-6 overflow-hidden"
                >
                  <div className="space-y-4 mb-5 max-h-64 overflow-y-auto no-scrollbar pr-1 pt-2">
                    {crmLoading ? (
                      <div className="flex justify-center p-8">
                        <FaClock className="animate-spin text-primary/40" size={20} />
                      </div>
                    ) : conversationNotes.length > 0 ? (
                      conversationNotes.map((note, idx) => (
                        <div key={note._id || idx} className="p-4 bg-muted/30 border border-border/50 rounded-2xl relative overflow-hidden group/note hover:border-amber-500/30 transition-all">
                          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500/10"></div>
                          <p className="text-[12.5px] text-foreground/80 leading-relaxed font-bold mb-3">{note.content}</p>
                          <div className="flex items-center justify-between border-t border-border/30 pt-2.5">
                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{note.createdBy?.name || 'Team'}</span>
                            <span className="text-[9px] text-muted-foreground/60 font-bold">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 bg-muted/20 border border-dashed border-border/50 rounded-2xl text-[11px] text-muted-foreground/60 w-full text-center italic font-bold">Share context with the team</div>
                    )}
                  </div>
                  
                  <form onSubmit={handleAddNote} className="space-y-3">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Capture key insights..."
                      className="w-full bg-muted/40 border border-border/50 rounded-xl p-4 text-[13px] focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/40 outline-none min-h-[100px] font-bold text-foreground placeholder:opacity-30 transition-all resize-none"
                    />
                    <button
                      type="submit"
                      disabled={addingNote || !newNote.trim()}
                      className="w-full py-3.5 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                      {addingNote ? <FaClock className="animate-spin" size={14} /> : <FaPlus size={10} />}
                      Commit Note
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Interaction History Card */}
          <div className={`overflow-hidden rounded-2xl transition-all border ${expandedSections.history ? 'bg-card border-border/60 shadow-md' : 'bg-transparent border-transparent hover:bg-muted/40'}`}>
            <button
              onClick={() => toggleSection('history')}
              className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors text-foreground font-black uppercase tracking-widest text-[11px]"
            >
              <span className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-all ${expandedSections.history ? 'bg-zinc-500 text-white shadow-lg' : 'bg-muted text-muted-foreground'}`}>
                  <FaClock size={12} />
                </div>
                Timeline
              </span>
              <FaChevronDown className={`text-[10px] text-muted-foreground transition-transform duration-300 ${expandedSections.history ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandedSections.history && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-10 overflow-hidden"
                >
                  <div className="space-y-6 relative border-l-2 border-border/50 ml-2 pt-2 pb-2 pl-6">
                    {timelineEvents.length === 0 ? (
                      <div className="relative">
                        <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-muted border-4 border-card"></div>
                        <p className="text-[12px] font-bold text-foreground">No timeline events yet</p>
                        <p className="text-[10px] text-muted-foreground">Conversation activity will appear here.</p>
                      </div>
                    ) : timelineEvents.map((event, index) => (
                      <div key={event.key || index} className="relative">
                        <div className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-4 border-card ${event.kind === 'note' ? 'bg-amber-500' : event.kind === 'assignment' ? 'bg-primary' : event.kind === 'outbound' ? 'bg-emerald-500' : 'bg-muted'}`}></div>
                        <p className="text-[12px] font-black text-foreground tracking-tight">{event.title}</p>
                        <p className="text-[10px] text-muted-foreground font-bold opacity-60 uppercase tracking-widest mt-1">
                          {event.meta ? `${event.meta} • ` : ''}{new Date(event.date).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{event.body}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
