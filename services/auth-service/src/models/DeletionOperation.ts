import mongoose, { Schema } from 'mongoose';

const DeletionStepSchema = new Schema({
  service: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  attempts: { type: Number, default: 0 },
  lastError: String,
  completedAt: Date,
}, { _id: false });

const DeletionOperationSchema = new Schema({
  operationId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['WORKSPACE', 'ACCOUNT'], required: true },
  targetId: { type: String, required: true },
  workspaceIds: [{ type: String }],
  requestedBy: { type: String, required: true },
  idempotencyKey: { type: String, required: true, unique: true },
  state: { type: String, enum: ['REQUESTED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'RETRYING', 'COMPLETED', 'FAILED', 'MANUAL_REVIEW'], default: 'REQUESTED', index: true },
  steps: [DeletionStepSchema],
  attempts: { type: Number, default: 0 },
  lastError: String,
  nextRetryAt: Date,
  startedAt: Date,
  completedAt: Date,
}, { timestamps: true, collection: 'deletion_operations' });

DeletionOperationSchema.index({ state: 1, nextRetryAt: 1 });

export const DeletionOperation = mongoose.models.DeletionOperation || mongoose.model('DeletionOperation', DeletionOperationSchema);