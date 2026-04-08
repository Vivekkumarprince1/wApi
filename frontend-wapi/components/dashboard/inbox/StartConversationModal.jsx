import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSearch, FaCheckCircle, FaInfoCircle, FaSpinner, FaPaperPlane } from 'react-icons/fa';

export default function StartConversationModal({
  isOpen,
  onClose,
  contactSearch,
  onSearchChange,
  contactOptions,
  selectedContact,
  onSelectContact,
  message,
  onMessageChange,
  onSubmit,
  loading
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card/90 backdrop-blur-2xl rounded-[2rem] shadow-premium w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-border/50 relative z-10"
          >
            <div className="p-8 border-b border-border/50 flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight">Initiate Conversation</h3>
                <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest mt-1">Direct outreach protocol</p>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground/40 hover:text-foreground p-3 hover:bg-muted rounded-2xl transition-all active:scale-90"
              >
                <FaTimes size={18} />
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block px-1 opacity-50">Recipient Discovery</label>
                <div className="relative group/search">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within/search:text-primary transition-colors" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search name or ID..."
                    className="w-full pl-11 pr-5 py-4 bg-muted/40 border border-border/50 rounded-2xl text-[14px] focus:ring-4 focus:ring-primary/5 focus:border-primary/30 outline-none transition-all font-bold text-foreground placeholder:opacity-30"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto rounded-2xl border border-border/40 bg-muted/20 custom-scrollbar">
                  {contactOptions.length > 0 ? (
                    contactOptions.map((contact, idx) => (
                      <button
                        key={contact._id || `opt-${idx}`}
                        type="button"
                        onClick={() => onSelectContact(contact)}
                        className={`w-full text-left px-5 py-4 border-b last:border-b-0 border-border/30 transition-all flex justify-between items-center group/item ${selectedContact?._id === contact._id
                          ? 'bg-primary/5'
                          : 'hover:bg-muted/50 bg-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${selectedContact?._id === contact._id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                            {(contact.name || contact.phone).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-black text-[13px] tracking-tight ${selectedContact?._id === contact._id ? 'text-primary' : 'text-foreground'}`}>
                              {contact.name || contact.phone}
                            </p>
                            {contact.name && (
                              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">{contact.phone}</p>
                            )}
                          </div>
                        </div>
                        {selectedContact?._id === contact._id && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="p-1 bg-primary rounded-full">
                            <FaCheckCircle className="text-white text-sm" />
                          </motion.div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-10 text-center">
                      <FaInfoCircle className="mx-auto text-muted-foreground/20 text-3xl mb-4" />
                      <p className="text-xs text-muted-foreground/60 font-medium italic">No matches found in your database.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block px-1 opacity-50">Opening Content</label>
                <textarea
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  rows={4}
                  placeholder="Draft your message..."
                  className="w-full px-5 py-4 bg-muted/40 border border-border/50 rounded-2xl text-[14px] focus:ring-4 focus:ring-primary/5 focus:border-primary/30 outline-none transition-all font-bold text-foreground placeholder:opacity-30 resize-none min-h-[120px]"
                />
                <div className="flex items-start gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                  <FaInfoCircle className="text-blue-500 mt-1" size={12} />
                  <p className="text-[10px] text-blue-600/70 font-bold uppercase tracking-widest leading-relaxed">
                    Account protocol: New outbound messages to cold leads are processed via Standard Tier pricing.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-border/50 flex justify-end gap-4 bg-muted/20">
              <button
                onClick={onClose}
                className="px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all"
              >
                Abort
              </button>
              <button
                onClick={onSubmit}
                disabled={loading || !selectedContact || !message.trim()}
                className="px-8 py-3 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:grayscale transition-all flex items-center gap-3"
              >
                {loading ? (
                  <><FaSpinner className="animate-spin" /> Transmitting...</>
                ) : (
                  <><FaPaperPlane size={10} /> Send Message</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
