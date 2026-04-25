"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, ExternalLink, Plus, Shield, ToggleLeft, ToggleRight, Webhook } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EVENTS = [
  { name: "message.received", description: "Incoming conversation payloads", enabled: true },
  { name: "message.delivered", description: "Delivery callbacks from Meta", enabled: true },
  { name: "template.status", description: "Template approval and delivery updates", enabled: false },
  { name: "billing.updated", description: "Subscription and wallet updates", enabled: true },
];

export default function EventsSettingsPage() {
  const router = useRouter();
  const [items] = useState(EVENTS);

  useEffect(() => {
    router.replace("/dashboard/settings/developer/webhooks");
  }, [router]);

  return null;
}