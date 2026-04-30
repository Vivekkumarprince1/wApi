/**
 * PLAN SEEDING API
 * 
 * Initializes the database with default subscription tiers.
 * Safe to call multiple times as it only upserts missing plans.
 */

import { NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Plan } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

const DEFAULT_PLANS = [
  {
    name: "Free Tier",
    slug: "free",
    monthlyBaseFeeCents: 0,
    yearlyBaseFeeCents: 0,
    currency: "INR",
    limits: {
      maxContacts: 1000,
      maxMessagesPerMonth: 5000,
      maxAutomations: 2,
      maxTemplates: 10,
      aiResolutionLimit: 0
    },
    features: ["CRM", "TEAM"],
    conversationPricing: {
      marketingMarkupPercent: 10,
      utilityMarkupPercent: 10,
      authenticationMarkupPercent: 10,
      serviceMarkupPercent: 10
    },
    isActive: true,
    isDefault: true
  },
  {
    name: "Growth",
    slug: "growth",
    monthlyBaseFeeCents: 499900, // 4,999 INR
    yearlyBaseFeeCents: 4999000, // 49,990 INR (approx 10 months)
    currency: "INR",
    limits: {
      maxContacts: 10000,
      maxMessagesPerMonth: 50000,
      maxAutomations: 20,
      maxTemplates: 100,
      aiResolutionLimit: 1000
    },
    features: ["INBOX", "CRM", "TEAM", "ANALYTICS", "CAMPAIGNS", "TEMPLATES", "AUTOMATION"],
    conversationPricing: {
      marketingMarkupPercent: 5,
      utilityMarkupPercent: 5,
      authenticationMarkupPercent: 5,
      serviceMarkupPercent: 5
    },
    isActive: true
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    monthlyBaseFeeCents: 1499900, // 14,999 INR
    yearlyBaseFeeCents: 14999000, // 1,49,990 INR
    currency: "INR",
    limits: {
      maxContacts: 100000,
      maxMessagesPerMonth: 1000000,
      maxAutomations: -1, // Unlimited
      maxTemplates: -1,
      aiResolutionLimit: 10000
    },
    features: ["INBOX", "CRM", "TEAM", "ANALYTICS", "CAMPAIGNS", "TEMPLATES", "AUTOMATION", "WHATSAPP_FORMS", "COMMERCE"],
    conversationPricing: {
      marketingMarkupPercent: 2,
      utilityMarkupPercent: 2,
      authenticationMarkupPercent: 2,
      serviceMarkupPercent: 2
    },
    isActive: true
  }
];

export const POST = withRole(['super_admin'], async (req) => {
  try {
    await dbConnect();
    
    const results = [];
    for (const planData of DEFAULT_PLANS) {
      const plan = await Plan.findOneAndUpdate(
        { slug: planData.slug },
        { $set: planData },
        { upsert: true, returnDocument: 'after' }
      );
      results.push(plan);
    }

    return NextResponse.json({ message: "Default plans initialized", plans: results });
  } catch (err: any) {
    console.error("[Plan Seeding Error]:", err.message);
    return NextResponse.json({ message: "Failed to seed plans", error: err.message }, { status: 500 });
  }
}) as any;
