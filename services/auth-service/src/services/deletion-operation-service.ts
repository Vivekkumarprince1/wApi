import crypto from 'crypto';
import axios from 'axios';
import { DeletionOperation } from '../models/DeletionOperation.js';
import { Workspace } from '../models/index.js';
import { AccountDeletionService } from './account-deletion-service.js';
import config from '../config/index.js';
import { enqueueDeletionOperation } from './deletion-queue.js';

const targets = [
  { service: 'automation', base: () => process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3001', path: (id: string) => `/api/automation/engine/internal/purge/${id}` },
  { service: 'campaign', base: () => process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002', path: (id: string) => `/api/campaign/internal/purge/${id}` },
];

export class DeletionOperationService {
  static async requestWorkspace(input: { workspaceId: string; requestedBy: string; idempotencyKey: string }) {
    const workspace = await Workspace.findById(input.workspaceId).select('_id owner').lean();
    if (!workspace) throw Object.assign(new Error('Workspace not found'), { status: 404 });
    const operationId = crypto.randomUUID();
    const operation = await DeletionOperation.findOneAndUpdate(
      { idempotencyKey: input.idempotencyKey },
      { $setOnInsert: {
        operationId, type: 'WORKSPACE', targetId: input.workspaceId, workspaceIds: [input.workspaceId],
        requestedBy: input.requestedBy, idempotencyKey: input.idempotencyKey,
        state: 'REQUESTED', steps: targets.map(({ service }) => ({ service, status: 'PENDING', attempts: 0 })),
      } },
      { upsert: true, new: true },
    );
    if (operation.state === 'REQUESTED' || operation.state === 'RETRYING' || operation.state === 'FAILED') {
      await enqueueDeletionOperation(operation.operationId, Number(operation.attempts || 0) + 1);
    }
    return operation;
  }

  static async run(operationId: string) {
    const operation = await DeletionOperation.findOneAndUpdate(
      { operationId, state: { $in: ['REQUESTED', 'RETRYING', 'FAILED', 'PARTIALLY_COMPLETED'] } },
      { $set: { state: 'IN_PROGRESS', startedAt: new Date() }, $inc: { attempts: 1 } },
      { new: true },
    );
    if (!operation) return DeletionOperation.findOne({ operationId });

    await Workspace.updateMany({ _id: { $in: operation.workspaceIds } }, { $set: { deletionStatus: 'deleting', deletionOperationId: operationId } });
    let failed = false;
    for (const workspaceId of operation.workspaceIds) {
      for (const target of targets) {
        const step = operation.steps.find((item: any) => item.service === target.service);
        if (step?.status === 'COMPLETED') continue;
        try {
          await DeletionOperation.updateOne({ operationId, 'steps.service': target.service }, {
            $set: { 'steps.$.status': 'IN_PROGRESS' }, $inc: { 'steps.$.attempts': 1 },
          });
          const response = await axios.delete(`${target.base()}${target.path(workspaceId)}`, {
            headers: { 'x-internal-service': 'auth-service', 'x-internal-service-secret': config.internalServiceSecret },
            timeout: 10000,
            validateStatus: () => true,
          });
          if (response.status >= 300 && response.status !== 404) throw new Error(`${target.service} returned ${response.status}`);
          await DeletionOperation.updateOne({ operationId, 'steps.service': target.service }, {
            $set: { 'steps.$.status': 'COMPLETED', 'steps.$.completedAt': new Date(), 'steps.$.lastError': null },
          });
        } catch (error: any) {
          failed = true;
          await DeletionOperation.updateOne({ operationId, 'steps.service': target.service }, {
            $set: { 'steps.$.status': 'FAILED', 'steps.$.lastError': error.message },
          });
        }
      }
    }

    if (failed) {
      return DeletionOperation.findOneAndUpdate(
        { operationId },
        { $set: { state: operation.attempts >= 7 ? 'MANUAL_REVIEW' : 'PARTIALLY_COMPLETED', nextRetryAt: new Date(Date.now() + 60_000), lastError: 'One or more services failed to purge' } },
        { new: true },
      );
    }

    await AccountDeletionService.finalizeWorkspaceDeletion(operation.targetId);
    return DeletionOperation.findOneAndUpdate({ operationId }, { $set: { state: 'COMPLETED', completedAt: new Date(), lastError: null } }, { new: true });
  }

  static get(operationId: string) {
    return DeletionOperation.findOne({ operationId }).lean();
  }

  static async retry(operationId: string) {
    const operation = await DeletionOperation.findOneAndUpdate(
      { operationId, state: { $ne: 'COMPLETED' } },
      { $set: { state: 'RETRYING', nextRetryAt: new Date(), lastError: null } },
      { new: true },
    );
    if (!operation) return null;
    await enqueueDeletionOperation(operationId, Number(operation.attempts || 0) + 1);
    return operation;
  }
}