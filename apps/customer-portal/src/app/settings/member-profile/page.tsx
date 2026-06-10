"use client";

import React, { useEffect, useState } from "react";
import { BadgeCheck, Mail, Save, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import FlashLoader from "@/components/ui/flash-loader";
import { getCurrentUser, updateCurrentUserProfile } from "@/lib/api/auth";

export default function MemberProfileSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["member-profile"],
    queryFn: () => getCurrentUser(),
  });

  const [profile, setProfile] = useState({ name: "", email: "", phone: "", timezone: "Asia/Kolkata" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.user) {
      setProfile({
        name: data.user.name || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
        timezone: data.user.timezone || "Asia/Kolkata",
      });
    }
  }, [data]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const result = await updateCurrentUserProfile({
        name: profile.name,
        phone: profile.phone,
        timezone: profile.timezone,
      });

      if (result?.user) {
        setProfile((current) => ({
          ...current,
          name: result.user.name || current.name,
          phone: result.user.phone || current.phone,
          timezone: result.user.timezone || current.timezone,
        }));
      }

      setSaveMessage("Profile updated successfully.");
    } catch (error) {
      setSaveMessage("Unable to save profile right now.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <FlashLoader />;

  return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Member Profile</h1>
            <p className="text-sm font-medium text-muted-foreground">Review your personal workspace profile and session details.</p>
          </div>
          <Badge className="w-fit rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-sky-500/10 text-sky-600 border-none">Editable profile</Badge>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-6">
            <Card className="border-none ring-1 ring-border/50 bg-background/60 shadow-xl rounded-[2rem]">
              <CardContent className="p-8 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">{profile.name?.charAt(0)?.toUpperCase() || "U"}</div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black">{profile.name || "Workspace member"}</h2>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {profile.email || "No email loaded"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Full Name</label>
                    <Input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="h-12 rounded-2xl bg-accent/20 border-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Email</label>
                    <Input value={profile.email} disabled className="h-12 rounded-2xl bg-accent/10 border-none text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Phone</label>
                    <Input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="+91 98xxxxxx" className="h-12 rounded-2xl bg-accent/20 border-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Timezone</label>
                    <Input value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} className="h-12 rounded-2xl bg-accent/20 border-none" />
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20 disabled:opacity-70"
                >
                  <Save className="h-4 w-4 mr-2" /> {isSaving ? "Saving..." : "Save changes"}
                </Button>
                {saveMessage ? <p className="text-xs font-medium text-muted-foreground">{saveMessage}</p> : null}
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-4 space-y-6">
            <Card className="border-none ring-1 ring-border/50 bg-background/60 shadow-sm rounded-[2rem]">
              <CardContent className="p-8 space-y-6">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <BadgeCheck className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black">Session details</h3>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">This page reads from the authenticated session and workspace metadata, then saves personal updates through the auth profile endpoint.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 bg-slate-950 text-white shadow-2xl rounded-[2rem] overflow-hidden">
              <CardContent className="p-8 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-sky-400">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-black">Security note</h3>
                <p className="text-sm text-white/60 font-medium leading-relaxed">Identity updates now persist through the auth profile endpoint so this page stays aligned with the session record.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
}