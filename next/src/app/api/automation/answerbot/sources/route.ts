import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { AnswerBotSource } from '@/lib/models';
import { enqueueAnswerBotSourceCrawl } from '@/lib/services/automation/answerbot-crawl-queue';
import dbConnect from '@/lib/db-connect';

/**
 * GET /api/automation/answerbot/sources
 * List all knowledge sources for workspace
 */
export const GET = withRole(['owner', 'admin', 'manager', 'agent'], async (_req: NextRequest, { workspace }) => {
  await dbConnect();

  const sources = await AnswerBotSource.find({
    workspace: workspace._id,
    deletedAt: { $exists: false }
  }).sort({ createdAt: -1 }).lean();

  return NextResponse.json({ success: true, sources });
});

/**
 * POST /api/automation/answerbot/sources
 * Add a new knowledge source (URL, text, or document)
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const { sourceType = 'url', title, websiteUrl, textContent, documentData } = await req.json();

  if (sourceType === 'url' && !websiteUrl) {
    return NextResponse.json({ success: false, error: 'Website URL is required for URL sources' }, { status: 400 });
  }
  if (sourceType === 'text' && !textContent) {
    return NextResponse.json({ success: false, error: 'Text content is required for text sources' }, { status: 400 });
  }

  const source = await AnswerBotSource.create({
    workspace: workspace._id,
    sourceType,
    title: title || (sourceType === 'url' ? websiteUrl : `New ${sourceType} Source`),
    websiteUrl,
    textContent,
    documentData,
    crawlStatus: sourceType === 'url' ? 'in_progress' : 'completed',
    faqCount: 0
  });

  // If URL source: trigger background crawl (to be wired to a BullMQ worker)
  if (sourceType === 'url') {
    console.log(`[AnswerBot] Queuing crawl for: ${websiteUrl}`);
    await enqueueAnswerBotSourceCrawl(source._id.toString(), workspace._id.toString());
  }

  return NextResponse.json({ success: true, source }, { status: 201 });
});
