"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Megaphone, Package, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getMetaAdsAuthUrl,
  getMetaAdsStatus,
  refreshMetaAdsAssets,
  saveMetaAdsConfig,
  type MetaAdsIntegrationStatus,
} from "@/lib/api/integrations";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const getAssets = (status: MetaAdsIntegrationStatus | null) =>
  status?.integration?.configMetadata?.assets || {};

function normalizeAccountId(account: any) {
  if (!account) return "";
  return String(account.id || account.account_id || "").startsWith("act_")
    ? String(account.id || account.account_id)
    : `act_${account.account_id || account.id}`;
}

export function MetaAdsConnectModal({ isOpen, onClose, onSuccess }: Props) {
  const [status, setStatus] = useState<MetaAdsIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedInstagramActor, setSelectedInstagramActor] = useState("");
  const [selectedPhoneId, setSelectedPhoneId] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedProductSetId, setSelectedProductSetId] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  const assets = useMemo(() => getAssets(status), [status]);
  const adAccounts = useMemo(() => Array.isArray(assets.adAccounts) ? assets.adAccounts : [], [assets.adAccounts]);
  const pages = useMemo(() => Array.isArray(assets.pages) ? assets.pages : [], [assets.pages]);
  const phoneNumbers = useMemo(() => Array.isArray(assets.whatsappPhoneNumbers) ? assets.whatsappPhoneNumbers : [], [assets.whatsappPhoneNumbers]);
  const productCatalogs = useMemo(() => Array.isArray(assets.productCatalogs) ? assets.productCatalogs : [], [assets.productCatalogs]);
  const productSets = useMemo(() => Array.isArray(assets.productSets) ? assets.productSets : [], [assets.productSets]);
  const selectedAccount = adAccounts.find((account: any) => normalizeAccountId(account) === selectedAdAccount);
  const selectedPageRecord = pages.find((page: any) => page.id === selectedPage);
  const pageInstagramActor = selectedPageRecord?.instagram_business_account?.id || "";
  const selectedPhone = phoneNumbers.find((phone: any) => phone.id === selectedPhoneId);
  const catalogProductSets = selectedCatalogId
    ? productSets.filter((productSet: any) => productSet.productCatalogId === selectedCatalogId)
    : productSets;

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await getMetaAdsStatus();
      setStatus(data);
      const selected = data.integration?.configMetadata?.selected || {};
      if (selected.adAccountId) setSelectedAdAccount(selected.adAccountId);
      if (selected.pageId) setSelectedPage(selected.pageId);
      if (selected.instagramActorId) setSelectedInstagramActor(selected.instagramActorId);
      if (selected.whatsappPhoneNumberId) setSelectedPhoneId(selected.whatsappPhoneNumberId);
      if (selected.whatsappPhoneNumber) setManualPhone(selected.whatsappPhoneNumber);
      if (selected.productCatalogId) setSelectedCatalogId(selected.productCatalogId);
      if (selected.productSetId) setSelectedProductSetId(selected.productSetId);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadStatus();
  }, [isOpen]);

  useEffect(() => {
    if (pageInstagramActor && !selectedInstagramActor) {
      setSelectedInstagramActor(pageInstagramActor);
    }
  }, [pageInstagramActor, selectedInstagramActor]);

  useEffect(() => {
    if (!selectedProductSetId) return;
    const selectedSet = productSets.find((productSet: any) => productSet.id === selectedProductSetId);
    if (selectedCatalogId && selectedSet?.productCatalogId !== selectedCatalogId) {
      setSelectedProductSetId("");
    }
  }, [productSets, selectedCatalogId, selectedProductSetId]);

  const connectMeta = async (force = false) => {
    const toastId = toast.loading("Opening Meta authorization...");
    try {
      const response = await getMetaAdsAuthUrl(force);
      toast.success("Redirecting to Meta", { id: toastId });
      window.location.href = response.url;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Meta authorization failed", { id: toastId });
    }
  };

  const refreshAssets = async () => {
    setRefreshing(true);
    const toastId = toast.loading("Refreshing Meta assets...");
    try {
      await refreshMetaAdsAssets();
      await loadStatus();
      toast.success("Meta assets refreshed", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Could not refresh Meta assets", { id: toastId });
    } finally {
      setRefreshing(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    const toastId = toast.loading("Saving Meta Ads configuration...");
    try {
      await saveMetaAdsConfig({
        adAccountId: selectedAdAccount,
        pageId: selectedPage,
        instagramActorId: selectedInstagramActor || undefined,
        whatsappPhoneNumberId: selectedPhoneId || undefined,
        whatsappPhoneNumber: manualPhone || selectedPhone?.display_phone_number || undefined,
        productCatalogId: selectedCatalogId || undefined,
        productSetId: selectedProductSetId || undefined,
        currency: selectedAccount?.currency,
      });
      await loadStatus();
      toast.success("Meta Ads is ready for WhatsApp campaigns", { id: toastId });
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Could not save Meta Ads configuration", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(selectedAdAccount && selectedPage && (selectedPhoneId || manualPhone));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Meta Ads</DialogTitle>
              <DialogDescription>Connect an ad account, Page, and WhatsApp number for Click-to-WhatsApp campaigns.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="grid gap-3 py-6">
            <div className="h-20 rounded-lg border bg-muted/40" />
            <div className="h-48 rounded-lg border bg-muted/40" />
          </div>
        ) : !status?.connected ? (
          <div className="grid gap-5 py-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Meta authorization required</p>
                  <p className="text-sm text-muted-foreground">
                    Customers authorize their own Meta assets. Tokens are stored encrypted and only the campaign service can read them internally.
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={() => connectMeta(false)} className="w-fit">
              <ExternalLink className="mr-2 h-4 w-4" />
              Connect Meta Ads
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={status.configured ? "default" : "secondary"}>
                    {status.configured ? "Configured" : "Connected"}
                  </Badge>
                  <span className="truncate text-sm font-medium">
                    {status.integration?.configMetadata?.metaUser?.name || "Meta account connected"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {adAccounts.length} ad accounts, {pages.length} pages, {phoneNumbers.length} WhatsApp numbers, {productCatalogs.length} catalogs found
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={refreshAssets} disabled={refreshing}>
                  {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  Refresh
                </Button>
                <Button variant="ghost" size="sm" onClick={() => connectMeta(true)}>
                  Reconnect
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Ad account</Label>
                <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose ad account" />
                  </SelectTrigger>
                  <SelectContent>
                    {adAccounts.map((account: any) => (
                      <SelectItem key={normalizeAccountId(account)} value={normalizeAccountId(account)}>
                        {account.name || account.account_id} {account.currency ? `(${account.currency})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Facebook Page</Label>
                <Select value={selectedPage} onValueChange={setSelectedPage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose Page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page: any) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Instagram actor</Label>
                <Input
                  value={selectedInstagramActor}
                  onChange={(event) => setSelectedInstagramActor(event.target.value)}
                  placeholder={pageInstagramActor || "Optional Instagram business ID"}
                />
              </div>

              <div className="grid gap-2">
                <Label>WhatsApp number</Label>
                <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose discovered number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((phone: any) => (
                      <SelectItem key={phone.id} value={phone.id}>
                        {phone.display_phone_number || phone.verified_name || phone.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Manual WhatsApp number</Label>
              <Input
                value={manualPhone}
                onChange={(event) => setManualPhone(event.target.value)}
                placeholder="Country code + phone number, digits only"
              />
              <p className="text-xs text-muted-foreground">
                Use this when Meta does not return a phone number from the customer business account.
              </p>
            </div>

            <div className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <Package className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Commerce catalog</p>
                  <p className="text-xs text-muted-foreground">
                    Optional catalog context for commerce campaigns and product-set reporting.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Product catalog</Label>
                  <Select
                    value={selectedCatalogId || "none"}
                    onValueChange={(value) => {
                      setSelectedCatalogId(value === "none" ? "" : value);
                      if (value === "none") setSelectedProductSetId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose catalog" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No catalog</SelectItem>
                      {productCatalogs.map((catalog: any) => (
                        <SelectItem key={catalog.id} value={catalog.id}>
                          {catalog.name || catalog.id} {catalog.product_count !== undefined ? `(${catalog.product_count} products)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Product set</Label>
                  <Select
                    value={selectedProductSetId || "none"}
                    onValueChange={(value) => setSelectedProductSetId(value === "none" ? "" : value)}
                    disabled={!selectedCatalogId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose product set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All products</SelectItem>
                      {catalogProductSets.map((productSet: any) => (
                        <SelectItem key={productSet.id} value={productSet.id}>
                          {productSet.name || productSet.id} {productSet.product_count !== undefined ? `(${productSet.product_count})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={saveConfig} disabled={!canSave || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save configuration
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
