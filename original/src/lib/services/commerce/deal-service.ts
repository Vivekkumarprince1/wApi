/**
 * DEAL SERVICE
 * 
 * Manages the CRM deal lifecycle.
 * Port of legacy dealService logic.
 */

import { Deal, IDeal, DealStatus } from "@/lib/models/commerce/Deal";
import { Pipeline } from "@/lib/models/commerce/Pipeline";
import { Contact } from "@/lib/models/messaging/Contact";
import { Types } from "mongoose";

export class DealService {
  /**
   * Create a new deal for a contact
   */
  static async createDeal(workspaceId: string | Types.ObjectId, dealData: any, userId?: string): Promise<IDeal> {
    const { contactId, pipelineId, title, value, currency, stage, assignedAgent, source = 'manual' } = dealData;

    // 1. Enforce "One active deal" constraint (Parity)
    const existing = await Deal.findOne({
      workspace: workspaceId,
      contact: contactId,
      status: DealStatus.ACTIVE
    });

    if (existing) {
      throw new Error('CONTACT_ALREADY_HAS_ACTIVE_DEAL');
    }

    // 2. Resolve Pipeline & Initial Stage
    const pipeline = await Pipeline.findOne({ _id: pipelineId, workspace: workspaceId });
    if (!pipeline) throw new Error('PIPELINE_NOT_FOUND');

    const initialStage = stage || pipeline.stages[0].id;

    // 3. Create Deal
    const deal = await Deal.create({
      workspace: workspaceId,
      contact: contactId,
      pipeline: pipelineId,
      title,
      value: value || 0,
      currency: currency || 'USD',
      stage: initialStage,
      assignedAgent,
      source,
      stageHistory: [{
        stage: initialStage,
        timestamp: new Date(),
        changedBy: userId
      }]
    });

    // 4. Sync to Contact
    await Contact.findByIdAndUpdate(contactId, {
      activeDealId: deal._id,
      activePipelineId: pipeline._id,
      assignedAgentId: assignedAgent
    });

    return deal;
  }

  /**
   * Move a deal to a new stage
   */
  static async moveStage(workspaceId: string, dealId: string, newStageId: string, userId?: string): Promise<IDeal> {
    const deal = await Deal.findOne({ _id: dealId, workspace: workspaceId }).populate('pipeline');
    if (!deal) throw new Error('DEAL_NOT_FOUND');

    const pipeline = await Pipeline.findById(deal.pipeline);
    if (!pipeline) throw new Error('PIPELINE_NOT_FOUND');

    const stageConfig = pipeline.stages.find(s => s.id === newStageId);
    if (!stageConfig) throw new Error('INVALID_STAGE');

    // 1. Update Stage & History
    deal.stage = newStageId;
    deal.stageHistory.push({
      stage: newStageId,
      timestamp: new Date(),
      changedBy: userId as any
    });

    // 2. Handle Terminal Stages
    if (stageConfig.isFinal) {
      deal.status = (newStageId.toLowerCase() === 'won') ? DealStatus.WON : DealStatus.LOST;
      deal.closedAt = new Date();

      // Clear active deal from contact
      await Contact.findByIdAndUpdate(deal.contact, {
        activeDealId: null,
        activePipelineId: null
      });
    }

    await deal.save();
    return deal;
  }

  /**
   * Add a collaborative note to a deal
   */
  static async addNote(workspaceId: string, dealId: string, text: string, userId: string): Promise<IDeal> {
    const authorId = new Types.ObjectId(userId);
    return await Deal.findOneAndUpdate(
      { _id: dealId, workspace: workspaceId },
      { 
        $push: { 
          notes: { 
            text, 
            author: authorId, 
            createdAt: new Date() 
          } 
        } 
      },
      { returnDocument: 'after' }
    ) as IDeal;
  }
}
