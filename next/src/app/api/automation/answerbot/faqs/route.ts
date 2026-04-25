import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { FAQ } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

/**
 * GET /api/automation/answerbot/faqs
 * List FAQs for workspace (with optional status/source filters)
 */
export const GET = withRole(['owner', 'admin', 'manager', 'agent'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const limit = parseInt(searchParams.get('limit') || '100');
  const skip = parseInt(searchParams.get('skip') || '0');

  const query: any = { workspace: workspace._id };
  if (status) query.status = status;
  if (source) query.source = source;

  const [faqs, total] = await Promise.all([
    FAQ.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    FAQ.countDocuments(query)
  ]);

  return NextResponse.json({ success: true, faqs, total, limit, skip });
});

/**
 * POST /api/automation/answerbot/faqs
 * Manually create a single FAQ entry
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const { question, answer, interactive } = await req.json();
  if (!question || !answer) {
    return NextResponse.json({ success: false, error: 'Question and answer are required' }, { status: 400 });
  }

  const faq = await FAQ.create({
    workspace: workspace._id,
    question,
    answer,
    interactive,
    status: 'draft',
    source: 'manual'
  });

  return NextResponse.json({ success: true, faq }, { status: 201 });
});
