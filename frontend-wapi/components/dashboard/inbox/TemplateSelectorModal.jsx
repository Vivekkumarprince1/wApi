import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSearch, FaPaperPlane, FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { get, post } from '@/lib/api';
import WhatsAppPreview from '@/components/templates/WhatsAppPreview';

export default function TemplateSelectorModal({
  isOpen,
  onClose,
  contact,
  onSuccess
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variables, setVariables] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setSelectedTemplate(null);
      setVariables({});
      setError(null);
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await get('/templates', { 
        params: { status: 'APPROVED' } 
      });
      setTemplates(response.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Could not load approved templates.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    
    // Initialize variables
    const newVars = {};
    template.components?.forEach(comp => {
      const matches = comp.text?.match(/\{\{(\d+)\}\}/g) || [];
      matches.forEach(match => {
        const index = match.replace('{{', '').replace('}}', '');
        newVars[index] = '';
      });
    });
    setVariables(newVars);
  };

  const handleSend = async () => {
    if (!selectedTemplate || !contact) return;
    
    try {
      setSending(true);
      setError(null);
      
      await post(`/templates/${selectedTemplate._id}/send`, {
        to: contact.phone,
        contactId: contact._id,
        variables
      });
      
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send template.');
    } finally {
      setSending(false);
    }
  };

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
            className="bg-card/90 backdrop-blur-2xl rounded-[2rem] shadow-premium w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-border/50 relative z-10"
          >
            <div className="p-8 border-b border-border/50 flex items-center justify-between bg-muted/20">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                    <FaExclamationTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground tracking-tight">Session Expired</h3>
                    <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest mt-1">Select a template to resume conversation</p>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground/40 hover:text-foreground p-3 hover:bg-muted rounded-2xl transition-all active:scale-90"
              >
                <FaTimes size={18} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left Column: Template List */}
              <div className="w-1/3 border-r border-border/50 flex flex-col">
                <div className="p-4 border-b border-border/50">
                  <div className="relative group/search">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within/search:text-primary transition-colors" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search templates..."
                      className="w-full pl-11 pr-5 py-3 bg-muted/40 border border-border/50 rounded-xl text-[13px] focus:ring-4 focus:ring-primary/5 focus:border-primary/30 outline-none transition-all font-bold text-foreground placeholder:opacity-30"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                      <FaSpinner className="animate-spin text-3xl mb-4" />
                      <p className="text-[10px] uppercase font-black tracking-widest">Accessing Vault...</p>
                    </div>
                  ) : filteredTemplates.length > 0 ? (
                    filteredTemplates.map((template) => (
                      <button
                        key={template._id}
                        onClick={() => handleSelectTemplate(template)}
                        className={`w-full text-left p-4 rounded-2xl transition-all border ${
                          selectedTemplate?._id === template._id
                            ? 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/5'
                            : 'bg-muted/20 border-border/40 hover:bg-muted/40'
                        }`}
                      >
                        <p className={`font-black text-[13px] truncate ${selectedTemplate?._id === template._id ? 'text-primary' : 'text-foreground'}`}>
                          {template.name}
                        </p>
                        <p className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-widest mt-1">
                          {template.category} • {template.language}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-10 opacity-30 italic text-xs">No matching templates.</div>
                  )}
                </div>
              </div>

              {/* Right Column: Preview & Variables */}
              <div className="flex-1 bg-muted/5 p-8 overflow-y-auto custom-scrollbar">
                {selectedTemplate ? (
                  <div className="space-y-8">
                    <div>
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block px-1 opacity-50 mb-4">Meta Preview</label>
                      <WhatsAppPreview template={selectedTemplate} variables={variables} />
                    </div>

                    {Object.keys(variables).length > 0 && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block px-1 opacity-50">Variable Mapping</label>
                        <div className="grid grid-cols-1 gap-4">
                          {Object.keys(variables).map(key => (
                            <div key={key} className="space-y-2">
                              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Variable {`{{${key}}}`}</label>
                              <input
                                type="text"
                                value={variables[key]}
                                onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                                placeholder={`Enter value for {{${key}}}...`}
                                className="w-full px-5 py-4 bg-background border border-border/50 rounded-2xl text-[14px] focus:ring-4 focus:ring-primary/5 focus:border-primary/30 outline-none transition-all font-bold text-foreground shadow-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {error && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-3 text-destructive">
                        <FaExclamationTriangle className="flex-shrink-0" />
                        <p className="text-xs font-bold">{error}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                    <FaPaperPlane size={40} className="mb-6" />
                    <p className="text-sm font-black uppercase tracking-[0.2em]">Select a protocol<br/>to continue transmission</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t border-border/50 flex justify-end gap-4 bg-muted/20">
              <button
                onClick={onClose}
                className="px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !selectedTemplate || Object.values(variables).some(v => !v.trim())}
                className="px-8 py-3 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:grayscale transition-all flex items-center gap-3"
              >
                {sending ? (
                  <><FaSpinner className="animate-spin" /> Transmission in Progress...</>
                ) : (
                  <><FaPaperPlane size={10} /> Resume Legal Protocol</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
