import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { FAQ, AnswerBotSource } from '@/lib/models';
import dbConnect from '@/lib/db-connect';
import * as cheerio from 'cheerio';

/**
 * POST /api/automation/answerbot/faqs/generate
 * Scrape a website URL and extract FAQ pairs for triage.
 * Mirrors legacy answerbotController.generateFAQs + answerbotService.generateFAQsFromWebsite
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const { websiteUrl } = await req.json();
  if (!websiteUrl) {
    return NextResponse.json({ success: false, error: 'Website URL is required' }, { status: 400 });
  }

  try {
    new URL(websiteUrl); // throws on invalid URL
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid website URL format' }, { status: 400 });
  }

  try {
    // Fetch and scrape the webpage
    const res = await fetch(websiteUrl, {
      headers: { 'User-Agent': 'wApi-AnswerBot/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract meaningful text blocks for FAQ generation
    const textBlocks: string[] = [];
    $('h1, h2, h3, h4, p, li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 40 && text.length < 600) {
        textBlocks.push(text);
      }
    });

    // Build draft FAQ pairs from headings + adjacent paragraphs
    const draftFaqs: { question: string; answer: string }[] = [];
    $('h2, h3').each((_, el) => {
      const heading = $(el).text().trim();
      const nextParagraph = $(el).next('p').text().trim();
      if (heading && nextParagraph && nextParagraph.length > 20) {
        draftFaqs.push({
          question: heading.endsWith('?') ? heading : `${heading}?`,
          answer: nextParagraph
        });
      }
    });

    if (draftFaqs.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Could not extract enough content from the provided URL. Try adding a text source instead.'
      }, { status: 400 });
    }

    // Upsert source record first so generated FAQs can reference it
    const source = await AnswerBotSource.findOneAndUpdate(
      { workspace: workspace._id, websiteUrl },
      {
        $set: {
          workspace: workspace._id,
          sourceType: 'url',
          title: new URL(websiteUrl).hostname,
          websiteUrl,
          crawlStatus: 'completed',
          completedAt: new Date(),
          metadata: {
            pagesCrawled: 1,
            questionsFound: draftFaqs.length,
            lastCrawledAt: new Date()
          }
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Persist as draft FAQs
    const faqDocs = await FAQ.insertMany(draftFaqs.slice(0, 30).map(f => ({
      workspace: workspace._id,
      question: f.question,
      answer: f.answer,
      status: 'draft',
      source: 'answerbot',
      answerBotSource: source?._id
    })));

    await AnswerBotSource.findByIdAndUpdate(source?._id, {
      $inc: { faqCount: faqDocs.length }
    });

    return NextResponse.json({
      success: true,
      faqs: faqDocs,
      source: websiteUrl,
      message: `${faqDocs.length} FAQ drafts extracted — review and approve to make them live`
    });

  } catch (err: any) {
    console.error('[AnswerBot] FAQ generation failed:', err.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to crawl or extract content. The site may be blocking bots.'
    }, { status: 500 });
  }
});
