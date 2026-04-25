/**
 * API: /api/campaigns
 * Handles creating a new broadcast campaign.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Campaign, Template, Segment } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { Types } from "mongoose";

export const POST = withFeature('CAMPAIGNS', async (req: NextRequest, { user, workspace }) => {
  try {
    const body = await req.json();
    const { name, template, templateId: _tid, segmentId: _sid, contacts: _contacts, recipientFilter, variableMapping, campaignType = 'one-time' } = body;
    const templateId = _tid || template;
    const segmentId = _sid || body.segmentId;


    await dbConnect();

    // 1. Validate Template
    const templateDoc = await Template.findById(templateId);
    if (!templateDoc) return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 });
    if (templateDoc.status !== 'APPROVED') {
      return NextResponse.json({ success: false, message: `Template must be APPROVED. Current status: ${templateDoc.status}` }, { status: 400 });
    }

    // 2. Resolve Recipients
    let contactIds: Types.ObjectId[] = [];
    let totalContacts = 0;

    if (segmentId) {
        const { SegmentService } = await import("@/lib/services/marketing/segment-service");
        contactIds = await SegmentService.resolveSegmentContacts(workspace._id.toString(), segmentId);
        totalContacts = contactIds.length;
    } else if (_contacts && Array.isArray(_contacts) && _contacts.length > 0) {
        contactIds = _contacts.map((id: string) => new Types.ObjectId(id));
        totalContacts = contactIds.length;
    } else if (recipientFilter?.type === 'all' || body.audienceMode === 'all') {
        const { Contact } = await import("@/lib/models/messaging/Contact");
        contactIds = (await Contact.find({ workspace: workspace._id }).distinct('_id')).map(id => new Types.ObjectId(id.toString()));
        totalContacts = contactIds.length;
    }

    if (totalContacts === 0) {
        return NextResponse.json({ success: false, message: "No recipients found for the selected segment/filter" }, { status: 400 });
    }

    // 3. Create Campaign
    const campaign = await Campaign.create({
      workspace: workspace._id,
      name,
      template: templateId,
      templateSnapshot: {
          name: templateDoc.name,
          category: templateDoc.category,
          language: templateDoc.language
      },
      recipientFilter: segmentId ? { type: 'segment', segmentId } : recipientFilter,
      contacts: contactIds,
      variableMapping,
      campaignType,
      status: 'DRAFT',
      createdBy: user._id,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      totalContacts
    });

    console.log(`[API] Created campaign ${campaign.name} with ${totalContacts} recipients.`);

    return NextResponse.json({
      success: true,
      message: "Campaign created successfully",
      campaign
    });

  } catch (err: any) {
    console.error("[Campaign Create API Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: err.message || "Failed to create campaign" 
    }, { status: 500 });
  }
});
