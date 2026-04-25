import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { AnswerBotSettings } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

/**
 * GET /api/automation/answerbot/settings
 */
export const GET = withRole(['owner', 'admin', 'manager'], async (_req: NextRequest, { workspace }) => {
  await dbConnect();

  let settings = await AnswerBotSettings.findOne({ workspace: workspace._id });
  if (!settings) {
    settings = await AnswerBotSettings.create({
      workspace: workspace._id,
      enabled: false,
      personaName: 'Smart Assistant'
    });
  }

  return NextResponse.json({ success: true, settings });
});

/**
 * PATCH /api/automation/answerbot/settings
 */
export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const updates = await req.json();
  const settings = await AnswerBotSettings.findOneAndUpdate(
    { workspace: workspace._id },
    { $set: updates },
    { returnDocument: 'after', upsert: true }
  );

  return NextResponse.json({ success: true, settings });
});
