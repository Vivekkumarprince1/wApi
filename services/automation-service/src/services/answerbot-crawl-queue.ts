
import { Queue } from 'bullmq';
import { getSharedConnection } from '../lib/ioredis';

export const ANSWERBOT_CRAWL_QUEUE_NAME = 'answerbot-crawl';

const connection = getSharedConnection;

export const answerBotCrawlQueue = new Queue(ANSWERBOT_CRAWL_QUEUE_NAME, {
  connection: getSharedConnection() as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function enqueueAnswerBotSourceCrawl(sourceId: string, workspaceId: string) {
  const jobId = `answerbot-crawl:${sourceId}`;

  return answerBotCrawlQueue.add(
    'crawl-source',
    {
      sourceId,
      workspaceId,
      queuedAt: new Date().toISOString(),
    },
    {
      jobId,
    }
  );
}
