import { NextRequest, NextResponse } from "next/server";
import { withRole, withFeature } from "@/lib/middlewares/auth";
import { AnswerBotSource, AnswerBotSettings } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/automation/answerbot
 * Get settings and knowledge sources
 */
export const GET = withFeature('ANSWERBOT', withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace }: any) => {
  await dbConnect();
  
  const [settings, sources] = await Promise.all([
    AnswerBotSettings.findOne({ workspace: workspace._id }),
    AnswerBotSource.find({ workspace: workspace._id, deletedAt: { $exists: false } }).sort('-createdAt')
  ]);

  return NextResponse.json({
    success: true,
    data: {
      settings: settings || { enabled: false, personaName: 'Smart Assistant' },
      sources
    }
  });
})) as any;

/**
 * PATCH /api/automation/answerbot
 * Update AnswerBot global settings
 */
export const PATCH = withFeature('ANSWERBOT', withRole(['owner', 'admin'], async (req: NextRequest, { workspace }: any) => {
  await dbConnect();
  
  const body = await req.json();
  const settings = await AnswerBotSettings.findOneAndUpdate(
    { workspace: workspace._id },
    { $set: body },
    { returnDocument: 'after', upsert: true }
  );

  return NextResponse.json({
    success: true,
    data: settings
  });
})) as any;

/**
 * POST /api/automation/answerbot/sources
 * Add a new knowledge source
 */
export const POST_SOURCE = withFeature('ANSWERBOT', withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();
  
  const body = await req.json();
  const { sourceType, title, websiteUrl, textContent } = body;

  const source = new AnswerBotSource({
    workspace: workspace._id,
    sourceType,
    title,
    websiteUrl,
    textContent,
    crawlStatus: sourceType === 'url' ? 'in_progress' : 'completed',
    faqCount: 0
  });

  await source.save();

  // If URL, trigger Crawler Service (TODO)
  if (sourceType === 'url') {
    console.log(`[AnswerBot] Triggering crawl for ${websiteUrl}`);
  }

  return NextResponse.json({
    success: true,
    data: source
  });
})) as any;
