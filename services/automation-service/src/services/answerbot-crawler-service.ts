import * as cheerio from 'cheerio';
import { dbConnect } from '../lib/db';
import { AnswerBotSource, FAQ } from '../models';

function normalizeQuestion(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  return trimmed.endsWith('?') ? trimmed : `${trimmed}?`;
}

function extractFaqDrafts(html: string) {
  const $ = cheerio.load(html);
  const drafts: Array<{ question: string; answer: string }> = [];

  $('h1, h2, h3, h4').each((_, el) => {
    const heading = normalizeQuestion($(el).text());
    if (!heading) return;

    const answer = $(el).nextAll('p').first().text().trim();
    if (!answer || answer.length < 20) return;

    drafts.push({ question: heading, answer });
  });

  const deduped = new Map<string, { question: string; answer: string }>();
  for (const item of drafts) {
    const key = item.question.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, item);
  }

  return Array.from(deduped.values()).slice(0, 40);
}

export class AnswerBotCrawlerService {
  static async crawlSource(sourceId: string) {
    await dbConnect();

    const source = await AnswerBotSource.findById(sourceId);
    if (!source) {
      throw new Error('ANSWERBOT_SOURCE_NOT_FOUND');
    }

    if (source.sourceType !== 'url' || !source.websiteUrl) {
      return { success: true, skipped: true, reason: 'NON_URL_SOURCE' };
    }

    const startedAt = Date.now();

    await AnswerBotSource.findByIdAndUpdate(source._id, {
      $set: {
        crawlStatus: 'in_progress',
        errorMessage: null,
        'metadata.lastCrawledAt': new Date(),
      },
    });

    try {
      const res = await fetch(source.websiteUrl, {
        headers: { 'User-Agent': 'ConnectSphere-AnswerBotCrawler/1.0' },
        signal: AbortSignal.timeout(12000),
      });

      const html = await res.text();
      const drafts = extractFaqDrafts(html);

      if (!drafts.length) {
        throw new Error('NO_FAQ_CONTENT_EXTRACTED');
      }

      await FAQ.deleteMany({
        workspace: source.workspace,
        source: 'answerbot',
        answerBotSource: source._id,
        status: 'draft',
      });

      const docs = await FAQ.insertMany(
        drafts.map((f) => ({
          workspace: source.workspace,
          question: f.question,
          answer: f.answer,
          status: 'draft',
          source: 'answerbot',
          answerBotSource: source._id,
        })),
        { ordered: false }
      );

      await AnswerBotSource.findByIdAndUpdate(source._id, {
        $set: {
          crawlStatus: 'completed',
          faqCount: docs.length,
          completedAt: new Date(),
          errorMessage: null,
          metadata: {
            pagesCrawled: 1,
            totalPages: 1,
            questionsFound: docs.length,
            crawlDurationMs: Date.now() - startedAt,
            lastCrawledAt: new Date(),
          },
        },
      });

      return { success: true, draftsCreated: docs.length };
    } catch (error: any) {
      await AnswerBotSource.findByIdAndUpdate(source._id, {
        $set: {
          crawlStatus: 'failed',
          errorMessage: String(error?.message || 'Crawl failed'),
          completedAt: new Date(),
          'metadata.crawlDurationMs': Date.now() - startedAt,
          'metadata.lastCrawledAt': new Date(),
        },
      });

      throw error;
    }
  }
}
