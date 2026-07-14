import type { Response } from 'express';
import type { AuthRequest } from '../middleware/businessAuth.js';
import { DeletionOperationService } from '../services/deletion-operation-service.js';

export async function requestWorkspaceDeletion(req: AuthRequest, res: Response) {
  const idempotencyKey = String(req.header('idempotency-key') || req.header('x-idempotency-key') || '').trim();
  if (!idempotencyKey) return res.status(400).json({ success: false, error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key is required' } });
  const operation = await DeletionOperationService.requestWorkspace({ workspaceId: req.params.workspaceId, requestedBy: String(req.user._id), idempotencyKey });
  return res.status(202).json({ success: true, operationId: operation.operationId, state: operation.state });
}

export async function getDeletionOperation(req: AuthRequest, res: Response) {
  const operation = await DeletionOperationService.get(req.params.operationId);
  if (!operation) return res.status(404).json({ success: false, error: { code: 'OPERATION_NOT_FOUND', message: 'Deletion operation not found' } });
  return res.json({ success: true, operation });
}

export async function retryDeletionOperation(req: AuthRequest, res: Response) {
  const operation = await DeletionOperationService.retry(req.params.operationId);
  if (!operation) return res.status(404).json({ success: false, error: { code: 'OPERATION_NOT_FOUND', message: 'Deletion operation not found' } });
  return res.status(202).json({ success: true, operationId: operation.operationId, state: operation.state });
}