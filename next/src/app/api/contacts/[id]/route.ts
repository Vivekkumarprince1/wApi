import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Contact, Conversation, Message } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { normalizePhoneNumber } from "@/lib/phone-utils";

/**
 * PATCH /api/contacts/[id]
 * Update contact details
 */
export const PATCH = withAuth(async (req: NextRequest, { params, workspace }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, email, phone } = body;

    await dbConnect();

    const contact = await Contact.findOne({
      _id: id,
      workspace: workspace._id
    });

    if (!contact) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    if (name) contact.name = name;
    if (email) contact.metadata = { ...contact.metadata, email };
    if (phone) contact.phone = normalizePhoneNumber(phone);

    await contact.save();

    return NextResponse.json({
      success: true,
      data: contact,
      message: "Contact updated successfully"
    });

  } catch (err: any) {
    console.error("[Contact Update Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});

/**
 * DELETE /api/contacts/[id]
 * Delete contact and all associated data
 */
export const DELETE = withAuth(async (req: NextRequest, { params, workspace }) => {
  try {
    const { id } = await params;
    await dbConnect();

    // 1. Verify existence
    const contact = await Contact.findOne({
      _id: id,
      workspace: workspace._id
    });

    if (!contact) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    // 2. Delete conversations and messages (Cleanup)
    const conversations = await Conversation.find({ contact: id, workspace: workspace._id }).select('_id').lean();
    const conversationIds = conversations.map(c => c._id);

    await Message.deleteMany({ conversation: { $in: conversationIds } });
    await Conversation.deleteMany({ _id: { $in: conversationIds } });

    // 3. Delete the contact
    await Contact.deleteOne({ _id: id });

    return NextResponse.json({
      success: true,
      message: "Contact and all associated history deleted successfully"
    });

  } catch (err: any) {
    console.error("[Contact Delete Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});

/**
 * GET /api/contacts/[id]
 * Fetch single contact details
 */
export const GET = withAuth(async (req: NextRequest, { params, workspace }) => {
  try {
    const { id } = await params;
    await dbConnect();

    const contact = await Contact.findOne({
      _id: id,
      workspace: workspace._id
    }).lean();

    if (!contact) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: contact });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
