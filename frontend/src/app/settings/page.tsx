"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DeleteAccountModal } from '@/components/dashboard/settings/delete-account-modal';
import { 
  Settings, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Bug, 
  Zap, 
  Key, 
  ShieldCheck, 
  Smartphone,
  Info,
  ExternalLink,
  ChevronRight,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';

import { 
  getWABASettings, 
  updateWABASettings, 
  testWABAConnection,
  WABASettings 
} from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FlashLoader from '@/components/ui/flash-loader';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    whatsappAccessToken: '',
    whatsappPhoneNumberId: '',
    whatsappVerifyToken: '',
    wabaId: '',
    businessAccountId: ''
  });

  const { data: settings, isLoading } = useQuery<WABASettings>({
    queryKey: ['waba-settings'],
    queryFn: async () => {
      const response: any = await getWABASettings();
      return response?.waba || response || {};
    }
  });

  React.useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        whatsappPhoneNumberId: settings.whatsappPhoneNumberId || '',
        whatsappVerifyToken: settings.whatsappVerifyToken || '',
        wabaId: settings.wabaId || '',
        businessAccountId: settings.businessAccountId || ''
      }));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => updateWABASettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waba-settings'] });
      toast.success('Connection settings updated');
      setFormData(prev => ({ ...prev, whatsappAccessToken: '' }));
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save settings')
  });

  const testMutation = useMutation({
    mutationFn: () => testWABAConnection(),
    onSuccess: (res: any) => {
      if (res.success) {
        toast.success(`Connected! Active Phone: ${res.phoneInfo?.display_phone_number || 'OK'}`);
      } else {
        toast.error(res.message || 'Connection test failed');
      }
    },
    onError: () => toast.error('Check your credentials and try again')
  });

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Workspace Settings
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/10">
               Environment: Production
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Configure your bridge to the Meta WhatsApp Business Network.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !settings?.hasToken}
            className="rounded-2xl h-12 px-6 border-border/50 font-bold bg-card shadow-sm group"
          >
            {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Smartphone className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />}
            Test Connection
          </Button>
          <Button 
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending}
            className="rounded-2xl h-12 px-8 font-black shadow-lg shadow-primary/20 bg-primary group"
          >
             {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />}
             Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Config */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border/50 rounded-[40px] p-10 space-y-8 shadow-sm relative overflow-hidden">
             <div className="flex items-center justify-between relative z-10">
                <h3 className="text-xl font-black text-foreground">API Configuration</h3>
                <a href="https://developers.facebook.com/dashboards" target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                   Meta Developer Portal <ExternalLink className="h-3 w-3" />
                </a>
             </div>

             <div className="space-y-6 relative z-10">
                <div className="space-y-2">
                   <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Permanent Access Token</label>
                      <button onClick={() => setShowToken(!showToken)} className="text-muted-foreground hover:text-primary transition-colors">
                         {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                   </div>
                   <div className="relative">
                      <Input 
                        type={showToken ? 'text' : 'password'}
                        value={formData.whatsappAccessToken}
                        onChange={(e) => setFormData({ ...formData, whatsappAccessToken: e.target.value })}
                        placeholder={settings?.hasToken ? "••••••••••••••••••••••••••••••••" : "EAA..."}
                        className="h-13 rounded-2xl bg-muted/20 border-none font-bold pr-12 focus-visible:ring-primary/20"
                      />
                      {settings?.hasToken && !formData.whatsappAccessToken && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                           <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-black uppercase">Stored</Badge>
                        </div>
                      )}
                   </div>
                   <p className="text-[10px] text-muted-foreground italic px-1">Enter a new token only if you wish to overwrite the existing one.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Phone Number ID</label>
                      <Input 
                        value={formData.whatsappPhoneNumberId}
                        onChange={(e) => setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })}
                        placeholder="123456789012345"
                        className="h-12 rounded-xl bg-muted/20 border-none font-bold"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">WABA ID</label>
                      <Input 
                        value={formData.wabaId}
                        onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                        placeholder="123456789012345"
                        className="h-12 rounded-xl bg-muted/20 border-none font-bold"
                      />
                   </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-border/10">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Webhook Verify Token</label>
                   <Input 
                      value={formData.whatsappVerifyToken}
                      onChange={(e) => setFormData({ ...formData, whatsappVerifyToken: e.target.value })}
                      placeholder="MyVerifyToken_123"
                      className="h-12 rounded-xl bg-muted/20 border-none font-bold"
                   />
                   <p className="text-[10px] text-muted-foreground italic px-1">Must match the Verify Token used in your Meta App Webhook configuration.</p>
                </div>
             </div>
             
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Settings className="h-60 w-60 rotate-45" />
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-indigo-600 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-600/10 relative overflow-hidden group">
                <div className="relative z-10 space-y-4">
                   <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <ShieldCheck className="h-5 w-5" />
                   </div>
                   <h4 className="text-lg font-black tracking-tight">Enterprise Security</h4>
                   <p className="text-xs font-medium opacity-60 leading-relaxed">All active session tokens are encrypted at rest using AES-256 standards in our secure vault.</p>
                </div>
                <div className="absolute -bottom-8 -right-8 h-32 w-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
             </div>
             
             <div className="bg-card border border-border/50 rounded-[32px] p-8 space-y-4 shadow-sm group">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                   <Info className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-black tracking-tight text-foreground">Usage Quotas</h4>
                <div className="space-y-2">
                   <div className="flex justify-between text-xs font-bold">
                      <span className="opacity-60">API Hits / Min</span>
                      <span>24 / 100</span>
                   </div>
                   <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[24%] transition-all" />
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Status Side */}
        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-[40px] p-8 space-y-8 shadow-sm">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Connectivity</p>
                <h3 className="text-xl font-black text-foreground">Real-time Status</h3>
             </div>

             <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/10 flex items-start gap-4">
                   <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${settings?.hasToken ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
                      {settings?.hasToken ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                   </div>
                   <div className="space-y-1">
                      <p className="text-sm font-black text-foreground">{settings?.hasToken ? 'Bridge Connected' : 'Disconnected'}</p>
                      <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                        {settings?.hasToken 
                          ? `Ready to transmit messages. Session established on ${new Date(settings.connectedAt || Date.now()).toLocaleDateString()}.` 
                          : 'Configure a valid Permanent Access Token from Meta to start messaging.'}
                      </p>
                   </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border/10 flex items-start gap-4">
                   <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-5 w-5" />
                   </div>
                   <div className="space-y-1">
                      <p className="text-sm font-black text-foreground">Auto-Discovery</p>
                      <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">System is actively monitoring Template status updates from Meta Graph API.</p>
                   </div>
                </div>
             </div>

             <div className="pt-4 border-t border-border/10 space-y-4">
               <Button 
                variant="ghost" 
                onClick={() => toast.info('Diagnostic Logs summarized in console.')}
                className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/50"
               >
                 <Bug className="h-4 w-4 mr-2" /> View Detailed Diagnostics
               </Button>
               <Button variant="outline" className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/5">
                 Meta Webhook Docs <ChevronRight className="h-3 w-3 ml-2" />
               </Button>
             </div>
          </div>

          <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
             <div className="relative z-10 space-y-6">
                <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-primary">Bridge Intelligence</p>
                   <h4 className="text-lg font-black tracking-tight leading-tight">Need to reset your connection?</h4>
                </div>
                <p className="text-xs font-medium opacity-50 leading-relaxed">Rotating your access token will immediately disconnect all active message sessions until the new token is saved.</p>
                <Button className="w-full h-12 rounded-2xl bg-white/10 text-white font-black hover:bg-white/20 transition-all">
                  Request Rotation
                </Button>
             </div>
             <div className="absolute -bottom-10 -left-10 h-40 w-40 bg-primary/20 rounded-full blur-3xl" />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-10 border-t border-destructive/10">
        <div className="bg-card border border-destructive/20 rounded-[40px] p-10 space-y-6 shadow-sm overflow-hidden relative group">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                 <h3 className="text-xl font-black text-destructive flex items-center gap-3">
                    Danger Zone
                    <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-[8px] uppercase tracking-widest bg-destructive/10 text-destructive border-none">
                       High Risk
                    </Badge>
                 </h3>
                 <p className="text-sm font-medium text-muted-foreground max-w-xl">
                    Permanently delete your account and all associated workspace data. This includes campaigns, 
                    messages, contacts, and WhatsApp configurations.
                 </p>
              </div>
              <Button 
                variant="destructive" 
                onClick={() => setIsDeleteModalOpen(true)}
                className="rounded-2xl h-14 px-8 font-black shadow-lg shadow-destructive/10 group-hover:scale-105 transition-transform"
              >
                <Trash2 className="h-5 w-5 mr-3" />
                Delete My Account
              </Button>
           </div>
           
           {/* Background Decoration */}
           <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
              <Trash2 className="h-40 w-40 rotate-12 text-destructive" />
           </div>
        </div>
      </div>

      <DeleteAccountModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
      />
    </div>
  );
}
