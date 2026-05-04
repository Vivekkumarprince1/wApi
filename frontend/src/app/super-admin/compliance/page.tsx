"use client";

import React from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  Save, 
  Building2, 
  Users, 
  FileText, 
  Upload, 
  MoreVertical, 
  CheckCircle2, 
  FileBadge, 
  Lock,
  Globe,
  Plus,
  Trash2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { cn } from '@/lib/utils';

export default function CompliancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: complianceRes, isLoading: complianceLoading } = useQuery({
    queryKey: ['super-admin', 'compliance'],
    queryFn: () => apiClient.get('/super-admin/compliance-profile'), 
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiClient.patch('/super-admin/compliance-profile', data),
    onSuccess: () => {
      toast.success('Compliance matrix updated successfully');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'compliance'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update compliance'),
  });

  return (
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10 pb-20 font-inter">
        <SuperAdminPageHeader
          icon={ShieldCheck}
          eyebrow="Governance & Risk"
          title="Verification & Compliance"
          subtitle="Manage enterprise business identity, regulatory documentation, and compliance frameworks to maintain active platform status."
          actions={(
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12 rounded-2xl px-6 border-slate-200 font-black uppercase tracking-widest text-[10px]"
                onClick={() => router.back()}
              >
                Discard Changes
              </Button>
              <Button
                className="h-12 rounded-2xl px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20"
                onClick={() => saveMutation.mutate({})}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Validating' : 'Confirm Compliance'} <CheckCircle2 className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Left Column: Primary Forms */}
          <div className="xl:col-span-8 space-y-8">
            {/* Business Identity */}
            <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="font-manrope text-lg font-black uppercase tracking-tight">Business Identity</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Legal entity details and registration</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 py-1 font-black text-[9px] uppercase tracking-widest">
                    <CheckCircle2 className="h-3 w-3 mr-1.5" /> Verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Legal Entity Name</Label>
                    <Input className="h-12 bg-white border-slate-200 rounded-xl font-bold px-4" defaultValue="Acme Global Enterprise Solutions Ltd." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Registration Number (EIN/CRN)</Label>
                    <Input className="h-12 bg-white border-slate-200 rounded-xl font-mono text-[11px] font-bold" defaultValue="98-7654321" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Jurisdiction</Label>
                    <Select defaultValue="us-delaware">
                      <SelectTrigger className="h-12 bg-white border-slate-200 rounded-xl font-bold px-4">
                        <SelectValue placeholder="Select Jurisdiction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us-delaware">Delaware, United States</SelectItem>
                        <SelectItem value="uk-london">London, United Kingdom</SelectItem>
                        <SelectItem value="ie-dublin">Dublin, Ireland</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Registered Corporate Address</Label>
                   <Input className="h-12 bg-white border-slate-200 rounded-xl font-bold px-4" defaultValue="1200 Enterprise Way, Suite 400" />
                   <div className="grid grid-cols-3 gap-4">
                     <Input className="h-11 bg-white border-slate-200 rounded-xl font-bold px-4 text-xs" placeholder="City" defaultValue="San Francisco" />
                     <Input className="h-11 bg-white border-slate-200 rounded-xl font-bold px-4 text-xs" placeholder="State" defaultValue="CA" />
                     <Input className="h-11 bg-white border-slate-200 rounded-xl font-bold px-4 text-xs" placeholder="Zip" defaultValue="94111" />
                   </div>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Officers */}
            <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="font-manrope text-lg font-black uppercase tracking-tight">Compliance Officers</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Designated points of contact for audits</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" className="h-8 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-500/5">
                    <Plus className="h-3.5 w-3.5 mr-2" /> Add Officer
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {[
                    { name: 'Jane Doe', role: 'Chief Privacy Officer', email: 'jane.doe@acme.com', initial: 'JD' },
                    { name: 'Robert Smith', role: 'Legal Counsel', email: 'r.smith@acme.com', initial: 'RS' }
                  ].map((officer, i) => (
                    <div key={i} className="px-8 py-5 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm">{officer.initial}</div>
                        <div className="flex flex-col">
                           <span className="text-sm font-black text-slate-800">{officer.name}</span>
                           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{officer.role} • {officer.email}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl opacity-0 group-hover:opacity-100 hover:text-destructive transition-all">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Frameworks & Docs */}
          <div className="xl:col-span-4 space-y-8">
            {/* Active Frameworks */}
            <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4 border-b border-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="font-manrope text-sm font-black uppercase tracking-tight">Active Frameworks</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Compliance certifications</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                {[
                  { name: 'SOC 2 Type II', status: 'verified', expiry: 'Oct 2024', icon: Lock },
                  { name: 'GDPR Compliant', status: 'verified', expiry: 'Self-attested', icon: Globe },
                  { name: 'ISO 27001', status: 'pending', expiry: 'Audit Nov 2024', icon: FileBadge }
                ].map((f, i) => (
                  <div key={i} className={cn("p-4 rounded-[1.5rem] border flex flex-col gap-3 transition-all", f.status === 'verified' ? "bg-emerald-500/5 border-emerald-500/10" : "bg-slate-50 border-slate-100")}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", f.status === 'verified' ? "bg-white text-emerald-600 shadow-sm" : "bg-white text-slate-400 shadow-sm")}>
                          <f.icon className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest">{f.name}</span>
                      </div>
                      {f.status === 'verified' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest bg-slate-200">Pending</Badge>
                      )}
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">{f.expiry}</span>
                      {f.status === 'verified' && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 cursor-pointer hover:underline">View Report</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Legal Documents */}
            <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4 border-b border-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="font-manrope text-sm font-black uppercase tracking-tight">Legal Repository</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Executed contracts & tax forms</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center gap-4 hover:bg-indigo-500/5 transition-all cursor-pointer group">
                   <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      <Upload className="h-6 w-6" />
                   </div>
                   <div className="flex flex-col gap-1">
                      <span className="text-xs font-black uppercase tracking-widest">Upload Documentation</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">PDF, DOCX up to 50MB</span>
                   </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Required Files</h4>
                  {[
                    { name: 'Master_Service_Agreement_v3.pdf', size: '2.4 MB', date: '2d ago' },
                    { name: 'W9_Tax_Form_2024.pdf', size: '1.1 MB', date: '1w ago' }
                  ].map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
                      <div className="flex items-center gap-4 overflow-hidden">
                         <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-destructive shadow-sm">
                            <FileText className="h-5 w-5" />
                         </div>
                         <div className="flex flex-col overflow-hidden">
                            <span className="text-[11px] font-black text-slate-800 truncate">{file.name}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Uploaded {file.date} • {file.size}</span>
                         </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 group-hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
}
