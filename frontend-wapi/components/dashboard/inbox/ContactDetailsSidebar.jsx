import { useEffect, useState } from 'react';
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
  FaUser,
  FaShoppingBag,
  FaBoxOpen
} from 'react-icons/fa';
import { get } from '@/lib/api';

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
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const selectedContactId = selectedContact?._id || selectedContact?.id || selectedConversation?.contact?._id || selectedConversation?.contact?.id || null;

  useEffect(() => {
    const loadOrders = async () => {
      if (!selectedContactId) {
        setOrders([]);
        return;
      }

      try {
        setOrdersLoading(true);
        const response = await get(`/checkout-bot/orders?contactId=${selectedContactId}&limit=5&sortBy=-createdAt`);
        const orderData = response?.data || response?.orders || response;
        setOrders(Array.isArray(orderData) ? orderData : []);
      } catch (error) {
        setOrders([]);
      } finally {
        setOrdersLoading(false);
      }
    };

    loadOrders();
  }, [selectedContactId]);

  if (!selectedContact) return null;

  const contactTags = [...new Set([
    ...(selectedConversation?.contact?.tags || []),
    ...(selectedConversation?.tags || []),
    ...(selectedContact.tags || [])
  ])];
  const assignmentHistory = selectedConversation?.assignmentHistory || [];
  const snapshotActivityAt = messages[messages.length - 1]?.createdAt || conversationNotes[conversationNotes.length - 1]?.createdAt || orders[0]?.createdAt || selectedConversation?.updatedAt || selectedConversation?.createdAt;
  const snapshotStats = [
    { label: 'Messages', value: messages.length },
    { label: 'Notes', value: conversationNotes.length },
    { label: 'Orders', value: orders.length }
  ];

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
    <div className="h-full w-full flex-shrink-0 bg-card border-l border-border flex flex-col overflow-y-auto z-30 custom-scrollbar">

      {/* Contact Header Card */}
      <div className="p-8 flex flex-col items-center justify-center bg-background border-b border-border text-center">
        <div>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-muted/60 rounded-lg flex items-center justify-center mb-4 overflow-hidden border border-border flex-shrink-0 mx-auto"
          >
            {selectedContact.avatarUrl || selectedContact.avatar ? (
              <img src={selectedContact.avatarUrl || selectedContact.avatar} alt={selectedContact.name} className="w-full h-full object-cover" />
            ) : (
              <FaUserCircle className="text-4xl text-muted-foreground/30" />
            )}
          </motion.div>
          <motion.h2 
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-[16px] font-bold text-foreground tracking-tight mb-0.5"
          >
            {selectedContact.name || selectedContact.phone}
          </motion.h2>
          <motion.p 
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest"
          >
            {selectedContact.phone}
          </motion.p>
        </div>
      </div>

      {/* Smart Cards Section */}
      <div className="p-2 flex-1 scroll-smooth">
        <div className="flex flex-col gap-2">
          {/* Conversation Snapshot */}
          <div className="overflow-hidden rounded-lg bg-background border border-border">
            <div className="w-full px-4 py-3 flex items-center justify-between text-left text-foreground font-semibold uppercase tracking-widest text-[10px] border-b border-border/60">
              <span className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted/60 text-muted-foreground">
                  <FaClock size={11} />
                </div>
                Context
              </span>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {snapshotStats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-muted/30 px-2 py-2 text-center">
                    <div className="text-[14px] font-bold text-foreground leading-none">{stat.value}</div>
                    <div className="mt-1 text-[8px] font-semibold uppercase tracking-widest text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Personal Details Card */}
          <div className={`overflow-hidden rounded-lg transition-all border ${expandedSections.details ? 'bg-background border-border' : 'bg-transparent border-transparent hover:bg-muted/20'}`}>
            <button
              onClick={() => toggleSection('details')}
              className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors text-foreground font-semibold uppercase tracking-widest text-[10px]"
            >
              <span className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md transition-all ${expandedSections.details ? 'bg-blue-500/20 text-blue-600' : 'bg-muted/40 text-muted-foreground'}`}>
                  <FaInfoCircle size={11} />
                </div>
                Details
              </span>
              <FaChevronDown className={`text-[9px] text-muted-foreground transition-transform duration-300 ${expandedSections.details ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandedSections.details && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 overflow-hidden"
                >
                  <div className="space-y-3 pt-2">
                    <div className="group/field">
                      <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Email</label>
                      <div className="p-2.5 bg-muted/40 rounded-lg border border-border/60 font-medium text-xs text-foreground/80">
                        {selectedContact.email || 'No email'}
                      </div>
                    </div>
                    <div className="group/field">
                      <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Organization</label>
                      <input
                        type="text"
                        placeholder="Add company..."
                        className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-[12px] focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all font-medium text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tags Card */}
          <div className={`overflow-hidden rounded-lg transition-all border ${expandedSections.tags ? 'bg-background border-border' : 'bg-transparent border-transparent hover:bg-muted/20'}`}>
            <button
              onClick={() => toggleSection('tags')}
              className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors text-foreground font-semibold uppercase tracking-widest text-[10px]"
            >
              <span className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md transition-all ${expandedSections.tags ? 'bg-purple-500/20 text-purple-600' : 'bg-muted/40 text-muted-foreground'}`}>
                  <FaTag size={11} />
                </div>
                Tags
              </span>
              <FaChevronDown className={`text-[9px] text-muted-foreground transition-transform duration-300 ${expandedSections.tags ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandedSections.tags && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 mb-3 pt-2">
                    {contactTags.map((tag) => (
                      <motion.span 
                        key={tag} 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-2.5 py-1.5 bg-muted/50 text-foreground text-[10px] font-semibold uppercase tracking-widest rounded-lg flex items-center gap-2 border border-border/60 hover:border-primary/30 transition-all"
                      >
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="text-muted-foreground/50 hover:text-destructive transition-all">
                          <FaPlus className="rotate-45 text-[9px]" />
                        </button>
                      </motion.span>
                    ))}
                    {contactTags.length === 0 && (
                      <span className="px-3 py-2 bg-muted/20 border border-dashed border-border/60 rounded-lg text-[10px] text-muted-foreground w-full text-center font-medium">No tags</span>
                    )}
                  </div>

                  <div className="relative group/search">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" size={10} />
                    <input
                      type="text"
                      placeholder="Add tag..."
                      className="w-full pl-8 pr-3 py-2 bg-muted/40 border border-border/60 rounded-lg text-[12px] focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all font-medium text-foreground placeholder:text-muted-foreground/50 outline-none"
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
          <div className={`overflow-hidden rounded-lg transition-all border ${expandedSections.notes ? 'bg-background border-border' : 'bg-transparent border-transparent hover:bg-muted/20'}`}>
            <button
              onClick={() => toggleSection('notes')}
              className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors text-foreground font-semibold uppercase tracking-widest text-[10px]"
            >
              <span className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md transition-all ${expandedSections.notes ? 'bg-amber-500/20 text-amber-600' : 'bg-muted/40 text-muted-foreground'}`}>
                  <FaFlag size={11} />
                </div>
                Notes
              </span>
              <FaChevronDown className={`text-[9px] text-muted-foreground transition-transform duration-300 ${expandedSections.notes ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandedSections.notes && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 overflow-hidden"
                >
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1 pt-2 custom-scrollbar">
                    {crmLoading ? (
                      <div className="flex justify-center p-6">
                        <FaClock className="animate-spin text-primary/40" size={18} />
                      </div>
                    ) : conversationNotes.length > 0 ? (
                      conversationNotes.map((note, idx) => (
                        <div key={note._id || idx} className="p-3 bg-muted/30 border border-border/60 rounded-lg relative">
                          <p className="text-[12px] text-foreground leading-relaxed font-medium mb-2">{note.content}</p>
                          <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
                            <span className="text-[9px] text-muted-foreground uppercase font-semibold">{note.createdBy?.name || 'Team'}</span>
                            <span className="text-[9px] text-muted-foreground/60 font-medium">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-6 bg-muted/20 border border-dashed border-border/60 rounded-lg text-[10px] text-muted-foreground w-full text-center font-medium">No notes yet</div>
                    )}
                  </div>
                  
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="w-full bg-muted/40 border border-border/60 rounded-lg p-3 text-[12px] focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/30 outline-none min-h-[80px] font-medium text-foreground placeholder:text-muted-foreground/50 transition-all resize-none"
                    />
                    <button
                      type="submit"
                      disabled={addingNote || !newNote.trim()}
                      className="w-full py-2.5 bg-amber-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {addingNote ? <FaClock className="animate-spin" size={12} /> : <FaPlus size={10} />}
                      Save Note
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Interaction History Card */}
          <div className={`overflow-hidden rounded-lg transition-all border ${expandedSections.history ? 'bg-background border-border' : 'bg-transparent border-transparent hover:bg-muted/20'}`}>
            <button
              onClick={() => toggleSection('history')}
              className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors text-foreground font-semibold uppercase tracking-widest text-[10px]"
            >
              <span className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md transition-all ${expandedSections.history ? 'bg-muted/60 text-muted-foreground' : 'bg-muted/40 text-muted-foreground'}`}>
                  <FaClock size={11} />
                </div>
                Timeline
              </span>
              <FaChevronDown className={`text-[9px] text-muted-foreground transition-transform duration-300 ${expandedSections.history ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandedSections.history && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 overflow-hidden"
                >
                  <div className="space-y-3 relative border-l border-border/60 ml-3 pt-1 pb-2 pl-4">
                    {timelineEvents.length === 0 ? (
                      <div className="relative">
                        <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-muted border-3 border-background"></div>
                        <p className="text-[11px] font-semibold text-foreground">No timeline events</p>
                        <p className="text-[9px] text-muted-foreground">Activity will appear here.</p>
                      </div>
                    ) : timelineEvents.map((event, index) => (
                      <div key={event.key || index} className="relative">
                        <div className={`absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full border-3 border-background ${event.kind === 'note' ? 'bg-amber-500' : event.kind === 'assignment' ? 'bg-primary' : event.kind === 'outbound' ? 'bg-emerald-500' : 'bg-muted'}`}></div>
                        <p className="text-[11px] font-semibold text-foreground">{event.title}</p>
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                          {event.meta ? `${event.meta} • ` : ''}{new Date(event.date).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{event.body}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order History Card */}
          <div className="overflow-hidden rounded-2xl bg-card border border-border/60 shadow-sm">
            <div className="w-full px-5 py-4 flex items-center justify-between text-left text-foreground font-black uppercase tracking-widest text-[11px] border-b border-border/50">
              <span className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <FaShoppingBag size={12} />
                </div>
                Order History
              </span>
              <span className="text-[9px] text-muted-foreground/60 font-black">
                {orders.length} recent
              </span>
            </div>
            <div className="px-5 py-4">
              {ordersLoading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground/60 text-[11px] font-bold">
                  Loading orders...
                </div>
              ) : orders.length === 0 ? (
                <div className="px-4 py-6 bg-muted/20 border border-dashed border-border/50 rounded-2xl text-[11px] text-muted-foreground/60 w-full text-center italic font-bold flex items-center justify-center gap-2">
                  <FaBoxOpen className="text-muted-foreground/30" />
                  No orders found for this contact
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map((order, idx) => (
                    <div key={order._id || idx} className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 hover:border-emerald-500/20 transition-all">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-[12px] font-black text-foreground tracking-tight truncate">
                          {order.orderNumber || order._id}
                        </p>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/10">
                          {order.status || 'pending'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                        <span>{order.currency || 'INR'} {order.total || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
