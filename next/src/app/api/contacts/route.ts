/**
 * API: /api/contacts
 * Port of legacy contactController.listContacts & createContact
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { withPlanGate } from "@/lib/middlewares/plan-gate";
import { UsageTracker } from "@/lib/services/billing/usage-tracker";
import { normalizePhoneNumber } from "@/lib/phone-utils";

/**
 * GET: List contacts with search and pagination
 */
export const GET = withFeature('CONTACTS', withAuth(async (req: NextRequest, { user, workspace, permissions }) => {
  try {
    // 1. Permission Check
    const isElevated = ['owner', 'admin', 'manager'].includes(user.role);
    if (!isElevated && permissions && !permissions.viewContacts) {
      return NextResponse.json({ message: "Access denied: You do not have permission to view contacts" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    // ... rest of GET ...
    const limit = parseInt(searchParams.get("limit") || "20");
    const searchQuery = searchParams.get("search");
    const tags = searchParams.get("tags")?.split(",") || [];

    await dbConnect();

    // Build query
    const query: any = { workspace: workspace._id };
    
    if (searchQuery) {
      const normalizedSearch = normalizePhoneNumber(searchQuery);
      query.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { phone: { $regex: searchQuery, $options: "i" } }
      ];
      
      // If normalization changed the query, add it to search options too
      if (normalizedSearch !== searchQuery && normalizedSearch.length > 5) {
        query.$or.push({ phone: { $regex: normalizedSearch, $options: "i" } });
      }
    }
    
    if (tags.length > 0 && tags[0] !== "") {
      query.tags = { $all: tags };
    }

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit),
      Contact.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      data: contacts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error("[Contacts List API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}));

/**
 * POST: Create a new contact manually
 */
export const POST = withFeature('CONTACTS', withPlanGate('contacts')(async (req: NextRequest, { user, workspace, permissions }: { user: any, workspace: any, permissions: any }) => {
  try {
    // 1. Permission Check
    const isElevated = ['owner', 'admin', 'manager'].includes(user.role);
    if (!isElevated && permissions && !permissions.manageContacts) {
      return NextResponse.json({ message: "Access denied: You do not have permission to create contacts" }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, email, metadata, tags } = body;

    if (!phone) {
      return NextResponse.json({ message: "Phone number is required" }, { status: 400 });
    }

    await dbConnect();

    const normalizedPhone = normalizePhoneNumber(phone);

    // Check for duplicate in workspace using normalized phone
    const existing = await Contact.findOne({ workspace: workspace._id, phone: normalizedPhone });
    if (existing) {
      return NextResponse.json({ message: "Contact already exists", data: existing }, { status: 409 });
    }

    const contact = await Contact.create({
      workspace: workspace._id,
      name: name || "Unknown",
      phone: normalizedPhone,
      metadata: { ...metadata, email: email || metadata?.email },
      tags: tags || [],
      leadStatus: 'new'
    });

    // Increment usage counter
    await UsageTracker.increment(workspace._id, 'contacts');

    return NextResponse.json({
      success: true,
      data: contact
    });
  } catch (err: any) {
    console.error("[Contact Create API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}));

