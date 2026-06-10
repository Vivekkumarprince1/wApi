
import { Worker, Job } from 'bullmq';
import { getConnectionForWorker } from '../lib/ioredis';
import { ANSWERBOT_CRAWL_QUEUE_NAME } from './answerbot-crawl-queue';
import { AnswerBotCrawlerService } from './answerbot-crawler-service';

export class AnswerBotCrawlWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      ANSWERBOT_CRAWL_QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: getConnectionForWorker(),
        concurrency: 2,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`[AnswerBotCrawlWorker] Completed job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[AnswerBotCrawlWorker] Failed job ${job?.id}:`, err.message);
    });
  }

  private async processJob(job: Job) {
    const sourceId = String(job.data?.sourceId || '');
    if (!sourceId) {
      throw new Error('ANSWERBOT_CRAWL_SOURCE_ID_REQUIRED');
    }

    return AnswerBotCrawlerService.crawlSource(sourceId);
  }
}
