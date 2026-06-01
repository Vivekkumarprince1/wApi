import { Queue, Job, Worker } from 'bullmq';
import { Readable } from 'stream';
import { parse } from 'csv-parse';
import { getIO } from '../socket-bridge';
import { Contact, Workspace } from '../../models';
import redis from '../../redis';
import { QUEUE_NAMES } from '@wapi/contracts';

interface ContactImportProgress {
  jobId: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{ row: number; error: string }>;
  status: 'started' | 'in-progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  speed: number; // rows per second
}

interface ContactRow {
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  jobTitle?: string;
  customFields?: Record<string, any>;
  tags?: string[];
}

const BATCH_SIZE = 100;
const CHUNK_SIZE = 1000;

export class ContactImportService {
  private importQueue: Queue;
  private progressMap: Map<string, ContactImportProgress>;

  constructor() {
    this.importQueue = new Queue(QUEUE_NAMES.IMPORT_CSV, {
      connection: redis as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep for 1 hour
        },
      },
    });

    this.progressMap = new Map();
    this.initializeWorker();
  }

  /**
   * Parse CSV content and return ContactRow array
   */
  async parseCSV(
    csvContent: string,
    workspaceId: string
  ): Promise<{ rows: ContactRow[]; errors: Array<{ row: number; error: string }> }> {
    return new Promise((resolve, reject) => {
      const rows: ContactRow[] = [];
      const errors: Array<{ row: number; error: string }> = [];
      let rowNumber = 0;
      let headerRow: string[] = [];

      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        on_record: (record: any, { lines }: any) => {
          rowNumber = lines;

          // Validate required fields
          if (!record.phone && !record.email) {
            errors.push({
              row: rowNumber,
              error: 'At least phone or email is required',
            });
            return;
          }

          try {
            const row: ContactRow = {
              name: record.name || '',
              email: record.email ? record.email.toLowerCase().trim() : undefined,
              phone: record.phone ? record.phone.replace(/\D/g, '') : undefined,
              companyName: record.companyName || record.company || '',
              jobTitle: record.jobTitle || record.job_title || '',
              tags: record.tags ? record.tags.split(',').map((t: any) => t.trim()) : [],
            };

            // Extract custom fields (any column not in standard set)
            const standardFields = ['name', 'email', 'phone', 'companyName', 'company', 'jobTitle', 'job_title', 'tags'];
            const customFields: Record<string, any> = {};

            Object.keys(record).forEach((key: string) => {
              if (!standardFields.includes(key) && record[key]) {
                customFields[key] = record[key];
              }
            });

            if (Object.keys(customFields).length > 0) {
              row.customFields = customFields;
            }

            rows.push(row);
          } catch (error) {
            errors.push({
              row: rowNumber,
              error: (error as Error).message,
            });
          }
        },
      });

      parser.on('error', (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      });

      parser.on('end', () => {
        resolve({ rows, errors });
      });

      const readable = Readable.from([csvContent]);
      readable.pipe(parser);
    });
  }

  /**
   * Start an import job
   */
  async startImport(
    workspaceId: string,
    userId: string,
    fileName: string,
    csvContent: string
  ): Promise<string> {
    // Parse CSV and validate
    const { rows, errors } = await this.parseCSV(csvContent, workspaceId);

    if (rows.length === 0) {
      throw new Error('No valid contacts found in CSV file');
    }

    // Create import job
    const jobData = {
      workspaceId,
      userId,
      fileName,
      contacts: rows,
      totalCount: rows.length,
      parseErrors: errors,
    };

    const job = await this.importQueue.add(`import-${Date.now()}`, jobData);

    // Initialize progress tracking
    const progress: ContactImportProgress = {
      jobId: job.id!,
      fileName,
      totalRows: rows.length,
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      errors: errors.slice(0, 10), // Store first 10 errors
      status: 'started',
      startedAt: new Date(),
      speed: 0,
    };

    this.progressMap.set(job.id!, progress);

    // Persist to Redis
    await redis.setex(
      `import:${job.id}`,
      86400, // 24 hours
      JSON.stringify(progress)
    );

    return job.id!;
  }

  /**
   * Get import job progress
   */
  async getProgress(jobId: string): Promise<ContactImportProgress | null> {
    // Try memory first
    if (this.progressMap.has(jobId)) {
      return this.progressMap.get(jobId) || null;
    }

    // Try Redis
    const cached = await redis.get(`import:${jobId}`);
    if (cached) {
      const progress = JSON.parse(cached) as ContactImportProgress;
      this.progressMap.set(jobId, progress);
      return progress;
    }

    return null;
  }

  /**
   * Cancel an import job
   */
  async cancelImport(jobId: string): Promise<void> {
    const job = await this.importQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
    this.progressMap.delete(jobId);
    await redis.del(`import:${jobId}`);
  }

  /**
   * Get all active import jobs for a workspace
   */
  async getActiveImports(workspaceId: string): Promise<ContactImportProgress[]> {
    const jobs = await this.importQueue.getJobs(['waiting', 'active']);
    return jobs
      .map((job) => this.progressMap.get(job.id!))
      .filter((progress): progress is ContactImportProgress => progress !== undefined && progress.jobId !== undefined)
      .slice(0, 10);
  }

  /**
   * Initialize BullMQ worker
   */
  private initializeWorker() {
    const worker = new Worker(
      QUEUE_NAMES.IMPORT_CSV,
      async (job: Job) => {
        const { workspaceId, userId, contacts, totalCount, parseErrors } = job.data;

        const progress = this.progressMap.get(job.id!)!;
        progress.status = 'in-progress';

        const startTime = Date.now();
        let processedCount = 0;

        try {
          // Process in batches
          for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
            const batch = contacts.slice(i, i + BATCH_SIZE);

            const results = await Promise.allSettled(
              batch.map((contact: ContactRow) =>
                this.createOrUpdateContact(workspaceId, contact)
              )
            );

            // Update progress
            results.forEach((result) => {
              processedCount++;
              if (result.status === 'fulfilled') {
                progress.successfulRows++;
              } else {
                progress.failedRows++;
                if (progress.errors.length < 10) {
                  progress.errors.push({
                    row: processedCount,
                    error: (result.reason as Error).message,
                  });
                }
              }
            });

            progress.processedRows = processedCount;
            progress.speed = processedCount / ((Date.now() - startTime) / 1000);

            // Update progress in Redis and emit socket event
            await this.updateProgressAndEmit(workspaceId, progress);

            // Avoid blocking
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          progress.status = 'completed';
          progress.completedAt = new Date();
        } catch (error) {
          progress.status = 'failed';
          progress.errors.push({
            row: 0,
            error: (error as Error).message,
          });
          throw error;
        }

        // Final update
        await this.updateProgressAndEmit(workspaceId, progress);

        return {
          successful: progress.successfulRows,
          failed: progress.failedRows,
          total: progress.totalRows,
        };
      },
      {
        connection: redis as any,
        concurrency: 2,
      }
    );

    worker.on('failed', (job, error) => {
      const progress = this.progressMap.get(job!.id!)!;
      progress.status = 'failed';
      progress.errors.push({
        row: 0,
        error: error.message,
      });
    });
  }

  /**
   * Create or update a contact
   */
  private async createOrUpdateContact(
    workspaceId: string,
    contact: ContactRow
  ): Promise<void> {
    const query: any = { workspaceId };

    if (contact.email) {
      query.email = contact.email;
    } else if (contact.phone) {
      query.phone = contact.phone;
    }

    const existingContact = await Contact.findOne(query);

    const contactData = {
      workspaceId,
      name: contact.name || 'Unknown',
      email: contact.email,
      phone: contact.phone,
      companyName: contact.companyName,
      jobTitle: contact.jobTitle,
      customFields: contact.customFields || {},
      tags: [...(contact.tags || [])],
      source: 'csv-import',
      importedAt: new Date(),
    };

    if (existingContact) {
      // Update existing contact
      await Contact.findByIdAndUpdate(existingContact._id, {
        ...contactData,
        tags: [...new Set([...existingContact.tags, ...(contact.tags || [])])],
      });
    } else {
      // Create new contact
      await Contact.create(contactData);
    }
  }

  /**
   * Update progress and emit Socket event
   */
  private async updateProgressAndEmit(
    workspaceId: string,
    progress: ContactImportProgress
  ): Promise<void> {
    // Update cache
    this.progressMap.set(progress.jobId, progress);
    await redis.setex(
      `import:${progress.jobId}`,
      86400,
      JSON.stringify(progress)
    );

    // Emit Socket event
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('contact-import:progress', {
        jobId: progress.jobId,
        processedRows: progress.processedRows,
        totalRows: progress.totalRows,
        successfulRows: progress.successfulRows,
        failedRows: progress.failedRows,
        status: progress.status,
        speed: progress.speed,
        percentComplete: Math.round((progress.processedRows / progress.totalRows) * 100),
      });
    }
  }
}

// Export singleton
export const contactImportService = new ContactImportService();
