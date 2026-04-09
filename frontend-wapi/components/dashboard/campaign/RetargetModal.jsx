import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, X, Mail, MessageSquare, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function RetargetModal({ isOpen, onClose, campaign, onRetarget }) {
  const [type, setType] = useState('NON_READERS');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !campaign) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onRetarget(campaign._id, type);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Retarget Campaign</h3>
                <p className="text-xs text-muted-foreground font-medium">Boost engagement for &quot;{campaign.name}&quot;</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => setType('NON_READERS')}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${type === 'NON_READERS' ? 'bg-primary/5 border-primary shadow-inner' : 'bg-muted/30 border-transparent hover:border-border'}`}
              >
                <div className={`mt-1 p-2 rounded-lg ${type === 'NON_READERS' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                  <Mail className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-foreground">Target Non-Readers</span>
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest px-1.5 py-0.5 bg-primary/10 rounded">Recommended</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">Resend to contacts who haven&apos;t opened the original message yet. Best for initial awareness boost.</p>
                </div>
              </button>

              <button 
                onClick={() => setType('NON_REPLIERS')}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${type === 'NON_REPLIERS' ? 'bg-primary/5 border-primary shadow-inner' : 'bg-muted/30 border-transparent hover:border-border'}`}
              >
                <div className={`mt-1 p-2 rounded-lg ${type === 'NON_REPLIERS' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-foreground">Target Non-Repliers</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">Focus on contacts who opened but didn&apos;t reply. Use a slightly different incentive or a gentle reminder.</p>
                </div>
              </button>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 flex gap-3">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed italic">
                Pro Tip: Change the first line of your template for retargeting campaigns to capture attention differently. Retargeting usually sees a 15-20% higher conversion rate.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button 
              disabled={loading}
              onClick={handleConfirm}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl shadow-lg shadow-primary/20 active:scale-95 disabled:scale-100 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
              Create Retargeting Draft
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
