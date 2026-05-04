"use client";

import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  ImageIcon, 
  Video, 
  FileText, 
  MapPin, 
  MessageSquare,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  UploadCloud,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createTemplate, updateTemplate } from '@/lib/api/templates';
import { fetchFlows } from '@/lib/api/flows';
import { uploadMedia } from '@/lib/api/inbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import CarouselCardEditor, { type CarouselCard } from '@/components/dashboard/templates/carousel-card-editor';
import CarouselPreview from '@/components/dashboard/templates/carousel-preview';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: any;
}

export default function CreateTemplateModal({ isOpen, onClose, template }: CreateTemplateModalProps) {
  const getHeaderIcon = (format: string) => {
    switch (format) {
      case 'IMAGE': return <ImageIcon className="h-4 w-4" />;
      case 'VIDEO': return <Video className="h-4 w-4" />;
      case 'DOCUMENT': return <FileText className="h-4 w-4" />;
      case 'LOCATION': return <MapPin className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (template) {
      const headerItem = template.components?.find((c: any) => c.type === 'HEADER');
      const bodyItem = template.components?.find((c: any) => c.type === 'BODY');
      const footerItem = template.components?.find((c: any) => c.type === 'FOOTER');
      const buttonsItem = template.components?.find((c: any) => c.type === 'BUTTONS');

      return {
        name: template.name || '',
        category: template.category || 'MARKETING',
        language: template.language || 'en_US',
        header: {
          enabled: !!headerItem,
          format: headerItem?.format || 'TEXT',
          text: headerItem?.text || '',
          mediaUrl: headerItem?.format === 'IMAGE' && headerItem?.example?.header_handle ? headerItem.example.header_handle[0] : ''
        },
        body: {
          text: bodyItem?.text || '',
          examples: bodyItem?.example?.body_text?.[0] || [],
        },
        footer: {
          enabled: !!footerItem,
          text: footerItem?.text || '',
        },
        buttons: {
          enabled: !!buttonsItem,
          items: buttonsItem?.buttons || [],
        },
        templateType: (template.templateType || 'STANDARD') as 'STANDARD' | 'LTO' | 'CAROUSEL',
        lto: {
          enabled: template.templateType === 'LTO',
          hasExpiration: template.lto?.hasExpiration || false,
          expirationTimeMs: template.lto?.expirationTimeMs
        },
        carousel: {
          cards: template.carousel?.cards || [{
            headerFormat: 'IMAGE',
            mediaUrl: '',
            mediaHandle: '',
            bodyText: '',
            buttons: [{ type: 'QUICK_REPLY', text: '' }]
          }]
        }
      };
    }
    return {
      name: '',
      category: 'MARKETING',
      language: 'en_US',
      templateType: 'STANDARD' as 'STANDARD' | 'LTO' | 'CAROUSEL',
      header: {
        enabled: false,
        format: 'TEXT',
        text: '',
        mediaUrl: ''
      },
      body: {
        text: '',
        examples: [] as string[],
      },
      footer: {
        enabled: false,
        text: '',
      },
      buttons: {
        enabled: false,
        items: [] as any[],
      },
      lto: {
        enabled: false,
        hasExpiration: false,
        expirationTimeMs: undefined as number | undefined
      },
      carousel: {
        cards: [{
          headerFormat: 'IMAGE' as 'IMAGE' | 'VIDEO',
          mediaUrl: '',
          mediaHandle: '',
          bodyText: '',
          buttons: [{ type: 'QUICK_REPLY' as const, text: '' }]
        }] as CarouselCard[]
      }
    };
  });

  const { data: flows = [] } = useQuery({
    queryKey: ['whatsapp-flows'],
    queryFn: fetchFlows,
    enabled: isOpen
  });

  const publishedFlows = flows.filter(f => f.status === 'PUBLISHED');

  const extractVariables = (text: string) => {
    if (!text) return [];
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    const vars = matches.map(m => parseInt(m.replace(/[{}]/g, '')));
    return Array.from(new Set(vars)).sort((a, b) => a - b);
  };

  const bodyVariables = extractVariables(formData.body.text);

  const updateBodyText = (text: string) => {
    const vars = extractVariables(text);
    const newExamples = [...formData.body.examples];
    
    // Ensure examples array matches the number of variables found
    if (newExamples.length < vars.length) {
      const diff = vars.length - newExamples.length;
      newExamples.push(...Array(diff).fill(''));
    } else if (newExamples.length > vars.length) {
      newExamples.splice(vars.length);
    }
    
    setFormData({ ...formData, body: { text, examples: newExamples } });
  };

  const updateBodyExample = (index: number, value: string) => {
    const newExamples = [...formData.body.examples];
    newExamples[index] = value;
    setFormData({ ...formData, body: { ...formData.body, examples: newExamples } });
  };

  const mutation = useMutation({
    mutationFn: (data: any) => template ? updateTemplate(template.id || template._id, data) : createTemplate(data),
    onSuccess: async (res: any) => {
      const isNew = !template;
      toast.success(`Template ${isNew ? 'created' : 'updated'} successfully`);
      
      // If the user wants to submit immediately after creating/updating
      if (shouldSubmitAfterSave) {
        const id = res.data?._id || (template?.id || template?._id);
        if (id) {
            submitMutation.mutate(id);
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ['templates'] });
        onClose();
      }
    },
    onError: (err: any) => toast.error(err.message || 'Action failed')
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => import('@/lib/api/templates').then(m => m.submitTemplateToMeta(id)),
    onSuccess: () => {
      toast.success('Template submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Submission failed');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      // Keep modal open if submission failed so they can fix things if needed, 
      // but usually the save already happened.
    }
  });

  const [shouldSubmitAfterSave, setShouldSubmitAfterSave] = useState(false);

  const handleSubmit = (submitForApproval = false) => {
    setShouldSubmitAfterSave(submitForApproval);
    // Include templateType and lto in the payload
    const payload: any = { ...formData };
    if (formData.templateType === 'LTO') {
      payload.templateType = 'LTO';
      payload.lto = {
        enabled: true,
        hasExpiration: formData.lto.hasExpiration,
        expirationTimeMs: formData.lto.expirationTimeMs
      };
    } else if (formData.templateType === 'CAROUSEL') {
      payload.templateType = 'CAROUSEL';
      payload.carousel = { cards: formData.carousel.cards };
    }
    mutation.mutate(payload);
  };

  const addButton = () => {
    if (formData.buttons.items.length >= 3) return;
    const defaultType = formData.category === 'AUTHENTICATION' ? 'OTP' : 'QUICK_REPLY';
    const newItems = [...formData.buttons.items, { type: defaultType, text: '' }];
    setFormData({ ...formData, buttons: { ...formData.buttons, items: newItems } });
  };

  const removeButton = (index: number) => {
    const newItems = formData.buttons.items.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, buttons: { ...formData.buttons, items: newItems } });
  };

  const updateButton = (index: number, field: string, value: string) => {
    const newItems = [...formData.buttons.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, buttons: { ...formData.buttons, items: newItems } });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    let file: File | null = null;
    if ('dataTransfer' in e && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    } else if ('target' in e && (e.target as HTMLInputElement).files && (e.target as HTMLInputElement).files!.length > 0) {
      file = (e.target as HTMLInputElement).files![0];
    }
    if (!file) return;

    setIsUploading(true);
    try {
      const res: any = await uploadMedia(file);
      if ((res as any)?.success && (res as any)?.url) {
        setFormData({ ...formData, header: { ...formData.header, mediaUrl: (res as any).url } } as any);
        toast.success('Media uploaded successfully');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload media');
    } finally {
      setIsUploading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && (!formData.name || !formData.category || !formData.language)) {
      toast.error('Please fill in all template details');
      return;
    }
    if (currentStep === 2) {
      if (!formData.body.text) {
        toast.error('Template body is required');
        return;
      }
      if (bodyVariables.length > 0 && formData.body.examples.some((ex: string) => !ex.trim())) {
        toast.error(`Please provide example values for all ${bodyVariables.length} variables`);
        return;
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };
  
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl max-h-[90vh] bg-card border border-border/50 rounded-[40px] shadow-2xl overflow-hidden flex flex-col lg:flex-row"
      >
        {/* Form Area */}
        <div className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h2 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
                {template ? 'Edit Template' : 'New Template'}
                <Badge className="bg-primary/5 text-primary border-primary/10 rounded-full h-6">Step {currentStep} of 3</Badge>
              </h2>
              <p className="text-muted-foreground text-sm font-medium">
                {currentStep === 1 && "Start with the template basics."}
                {currentStep === 2 && "Design your message content and buttons."}
                {currentStep === 3 && "Review and submit your complete structure."}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-2xl h-12 w-12 hover:bg-muted"><X className="h-5 w-5" /></Button>
          </div>

          <div className="flex-1 space-y-8">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-full">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Template Name</Label>
                  <Input 
                    placeholder="e.g. welcome_message" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                  className="h-12 rounded-2xl bg-muted/20 border-border/50 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Category</Label>
                <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                  <SelectTrigger className="h-12 rounded-2xl bg-muted/20 border-border/50 font-bold uppercase text-xs tracking-wider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-premium border-border/50">
                     <SelectItem value="MARKETING" className="rounded-xl font-bold">Marketing</SelectItem>
                     <SelectItem value="UTILITY" className="rounded-xl font-bold">Utility</SelectItem>
                     <SelectItem value="AUTHENTICATION" className="rounded-xl font-bold">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Language</Label>
                <Select value={formData.language} onValueChange={(val) => setFormData({ ...formData, language: val })}>
                  <SelectTrigger className="h-12 rounded-2xl bg-muted/20 border-border/50 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-premium border-border/50">
                     <SelectItem value="en_US" className="rounded-xl font-bold">English (US)</SelectItem>
                     <SelectItem value="hi_IN" className="rounded-xl font-bold">Hindi (IN)</SelectItem>
                     <SelectItem value="es_ES" className="rounded-xl font-bold">Spanish (ES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Type Selector */}
              <div className="space-y-2 col-span-full">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Template Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'STANDARD', label: 'Standard', desc: 'Regular template', icon: '📝' },
                    { id: 'CAROUSEL', label: 'Carousel', desc: 'Multi-card scrollable (up to 10)', icon: '🎠' },
                    { id: 'LTO', label: 'Limited Time Offer', desc: 'Countdown timer + offer code', icon: '⏰' },
                  ].map((tt) => (
                    <button
                      key={tt.id}
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        templateType: tt.id as 'STANDARD' | 'LTO' | 'CAROUSEL',
                        lto: tt.id === 'LTO' 
                          ? { ...formData.lto, enabled: true }
                          : { enabled: false, hasExpiration: false, expirationTimeMs: undefined }
                      })}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        formData.templateType === tt.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border/50 hover:border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{tt.icon}</span>
                        <div>
                          <p className="text-sm font-black text-foreground">{tt.label}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">{tt.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              </motion.div>
            )}

            {/* Step 2: Header Section & Body & Footer */}
            {currentStep === 2 && (
             <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">

             {/* ══════ CAROUSEL MODE ══════ */}
             {formData.templateType === 'CAROUSEL' ? (
               <div className="space-y-6">
                 {/* Carousel body text (shared across all cards) */}
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                     Carousel Body Text
                   </Label>
                   <Textarea
                     placeholder="This text appears above the carousel cards..."
                     className="min-h-[80px] rounded-2xl bg-muted/10 border-border/50 font-medium resize-none"
                     maxLength={1024}
                     value={formData.body.text}
                     onChange={(e) => updateBodyText(e.target.value)}
                   />
                   <p className="text-[9px] text-muted-foreground text-right font-bold">{formData.body.text.length}/1024</p>
                 </div>

                 {/* Carousel Card Editor */}
                 <CarouselCardEditor
                   cards={formData.carousel.cards}
                   onChange={(cards) => setFormData({ 
                     ...formData, 
                     carousel: { ...formData.carousel, cards } 
                   })}
                   onUploadMedia={async (cardIndex, file) => {
                     setIsUploading(true);
                     try {
                       const res: any = await uploadMedia(file);
                       if (res?.success && res?.url) {
                         return { url: res.url, handle: res.handle || '' };
                       }
                       throw new Error('Upload failed');
                     } finally {
                       setIsUploading(false);
                     }
                   }}
                   isUploading={isUploading}
                 />
               </div>
             ) : (
             /* ══════ STANDARD / LTO MODE ══════ */
             <>
             <div className="space-y-4 pt-4 border-t border-border/30">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <Label className="text-[11px] font-black uppercase tracking-widest text-foreground">Header Content</Label>
                  </div>
                  <Switch 
                    checked={formData.header.enabled} 
                    onCheckedChange={(val) => setFormData({ ...formData, header: { ...formData.header, enabled: val } })} 
                  />
               </div>
               
               {formData.header.enabled && (
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                   <Select 
                    value={formData.header.format} 
                    onValueChange={(val) => setFormData({ ...formData, header: { ...formData.header, format: val } })}
                   >
                     <SelectTrigger className="h-11 rounded-xl bg-muted/10 border-border/50 font-bold col-span-1">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                        <SelectItem value="TEXT" className="rounded-lg">Text</SelectItem>
                        <SelectItem value="IMAGE" className="rounded-lg">Image</SelectItem>
                        <SelectItem value="VIDEO" className="rounded-lg">Video</SelectItem>
                        <SelectItem value="DOCUMENT" className="rounded-lg">Document</SelectItem>
                     </SelectContent>
                   </Select>
                   
                   {formData.header.format === 'TEXT' ? (
                     <Input 
                      placeholder="Header text..." 
                      className="h-11 rounded-xl bg-muted/10 border-border/50 font-medium col-span-3"
                      value={formData.header.text}
                      onChange={(e) => setFormData({ ...formData, header: { ...formData.header, text: e.target.value } })}
                     />
                   ) : ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formData.header.format) ? (
                     <div className="col-span-3 flex flex-col gap-3">
                       <label 
                        className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer border-border/60 hover:bg-muted/20 transition-colors ${
                          isUploading ? 'opacity-50 pointer-events-none' : ''
                        }`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileUpload as any}
                       >
                         <div className="flex flex-col items-center justify-center pt-5 pb-6">
                           {isUploading ? (
                              <Loader2 className="w-8 h-8 mb-3 text-muted-foreground animate-spin" />
                           ) : (
                              <UploadCloud className="w-8 h-8 mb-3 text-muted-foreground" />
                           )}
                           <p className="mb-1 text-sm text-muted-foreground">
                             <span className="font-semibold">Click to upload</span> or drag and drop
                           </p>
                           <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                             {formData.header.format === 'IMAGE' && 'Supported: JPG, PNG (max 5MB)'}
                             {formData.header.format === 'VIDEO' && 'Supported: MP4 (max 16MB)'}
                             {formData.header.format === 'DOCUMENT' && 'Supported: PDF (max 100MB)'}
                           </p>
                         </div>
                         <input 
                            type="file" 
                            className="hidden" 
                            disabled={isUploading}
                            onChange={handleFileUpload}
                            accept={
                              formData.header.format === 'IMAGE' ? 'image/jpeg, image/png' :
                              formData.header.format === 'VIDEO' ? 'video/mp4' :
                              formData.header.format === 'DOCUMENT' ? 'application/pdf' : ''
                            }
                          />
                       </label>
                       
                       <div className="flex items-center gap-2 opacity-50">
                         <div className="h-[1px] flex-1 bg-border" />
                         <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">OR ADD URL</span>
                         <div className="h-[1px] flex-1 bg-border" />
                       </div>

                       <Input 
                        type="url"
                        disabled={isUploading}
                        placeholder={`https://example.com/sample.${formData.header.format === 'IMAGE' ? 'jpg' : formData.header.format === 'VIDEO' ? 'mp4' : 'pdf'}`} 
                        className="h-11 rounded-xl bg-muted/10 border-border/50 font-medium"
                        value={(formData.header as any).mediaUrl || ''}
                        onChange={(e) => setFormData({ ...formData, header: { ...formData.header, mediaUrl: e.target.value } } as any)}
                       />
                     </div>
                   ) : null}
                 </div>
               )}
            </div>

            {/* Body Section */}
            <div className="space-y-4 pt-4 border-t border-border/30">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <FileText className="h-4 w-4" />
                    </div>
                    <Label className="text-[11px] font-black uppercase tracking-widest text-foreground">Message Body</Label>
                  </div>
                  <Badge variant="outline" className="h-5 text-[9px] font-black uppercase tracking-tighter opacity-70">Mandatory</Badge>
               </div>
               <div className="space-y-2 relative">
                 <Textarea 
                  placeholder="Enter your message here. Use {{1}}, {{2}} for variables." 
                  className="min-h-[160px] rounded-2xl bg-muted/10 border-border/50 focus:ring-primary/10 p-5 font-medium leading-relaxed"
                  value={formData.body.text}
                  onChange={(e) => updateBodyText(e.target.value)}
                  onKeyDown={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const value = target.value;
                    
                    let toInsert = '';
                    if (e.key === '{') toInsert = '}';
                    else if (e.key === '(') toInsert = ')';
                    else if (e.key === '[') toInsert = ']';
                    
                    if (toInsert) {
                      e.preventDefault();
                      const newValue = value.substring(0, start) + e.key + toInsert + value.substring(end);
                      updateBodyText(newValue);
                      setTimeout(() => {
                        target.setSelectionRange(start + 1, start + 1);
                      }, 0);
                    }
                  }}
                 />
                 <Button 
                    onClick={() => {
                        toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
                            loading: 'AI is thinking...',
                            success: () => {
                                const texts = [
                                    "Hi {{1}}, welcome to our platform! We're excited to have you on board.",
                                    "Hello {{1}}! Your order {{2}} has been confirmed and will be shipped soon.",
                                    "Hey {{1}}, just a quick reminder that your appointment is scheduled for {{2}}."
                                ];
                                updateBodyText(texts[Math.floor(Math.random() * texts.length)]);
                                return 'Template updated with AI';
                            },
                            error: 'AI failed to generate'
                        });
                    }}
                    variant="ghost"
                    className="absolute bottom-3 right-3 flex items-center gap-2 hover:bg-primary/5 hover:text-primary transition-colors rounded-xl px-3 py-1.5 h-auto text-primary/60"
                 >
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Enhanced with AI</span>
                 </Button>
               </div>

               {bodyVariables.length > 0 && (
                 <div className="bg-muted/30 border border-border/50 rounded-2xl p-5 mt-4 space-y-4 animate-in slide-in-from-top-2">
                   <Label className="text-[11px] font-black uppercase tracking-widest text-foreground">Variable Examples</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {bodyVariables.map((varNum, index) => (
                       <div key={varNum} className="space-y-2">
                         <Label className="text-[10px] font-bold text-muted-foreground ml-1">Example for {`{{${varNum}}}`}</Label>
                         <Input
                           type="text"
                           placeholder={`Sample value...`}
                           value={formData.body.examples[index] || ''}
                           onChange={(e) => updateBodyExample(index, e.target.value)}
                           className="h-10 rounded-xl bg-background border-border/50"
                         />
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>

            {/* Footer Section */}
            <div className="space-y-4 pt-4 border-t border-border/30">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <Label className="text-[11px] font-black uppercase tracking-widest text-foreground">Footer text</Label>
                  </div>
                  <Switch 
                    checked={formData.footer.enabled} 
                    onCheckedChange={(val) => setFormData({ ...formData, footer: { ...formData.footer, enabled: val } })} 
                  />
               </div>
               {formData.footer.enabled && (
                 <Input 
                  placeholder="e.g. Reply STOP to opt out" 
                  className="h-11 rounded-xl bg-muted/10 border-border/50 font-medium animate-in slide-in-from-top-2"
                  value={formData.footer.text}
                  onChange={(e) => setFormData({ ...formData, footer: { ...formData.footer, text: e.target.value } })}
                 />
               )}
            </div>

            {/* LTO Configuration — only visible when template type is LTO */}
            {formData.templateType === 'LTO' && (
              <div className="space-y-4 pt-4 border-t border-border/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <span className="text-sm">⏰</span>
                  </div>
                  <Label className="text-[11px] font-black uppercase tracking-widest text-foreground">Limited Time Offer Settings</Label>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">Expiration Countdown</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Show a countdown timer in the message</p>
                    </div>
                    <Switch
                      checked={formData.lto.hasExpiration}
                      onCheckedChange={(val) => setFormData({ 
                        ...formData, 
                        lto: { ...formData.lto, hasExpiration: val }
                      })}
                    />
                  </div>

                  {formData.lto.hasExpiration && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Offer Expiry (hours from send time)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        placeholder="e.g., 24"
                        className="h-11 rounded-xl bg-muted/10 border-border/50 font-bold"
                        value={formData.lto.expirationTimeMs ? Math.round(formData.lto.expirationTimeMs / 3600000) : ''}
                        onChange={(e) => {
                          const hours = parseInt(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            lto: { ...formData.lto, expirationTimeMs: hours * 3600000 }
                          });
                        }}
                      />
                      <p className="text-[9px] text-muted-foreground italic">The countdown timer will appear in the WhatsApp message. Max 30 days (720 hours).</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Buttons */}
            <div className="space-y-4 pt-4 border-t border-border/30">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center">
                      <Zap className="h-4 w-4" />
                    </div>
                    <Label className="text-[11px] font-black uppercase tracking-widest text-foreground">Interactive Buttons</Label>
                  </div>
                  <Switch 
                    checked={formData.buttons.enabled} 
                    onCheckedChange={(val) => setFormData({ ...formData, buttons: { ...formData.buttons, enabled: val } })} 
                  />
               </div>
               
               {formData.buttons.enabled && (
                 <div className="space-y-3 animate-in slide-in-from-top-2">
                    {formData.buttons.items.map((btn: any, i: number) => (
                      <div key={i} className="flex gap-3 group items-start">
                        <Select 
                          value={btn.type} 
                          onValueChange={(val) => updateButton(i, 'type', val)}
                        >
                          <SelectTrigger className="w-40 h-10 rounded-xl bg-muted/10 border-border/50 font-bold shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {formData.category === 'AUTHENTICATION' ? (
                              <SelectItem value="OTP" className="rounded-lg">Copy Code</SelectItem>
                            ) : (
                              <>
                                <SelectItem value="QUICK_REPLY" className="rounded-lg">Quick Reply</SelectItem>
                                <SelectItem value="URL" className="rounded-lg">Visit Website</SelectItem>
                                <SelectItem value="PHONE_NUMBER" className="rounded-lg">Call Number</SelectItem>
                                <SelectItem value="COPY_CODE" className="rounded-lg">Copy Offer Code</SelectItem>
                                <SelectItem value="CATALOG" className="rounded-lg">View Catalog</SelectItem>
                                <SelectItem value="FLOW" className="rounded-lg">WhatsApp Flow</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <div className="flex-1 flex flex-col gap-2">
                          <Input 
                            placeholder={btn.type === 'OTP' ? "e.g., Copy Code" : "Button text..."} 
                            className="h-10 rounded-xl bg-muted/10 border-border/50 font-bold"
                            value={btn.text}
                            onChange={(e) => updateButton(i, 'text', e.target.value)}
                          />
                          {btn.type === 'URL' && (
                            <Input 
                              type="url"
                              placeholder="https://example.com" 
                              className="h-10 rounded-xl bg-muted/10 border-border/50 text-sm"
                              value={(btn as any).url || ''}
                              onChange={(e) => updateButton(i, 'url', e.target.value)}
                            />
                          )}
                          {btn.type === 'PHONE_NUMBER' && (
                            <Input 
                              type="tel"
                              placeholder="+1234567890" 
                              className="h-10 rounded-xl bg-muted/10 border-border/50 text-sm"
                              value={(btn as any).phoneNumber || ''}
                              onChange={(e) => updateButton(i, 'phoneNumber', e.target.value)}
                            />
                          )}
                          {btn.type === 'COPY_CODE' && (
                            <Input 
                              placeholder="Offer code (e.g., SAVE20)" 
                              className="h-10 rounded-xl bg-muted/10 border-border/50 text-sm"
                              value={(btn as any).example || ''}
                              onChange={(e) => updateButton(i, 'example', e.target.value)}
                            />
                          )}
                          {btn.type === 'FLOW' && (
                            <div className="flex flex-col gap-2">
                              <Select 
                                value={(btn as any).flowId || ''} 
                                onValueChange={(val) => updateButton(i, 'flowId', val)}
                              >
                                <SelectTrigger className="h-10 rounded-xl bg-muted/10 border-border/50 text-sm">
                                  <SelectValue placeholder="Select a published flow..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {publishedFlows.map(f => (
                                    <SelectItem key={f._id} value={f.gupshupFlowId || f._id} className="rounded-lg font-medium">
                                      {f.name}
                                    </SelectItem>
                                  ))}
                                  {publishedFlows.length === 0 && (
                                    <SelectItem value="none" disabled className="text-muted-foreground">No published flows found</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <Input 
                                placeholder="Navigate Screen (e.g., INITIAL_SCREEN)" 
                                className="h-10 rounded-xl bg-muted/10 border-border/50 text-sm"
                                value={(btn as any).navigateScreen || ''}
                                onChange={(e) => updateButton(i, 'navigateScreen', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeButton(i)}
                          className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10 rounded-xl"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {formData.buttons.items.length < 3 && (
                      <Button 
                        variant="ghost" 
                        onClick={addButton}
                        className="w-full h-10 rounded-xl border-dashed border-2 hover:bg-muted font-bold text-muted-foreground"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Button
                      </Button>
                    )}
                 </div>
               )}
            </div>
             </>
             )}
             </motion.div>
            )}

            {/* Step 3: Preview confirmation in normal area if needed or just confirmation, since preview is always right side */}
            {currentStep === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                 <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center scale-110 mb-4">
                   <CheckCircle2 className="h-8 w-8" />
                 </div>
                 <h3 className="text-xl font-black text-foreground">Review & Submit</h3>
                 <p className="text-muted-foreground text-sm max-w-[280px]">
                   Please double-check your template content and variables in the preview pane before submitting for Meta formatting approval.
                 </p>
              </motion.div>
            )}

          </div>

          <div className="pt-10 flex items-center justify-between border-t border-border/30 mt-auto">
            <Button 
                variant="ghost" 
                onClick={currentStep === 1 ? onClose : prevStep} 
                className="rounded-2xl h-12 px-8 font-bold text-muted-foreground"
            >
                {currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>
            
            {currentStep < 3 ? (
                <Button 
                    onClick={nextStep}
                    className="rounded-2xl h-12 px-10 font-black shadow-lg shadow-primary/20 bg-primary group"
                >
                    Continue
                </Button>
            ) : (
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline"
                        onClick={() => handleSubmit(false)}
                        disabled={mutation.isPending || submitMutation.isPending || !formData.name || !formData.body.text}
                        className="rounded-2xl h-12 px-8 font-bold border-primary/20 text-primary hover:bg-primary/5"
                    >
                        {mutation.isPending && !shouldSubmitAfterSave ? 'Saving...' : 'Save Draft'}
                    </Button>
                    <Button 
                        onClick={() => handleSubmit(true)}
                        disabled={mutation.isPending || submitMutation.isPending || !formData.name || !formData.body.text}
                        className="rounded-2xl h-12 px-10 font-black shadow-lg shadow-primary/20 bg-primary group"
                    >
                        {(mutation.isPending || submitMutation.isPending) && shouldSubmitAfterSave ? 'Submitting...' : 'Save & Submit'}
                    </Button>
                </div>
            )}
          </div>
        </div>

        {/* Preview Area */}
        <div className="w-full lg:w-[420px] bg-slate-100 dark:bg-slate-900/50 p-8 flex flex-col items-center justify-center border-l border-border/30 relative">
           <div className="absolute top-8 left-8 flex items-center gap-2 opacity-50">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest">Post-Sync Preview</span>
           </div>

           <div className="w-full max-w-[320px] bg-white dark:bg-[#0b141a] rounded-[24px] shadow-2xl overflow-hidden border border-border/50 flex flex-col">
              <div className="bg-[#075e54] p-4 flex items-center gap-3">
                 <div className="h-8 w-8 rounded-full bg-white/20" />
                 <div className="h-3 w-24 rounded bg-white/20" />
              </div>
              
              <div className="p-3 space-y-2 flex-1 relative bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-[length:400px]">

                 {/* ══════ CAROUSEL PREVIEW ══════ */}
                 {formData.templateType === 'CAROUSEL' ? (
                   <CarouselPreview
                     bodyText={formData.body.text}
                     footerText={formData.footer.enabled ? formData.footer.text : undefined}
                     cards={formData.carousel.cards}
                   />
                 ) : (
                 <>
                 <div className="bg-white dark:bg-[#202c33] p-0.5 rounded-lg shadow-sm max-w-[90%] float-left">
                    {formData.header.enabled && (
                      <div className="aspect-video bg-slate-200 dark:bg-white/5 rounded-t-lg flex items-center justify-center text-slate-400">
                        {formData.header.format === 'TEXT' ? (
                          <span className="p-3 text-[13px] font-bold text-slate-800 dark:text-slate-100 w-full text-left line-clamp-1">{formData.header.text || 'Header Text'}</span>
                        ) : (formData.header as any).mediaUrl ? (
                          formData.header.format === 'IMAGE' ? (
                            <img src={(formData.header as any).mediaUrl} alt="Header Media" className="w-full h-full object-cover rounded-t-lg" />
                          ) : formData.header.format === 'VIDEO' ? (
                            <video src={(formData.header as any).mediaUrl} className="w-full h-full object-cover rounded-t-lg" controls muted loop playsInline />
                          ) : (
                            <div className="flex flex-col items-center gap-1 opacity-60">
                              <FileText className="h-8 w-8 text-indigo-500" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#00a884] bg-white rounded-md px-2 py-0.5">Sample PDF Attached</span>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center gap-1 opacity-40">
                            {getHeaderIcon(formData.header.format)}
                            <span className="text-[9px] font-black uppercase tracking-widest">{formData.header.format}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="p-3 space-y-2">
                       <p className="text-[13px] text-slate-800 dark:text-slate-100 leading-relaxed font-medium whitespace-pre-wrap break-words word-break break-all">
                         {(() => {
                           let text = formData.body.text || 'Your message body will appear here...';
                           if (bodyVariables.length > 0) {
                             bodyVariables.forEach((num, index) => {
                               const val = formData.body.examples[index] || `{{${num}}}`;
                               text = text.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), val);
                             });
                           }
                           return text;
                         })()}
                       </p>
                       {formData.footer.enabled && (
                         <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{formData.footer.text || 'Footer text'}</p>
                       )}
                    </div>
                 </div>

                 <div className="clear-both space-y-1.5 pt-2">
                    {formData.buttons.enabled && formData.buttons.items.map((btn: any, i: number) => (
                      <div key={i} className="bg-white dark:bg-[#202c33] rounded-xl shadow-sm py-2 px-4 flex items-center justify-center gap-2 text-[13px] font-bold text-[#00a884] border-t border-transparent dark:border-white/5">
                        {btn.type === 'URL' && <ExternalLink className="h-3 w-3" />}
                        {btn.type === 'PHONE_NUMBER' && <CheckCircle2 className="h-3 w-3" />}
                        {btn.type === 'OTP' && <Zap className="h-3 w-3" />}
                        {btn.text || 'Button'}
                      </div>
                    ))}
                 </div>
                 </>
                 )}
              </div>
           </div>

           <div className="mt-8 flex items-center gap-3 text-emerald-500 animate-pulse">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Official Business API Preview</span>
           </div>
        </div>
      </motion.div>
    </div>
  );
}

function ShieldCheck({ className }: any) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
