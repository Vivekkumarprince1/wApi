"use client";

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createDeveloperKey, deleteDeveloperKey, getDeveloperKeySecret, getDeveloperKeys } from '@/lib/api/settings';

interface DeveloperApiKey {
  id: string;
  name: string;
  key: string | null;
  isActive: boolean;
  createdAt?: string;
  lastUsedAt?: string;
}

interface CreatedKey {
  id: string;
  name: string;
  key: string;
}

function formatDate(value?: string) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeKeys(payload: any): DeveloperApiKey[] {
  const keys = Array.isArray(payload) ? payload : payload?.data;
  return Array.isArray(keys)
    ? keys.map((key) => ({
        id: String(key.id || key._id || ''),
        name: key.name || 'Untitled key',
        key: key.key || null,
        isActive: key.isActive !== false,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
      })).filter((key) => key.id)
    : [];
}

export default function DeveloperKeysPage() {
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [newKeyName, setNewKeyName] = useState('Server integration key');
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const activeKeys = useMemo(() => keys.filter((key) => key.isActive).length, [keys]);

  const loadKeys = async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setLoadError('');
    try {
      const payload = await getDeveloperKeys();
      setKeys(normalizeKeys(payload));
      setVisibleKeyIds({});
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to load API keys';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadKeys('initial');
  }, []);

  const copyToClipboard = async (value: string, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error('Clipboard is not available');
    }
  };

  const handleCreateKey = async (event: FormEvent) => {
    event.preventDefault();
    const name = newKeyName.trim();
    if (!name) {
      toast.error('API key name is required');
      return;
    }

    setCreating(true);
    try {
      const created: any = await createDeveloperKey(name);
      if (!created?.key) {
        throw new Error('API key was created without a secret in the response');
      }

      const nextCreatedKey = {
        id: String(created.id || created.key),
        name: created.name || name,
        key: created.key,
      };

      setCreatedKey(nextCreatedKey);
      setRevealedSecrets((current) => ({ ...current, [nextCreatedKey.id]: nextCreatedKey.key }));
      setVisibleKeyIds((current) => ({ ...current, [nextCreatedKey.id]: true }));
      setCreateOpen(false);
      setNewKeyName('Server integration key');
      await loadKeys();
      await copyToClipboard(created.key, 'API key created and copied');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDeveloperKey(id);
      setKeys((current) => current.filter((key) => key.id !== id));
      if (createdKey?.id === id) setCreatedKey(null);
      setRevealedSecrets((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setVisibleKeyIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setConfirmDeleteId(null);
      toast.success('API key deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete API key');
    } finally {
      setDeletingId(null);
    }
  };

  const fetchSecret = async (id: string) => {
    if (revealedSecrets[id]) return revealedSecrets[id];

    setRevealingId(id);
    try {
      const secret: any = await getDeveloperKeySecret(id);
      if (!secret?.key) throw new Error('Secret was not returned');
      setRevealedSecrets((current) => ({ ...current, [id]: secret.key }));
      return secret.key as string;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to reveal API key');
      return null;
    } finally {
      setRevealingId(null);
    }
  };

  const handleToggleSecret = async (id: string) => {
    if (visibleKeyIds[id]) {
      setVisibleKeyIds((current) => ({ ...current, [id]: false }));
      return;
    }

    const secret = await fetchSecret(id);
    if (secret) {
      setVisibleKeyIds((current) => ({ ...current, [id]: true }));
    }
  };

  const handleCopySecret = async (id: string) => {
    const secret = await fetchSecret(id);
    if (secret) await copyToClipboard(secret, 'API key secret copied');
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2">
            <Link href="/settings/developer">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Developer hub
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Create and revoke credentials used by external websites, apps, and bots.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => loadKeys()} disabled={refreshing || loading}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create API key
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Total keys</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? '-' : keys.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Active</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? '-' : activeKeys}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Auth header</p>
          <p className="mt-2 font-mono text-sm">x-api-key</p>
        </div>
      </div>

      <div className="rounded-lg border bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Store API keys on your server only.</p>
            <p className="text-sm text-amber-900/75 dark:text-amber-100/70">
              Keys stay masked by default. Use the eye action only when you need to reveal a secret, and never paste it into browser-side code.
            </p>
          </div>
        </div>
      </div>

      {createdKey ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 p-4 dark:bg-emerald-950/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100">New API key created</p>
              </div>
              <p className="text-sm text-emerald-900/70 dark:text-emerald-100/70">
                Copy it into your server environment. You can reveal it later from this page if needed.
              </p>
              <code className="block truncate rounded-md bg-background px-3 py-2 font-mono text-xs text-foreground">
                {createdKey.key}
              </code>
            </div>
            <Button variant="outline" onClick={() => copyToClipboard(createdKey.key)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy secret
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden rounded-lg border shadow-none">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-base font-medium">Credentials</h2>
            <p className="text-sm text-muted-foreground">Keys authenticate external API calls to your workspace.</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-14 w-full" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-6">
            <div className="max-w-md space-y-3">
              <h3 className="text-sm font-medium">Could not load API keys</h3>
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => loadKeys()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <KeyRound className="mx-auto h-9 w-9 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-medium">No API keys yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a key to connect an external website, app, or bot to your WhatsApp template APIs.
              </p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create API key
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%] px-4">Name</TableHead>
                    <TableHead>Secret</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="w-[150px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => {
                    const isDeleting = deletingId === key.id;
                    const isConfirming = confirmDeleteId === key.id;
                    const isRevealing = revealingId === key.id;
                    const isVisible = Boolean(visibleKeyIds[key.id]);
                    const secretValue = revealedSecrets[key.id];

                    return (
                      <TableRow key={key.id}>
                        <TableCell className="px-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                              <KeyRound className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{key.name}</p>
                              <Badge variant="outline" className="mt-1 rounded-md text-[10px]">
                                {key.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="inline-block max-w-[320px] truncate rounded-md bg-muted px-2 py-1 font-mono text-xs align-middle">
                            {isVisible && secretValue ? secretValue : key.key || 'Masked'}
                          </code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(key.createdAt)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(key.lastUsedAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleToggleSecret(key.id)}
                              disabled={isRevealing}
                              aria-label={isVisible ? 'Hide API key secret' : 'Reveal API key secret'}
                            >
                              {isRevealing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isVisible ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleCopySecret(key.id)}
                              disabled={isRevealing}
                              aria-label="Copy API key secret"
                            >
                              {isRevealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                            </Button>
                            {isConfirming ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteKey(key.id)}
                                disabled={isDeleting}
                              >
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Confirm
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setConfirmDeleteId(key.id)}
                                aria-label="Delete API key"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y md:hidden">
              {keys.map((key) => {
                const isDeleting = deletingId === key.id;
                const isConfirming = confirmDeleteId === key.id;
                const isRevealing = revealingId === key.id;
                const isVisible = Boolean(visibleKeyIds[key.id]);
                const secretValue = revealedSecrets[key.id];

                return (
                  <div key={key.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{key.name}</p>
                        <code className="mt-1 block truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">
                          {isVisible && secretValue ? secretValue : key.key || 'Masked'}
                        </code>
                      </div>
                      <Badge variant="outline" className="shrink-0 rounded-md">
                        {key.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground">
                      <span>Created: {formatDate(key.createdAt)}</span>
                      <span>Last used: {formatDate(key.lastUsedAt)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleToggleSecret(key.id)}
                        disabled={isRevealing}
                      >
                        {isRevealing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isVisible ? (
                          <EyeOff className="mr-2 h-4 w-4" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        {isVisible ? 'Hide secret' : 'Show secret'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleCopySecret(key.id)}
                        disabled={isRevealing}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy secret
                      </Button>
                      {isConfirming ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDeleteKey(key.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Confirm delete
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteId(key.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-base font-medium">Server-side example</h2>
            <p className="text-sm text-muted-foreground">Use this header when calling external OTP or template APIs.</p>
          </div>
          <pre className="overflow-x-auto p-4 text-sm">
{`curl -X POST http://localhost:5001/api/v1/external/otp/send \\
  -H "x-api-key: YOUR_WAPI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+919876543210",
    "templateName": "your_meta_approved_template",
    "languageCode": "en_US",
    "purpose": "login",
    "bodyVariables": ["{{otp}}"]
  }'`}
          </pre>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-medium">Operational note</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rotate keys regularly and delete unused credentials from this page.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/settings/developer/webhooks">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage webhooks
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateKey} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Name this key by where it will be used, such as website OTP backend or checkout bot.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="api-key-name">Key name</Label>
              <Input
                id="api-key-name"
                value={newKeyName}
                onChange={(event) => setNewKeyName(event.target.value)}
                placeholder="Website OTP backend"
                autoFocus
                maxLength={80}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newKeyName.trim()}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
