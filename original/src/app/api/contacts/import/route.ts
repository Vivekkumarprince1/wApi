/**
 * API: /api/contacts/import
 * Bulk import contacts from CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { UsageTracker } from "@/lib/services/workspace/usage-tracker";

// Next.js config for large uploads
export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = withFeature('CONTACTS', async (req: NextRequest, { workspace }: any) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n');
    if (lines.length < 2) {
      return NextResponse.json({ message: "File is empty or missing headers" }, { status: 400 });
    }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const nameIndex = headers.indexOf('name');
    const phoneIndex = headers.indexOf('phone');
    const emailIndex = headers.indexOf('email');

    if (nameIndex === -1 || phoneIndex === -1) {
      return NextResponse.json({ message: "CSV must contain 'name' and 'phone' columns" }, { status: 400 });
    }

    await dbConnect();
    
    const bulkOps = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const cols = lines[i].split(',').map(c => c.trim());
        const phone = cols[phoneIndex];
        const name = cols[nameIndex];
        const email = emailIndex !== -1 ? cols[emailIndex] : undefined;

        if (!phone || phone.length < 5) continue;

        bulkOps.push({
            updateOne: {
                filter: { workspace: workspace._id, phone },
                update: {
                    $setOnInsert: {
                        workspace: workspace._id,
                        name: name || "Valued Customer",
                        phone,
                        metadata: { email },
                        tags: ['imported'],
                        leadStatus: 'new',
                        createdAt: new Date()
                    }
                },
                upsert: true
            }
        });
    }

    let imported = 0;
    if (bulkOps.length > 0) {
        const result = await Contact.bulkWrite(bulkOps);
        imported = result.upsertedCount;
    }

    if (imported > 0) {
        await UsageTracker.increment(workspace._id, 'contacts', imported);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${bulkOps.length} rows. Added ${imported} new contacts.`,
      imported,
      total: bulkOps.length
    });

  } catch (err: any) {
    console.error("[Contact Import API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
