"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Table, ExternalLink, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { 
  getGoogleSheetsStatus, 
  getGoogleSheetsSpreadsheets, 
  getGoogleSheetsSheets, 
  getGoogleSheetsAuthUrl, 
  saveGoogleSheetsConfig 
} from '@/lib/api/integrations';

interface GoogleSheetsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GoogleSheetsConfigModal({ isOpen, onClose, onSuccess }: GoogleSheetsConfigModalProps) {
  const [step, setStep] = useState<'auth' | 'config'>('auth');
  const [loading, setLoading] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [syncExisting, setSyncExisting] = useState(false);

  async function fetchSpreadsheets() {
    setLoading(true);
    try {
      const resp = await getGoogleSheetsSpreadsheets();
      setSpreadsheets(resp.files || []);
    } catch (err) {
      toast.error("Failed to fetch spreadsheets");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSheets(spreadsheetId: string) {
    setLoading(true);
    try {
      const resp = await getGoogleSheetsSheets(spreadsheetId);
      setSheets(resp.sheets || []);
    } catch (err) {
      toast.error("Failed to fetch sheets");
    } finally {
      setLoading(false);
    }
  }

  async function checkAuthStatus() {
    try {
      const resp = await getGoogleSheetsStatus();
      if (resp.connected) {
        setStep('config');
        fetchSpreadsheets();
        
        // If we have existing metadata, pre-populate
        if (resp.integration?.configMetadata) {
          const { spreadsheetId, sheetName } = resp.integration.configMetadata;
          if (spreadsheetId) {
            setSelectedSpreadsheet(spreadsheetId);
            fetchSheets(spreadsheetId);
          }
          if (sheetName) {
            setSelectedSheet(sheetName);
          }
        }
      } else {
        setStep('auth');
      }
    } catch (err) {
      setStep('auth');
    }
  }

  // 1. Check if already authenticated when modal opens
  useEffect(() => {
    if (isOpen) {
      checkAuthStatus();
    }
  }, [isOpen]);

  const handleAuthorize = async () => {
    setLoading(true);
    try {
      const resp = await getGoogleSheetsAuthUrl();
      // Redirect to Google OAuth URL
      window.location.href = resp.url;
    } catch (err) {
      toast.error("Failed to bridge with Google");
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedSpreadsheet || !selectedSheet) {
      toast.error("Please select both a spreadsheet and a sheet");
      return;
    }

    setLoading(true);
    try {
      await saveGoogleSheetsConfig({
        spreadsheetId: selectedSpreadsheet,
        sheetName: selectedSheet,
        syncExisting
      });
      toast.success("Google Sheets configured!");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to save configuration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] border-none bg-background/80 backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 mb-4">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">
            {step === 'auth' ? 'Authorize Google Sheets' : 'Configure Sheet Sync'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            {step === 'auth' 
              ? 'Connect your Google account to access your spreadsheets.' 
              : 'Select the spreadsheet and sheet tab you want to sync with WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === 'auth' ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="relative">
                 <div className="h-20 w-20 rounded-full bg-accent/20 flex items-center justify-center">
                    <Table className="h-10 w-10 text-muted-foreground" />
                 </div>
                 <div className="absolute -bottom-1 -right-1 h-8 w-8 bg-green-500 text-white rounded-full flex items-center justify-center border-4 border-background">
                    <Loader2 className="h-4 w-4 animate-spin" />
                 </div>
              </div>
              <p className="text-center text-xs text-muted-foreground max-w-[280px]">
                We need permission to read your spreadsheets. This is handled securely via Google OAuth.
              </p>
              <Button 
                onClick={handleAuthorize} 
                disabled={loading}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 w-full rounded-xl flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4" /> Sign in with Google</>}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Spreadsheet</Label>
                <Select disabled={loading} value={selectedSpreadsheet} onValueChange={(val) => {
                  setSelectedSpreadsheet(val);
                  setSelectedSheet('');
                  fetchSheets(val);
                }}>
                  <SelectTrigger className="h-12 bg-accent/20 border-border/50">
                    <SelectValue placeholder="Select a file from your Drive" />
                  </SelectTrigger>
                  <SelectContent>
                    {spreadsheets.map(fb => (
                      <SelectItem key={fb.id} value={fb.id}>{fb.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Tab (Sheet)</Label>
                <Select disabled={loading || !selectedSpreadsheet} value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger className="h-12 bg-accent/20 border-border/50">
                    <SelectValue placeholder="Select a worksheet" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10 flex items-start gap-3">
                 <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                 <p className="text-[11px] font-medium text-green-700 leading-relaxed">
                   Syncing starts automatically every 15 minutes. Ensure the first row of your sheet contains headers like 'Name', 'Phone', and 'Email'.
                 </p>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-border/50 bg-accent/10 p-4 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={syncExisting}
                  onChange={(event) => setSyncExisting(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Sync existing rows on first run
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="font-bold text-xs uppercase tracking-widest">Cancel</Button>
          {step === 'config' && (
            <Button 
              onClick={handleSaveConfig} 
              disabled={loading || !selectedSheet}
              className="bg-green-600 hover:bg-green-700 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-green-600/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Syncing"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
