"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Search,
  FileText,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  Info,
  ArrowRight,
  Loader2,
  Upload,
  FileImageIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchTemplates, Template } from "@/lib/api/templates";
import { uploadMedia } from "@/lib/api/inbox";
import { getGoogleSheetsColumns } from "@/lib/api/integrations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsAppBubble } from "../WhatsAppBubble";

interface MessageStepProps {
  campaignData: any;
  setCampaignData: (data: any) => void;
}

export default function MessageStep({
  campaignData,
  setCampaignData,
}: MessageStepProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ["templates", "APPROVED"],
    queryFn: () => fetchTemplates({ status: "APPROVED" }),
  });

  const templates: Template[] = templatesData?.data || [];

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const [uploadingMedia, setUploadingMedia] = useState(false);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const data: any = await uploadMedia(file);
      if (data.success) {
        setCampaignData({
          ...campaignData,
          variableMapping: {
            ...campaignData.variableMapping,
            mediaUrl: data.url,
          },
        });
        toast.success("Media uploaded successfully");
      } else {
        toast.error(data.message || "Media upload failed");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Network error uploading media");
    } finally {
      setUploadingMedia(false);
    }
  };

  const selectedTemplate = useMemo(
    () => templates.find((t) => t._id === campaignData.templateId),
    [templates, campaignData.templateId],
  );

  const templateVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    const fullTextToSearch = [
      selectedTemplate.bodyText,
      selectedTemplate.body?.text,
      selectedTemplate.header?.text,
      ...(selectedTemplate.buttons?.items || []).map((b) => b?.url || ""),
    ]
      .filter(Boolean)
      .join(" ");

    const matches = fullTextToSearch.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];

    // Sort numerically if they are numbers like 1, 2, 3
    const vars = [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
    return vars.sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [selectedTemplate]);

  const { data: sheetColumnsData } = useQuery({
    queryKey: ["google-sheet-columns", campaignData.googleSheetsConfig?.spreadsheetId, campaignData.googleSheetsConfig?.sheetName],
    queryFn: async () => {
      if (!campaignData.googleSheetsConfig?.spreadsheetId || !campaignData.googleSheetsConfig?.sheetName) return [];
      const resp = await getGoogleSheetsColumns(campaignData.googleSheetsConfig.spreadsheetId, campaignData.googleSheetsConfig.sheetName);
      return resp.columns || [];
    },
    enabled: campaignData.audienceMode === 'google_sheets' && !!campaignData.googleSheetsConfig?.spreadsheetId && !!campaignData.googleSheetsConfig?.sheetName
  });

  const sheetColumns = sheetColumnsData || [];

  const contactFields = useMemo(() => {
    const baseFields = [
      { value: "name", label: "Full Name" },
      { value: "firstName", label: "First Name" },
      { value: "lastName", label: "Last Name" },
      { value: "phone", label: "Phone Number" },
      { value: "email", label: "Email" },
    ];

    if (campaignData.audienceMode === 'google_sheets' && sheetColumns.length > 0) {
      return [
        ...baseFields,
        ...sheetColumns.map((col: string) => ({ value: col, label: `Sheet: ${col}` }))
      ];
    }

    return [
      ...baseFields,
      { value: "company", label: "Company" },
      { value: "custom", label: "Custom Value" },
    ];
  }, [campaignData.audienceMode, sheetColumns]);

  const handleVariableChange = (variable: string, field: string) => {
    const mapping = { ...campaignData.variableMapping };
    mapping[variable] = field;
    setCampaignData({ ...campaignData, variableMapping: mapping });
  };

  const handleTemplateSelect = (id: string) => {
    setCampaignData({ ...campaignData, templateId: id, variableMapping: {} });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-12">
        {/* Template Selection */}
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            Select Template
            <Badge variant="outline" className="text-[9px] font-black h-5">
              {templates.length} Approved
            </Badge>
          </Label>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus:ring-primary/20"
            />
          </div>

          <ScrollArea className="h-[600px] rounded-2xl border border-border/50 bg-muted/5 p-2 shadow-inner">
            {loadingTemplates ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <div
                    key={template._id}
                    onClick={() => handleTemplateSelect(template._id)}
                    className={`
                      p-3 rounded-xl border transition-all cursor-pointer group relative overflow-hidden
                      ${
                        campaignData.templateId === template._id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/10 shadow-sm"
                          : "border-border/50 bg-card hover:bg-muted/50"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-black uppercase tracking-tight ${campaignData.templateId === template._id ? "text-primary" : "text-foreground"}`}
                      >
                        {template.name}
                      </span>
                      {campaignData.templateId === template._id && (
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-muted-foreground font-medium line-clamp-1 opacity-70">
                        {template.bodyText || template.body?.text || "No content preview available"}
                      </p>
                    </div>
                    {campaignData.templateId === template._id && (
                      <div
                        className="mt-4 pt-4 border-t border-border/50 space-y-6 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Media Header Upload */}
                        {(template?.header?.format === "IMAGE" ||
                          template?.header?.format === "VIDEO" ||
                          template?.header?.format === "DOCUMENT") && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-amber-500">
                              <Upload className="h-4 w-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">
                                Media Header Config
                              </span>
                            </div>
                            <div className="p-8 rounded-[32px] border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-4 transition-all hover:border-primary/40 group relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              
                              <input
                                type="file"
                                id="media-upload"
                                className="hidden"
                                onChange={handleMediaUpload}
                                accept={
                                  template.header.format === "IMAGE"
                                    ? "image/*"
                                    : template.header.format === "VIDEO"
                                      ? "video/*"
                                      : "*/*"
                                }
                              />
                              <label 
                                htmlFor="media-upload"
                                className="flex flex-col items-center gap-3 cursor-pointer relative z-10"
                              >
                                <div className="p-4 rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform">
                                  <Upload className="h-6 w-6" />
                                </div>
                                <div className="text-center">
                                  <p className="text-sm font-bold text-foreground">
                                    {uploadingMedia ? "Uploading..." : `Upload ${template.header.format.toLowerCase()}`}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">
                                    Click or drag and drop
                                  </p>
                                </div>
                              </label>
                              
                              {campaignData.variableMapping?.mediaUrl && !uploadingMedia && (
                                <div className="mt-2 flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 animate-in zoom-in duration-300">
                                  <CheckCircle2 className="h-3 w-3" />
                                  File Ready: {campaignData.variableMapping.mediaUrl.split('/').pop()}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Pro Variable Mapping Canvas */}
                        {templateVariables.length > 0 && (
                          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between border-b border-border pb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                                  <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="text-xs font-black uppercase tracking-[0.2em]">Payload Configuration</h3>
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Map dynamic data fields</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="bg-muted text-muted-foreground border-border text-[8px] font-black tracking-widest px-2.5">
                                {templateVariables.length} SLOTS
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                              {templateVariables.map((variable) => (
                                <div
                                  key={variable}
                                  className="group relative"
                                >
                                  <div className="flex flex-col md:flex-row md:items-center gap-4 bg-muted/20 hover:bg-muted/40 p-4 rounded-2xl border border-border/50 transition-all group-hover:border-primary/20">
                                    <div className="flex items-center gap-3 min-w-[120px]">
                                      <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center font-mono text-[9px] font-black text-primary border border-border">
                                        {variable}
                                      </div>
                                      <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                        Key
                                      </Label>
                                    </div>

                                    <div className="flex-1 flex gap-2">
                                      <div className="flex-1 relative">
                                        <Input
                                          value={campaignData.variableMapping[variable] || ""}
                                          onChange={(e) => handleVariableChange(variable, e.target.value)}
                                          placeholder="Static value or {{field}}..."
                                          className="bg-background border-border h-11 rounded-xl placeholder:text-muted-foreground/30 font-mono text-xs focus:ring-primary/10 transition-all pl-4"
                                        />
                                      </div>
                                      
                                      <Select
                                        value=""
                                        onValueChange={(val) => {
                                          const currentVal = campaignData.variableMapping[variable] || "";
                                          const newVal = currentVal + (currentVal && !currentVal.endsWith(" ") ? " " : "") + `{{${val}}}`;
                                          handleVariableChange(variable, newVal);
                                        }}
                                      >
                                        <SelectTrigger className="w-11 h-11 bg-primary text-white border-none rounded-xl shrink-0 p-0 flex justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/10">
                                          <Sparkles className="h-4 w-4" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border shadow-premium-sm p-1 min-w-[180px]">
                                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest px-2 py-1.5 opacity-50">System Fields</p>
                                          {contactFields.map((field) => (
                                            <SelectItem
                                              key={field.value}
                                              value={field.value}
                                              className="focus:bg-primary/10 transition-colors rounded-lg mx-1 font-bold text-[11px] py-2"
                                            >
                                              {field.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
