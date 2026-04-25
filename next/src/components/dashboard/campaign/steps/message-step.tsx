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
import axios from "axios";

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
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "campaign_media");

    try {
      const res = await fetch("/api/upload/media", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
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
    } catch (err) {
      toast.error("Network error uploading media");
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
      const resp = await axios.get(`/api/integrations/google/spreadsheets/${campaignData.googleSheetsConfig.spreadsheetId}/columns?sheetName=${encodeURIComponent(campaignData.googleSheetsConfig.sheetName)}`);
      return resp.data.columns || [];
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
                      p-4 rounded-xl border-2 transition-all cursor-pointer group relative overflow-hidden
                      ${
                        campaignData.templateId === template._id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-premium-sm"
                          : "border-transparent bg-background hover:bg-muted/30"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-bold ${campaignData.templateId === template._id ? "text-primary" : "text-foreground"}`}
                      >
                        {template.name}
                      </span>
                      {campaignData.templateId === template._id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[8px] font-black h-4 uppercase tracking-tighter opacity-70"
                      >
                        {template.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium italic truncate">
                        {template.bodyText || template.body?.text}
                      </span>
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 h-1 my-1 mx-1 w-8 bg-primary rounded-full transition-all duration-500 scale-x-0 group-hover:scale-x-100 ${campaignData.templateId === template._id ? "scale-x-100" : ""}`}
                    />
                    {campaignData.templateId === template._id && (
                      <div
                        className="mt-4 pt-4 border-t border-border/50 space-y-4 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="bg-slate-950 dark:bg-slate-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-white/5">
                          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                            <MessageSquare className="h-20 w-20 text-white" />
                          </div>
                          <div className="space-y-4 relative z-10">
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                                Message Content
                              </p>
                              <div className="text-slate-100 text-sm leading-relaxed font-medium whitespace-pre-wrap selection:bg-primary/30">
                                {template.bodyText || template.body?.text}
                              </div>
                            </div>

                            {(template?.header?.format === "IMAGE" ||
                              template?.header?.format === "VIDEO" ||
                              template?.header?.format === "DOCUMENT") && (
                              <div className="pt-6 space-y-4 border-t border-white/10 mt-6 text-amber-400">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest">
                                    Media Header Upload
                                  </span>
                                </div>
                                <div className="p-4 rounded-xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-3">
                                  <input
                                    type="file"
                                    className="text-xs text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                    onChange={handleMediaUpload}
                                    accept={
                                      template.header.format === "IMAGE"
                                        ? "image/*"
                                        : template.header.format === "VIDEO"
                                          ? "video/*"
                                          : "*/*"
                                    }
                                  />
                                  {uploadingMedia && (
                                    <p className="text-xs text-primary animate-pulse">
                                      Uploading to cloud...
                                    </p>
                                  )}
                                  {campaignData.variableMapping?.mediaUrl &&
                                    !uploadingMedia && (
                                      <div className="text-xs text-green-400 max-w-full truncate px-4">
                                        ✓ Uploaded:{" "}
                                        {campaignData.variableMapping.mediaUrl}
                                      </div>
                                    )}
                                </div>
                              </div>
                            )}

                            {templateVariables.length > 0 && (
                              <div className="pt-6 space-y-4 border-t border-white/10 mt-6">
                                <div className="flex items-center gap-2 text-amber-400">
                                  <Sparkles className="h-4 w-4" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">
                                    Connect Variables
                                  </span>
                                </div>

                                <div className="space-y-4">
                                  {templateVariables.map((variable) => (
                                    <div
                                      key={variable}
                                      className="flex items-center gap-4 group"
                                    >
                                      <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-primary/80 min-w-[80px] text-center">
                                        {`{{${variable}}}`}
                                      </div>
                                      <ArrowRight className="h-3 w-3 text-white/20 group-hover:text-primary transition-colors" />
                                      <div className="flex-1 flex gap-2">
                                        <Input
                                          value={
                                            campaignData.variableMapping[
                                              variable
                                            ] || ""
                                          }
                                          onChange={(e) =>
                                            handleVariableChange(
                                              variable,
                                              e.target.value,
                                            )
                                          }
                                          placeholder="Static text or {{firstName}}"
                                          className="bg-white/5 border-white/10 text-white h-9 rounded-xl placeholder:text-white/30"
                                        />
                                        <Select
                                          value=""
                                          onValueChange={(val) => {
                                            const currentVal =
                                              campaignData.variableMapping[
                                                variable
                                              ] || "";
                                            const newVal =
                                              currentVal +
                                              (currentVal &&
                                              !currentVal.endsWith(" ")
                                                ? " "
                                                : "") +
                                              `{{${val}}}`;
                                            handleVariableChange(
                                              variable,
                                              newVal,
                                            );
                                          }}
                                        >
                                          <SelectTrigger className="w-[120px] bg-white/5 border-white/10 text-white h-9 rounded-xl shrink-0">
                                            <span className="text-xs font-bold text-primary">
                                              Insert Field
                                            </span>
                                          </SelectTrigger>
                                          <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl shadow-2xl">
                                            {contactFields.map((field) => (
                                              <SelectItem
                                                key={field.value}
                                                value={field.value}
                                                className="focus:bg-primary/10 transition-colors"
                                              >
                                                {field.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
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
