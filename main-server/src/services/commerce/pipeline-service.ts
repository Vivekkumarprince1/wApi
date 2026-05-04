/**
 * PIPELINE SERVICE
 * 
 * Manages sales pipelines and stages.
 * Port of legacy pipelineService.js
 */

import { Pipeline, IPipeline } from "@/models";
import { Deal } from "@/models";
import { Types } from "mongoose";

const DEFAULT_STAGES = [
  { id: 'new', title: 'New', position: 0, isFinal: false, color: '#6366F1' },
  { id: 'contacted', title: 'Contacted', position: 1, isFinal: false, color: '#8B5CF6' },
  { id: 'qualified', title: 'Qualified', position: 2, isFinal: false, color: '#EC4899' },
  { id: 'won', title: 'Won', position: 3, isFinal: true, color: '#22C55E' },
  { id: 'lost', title: 'Lost', position: 4, isFinal: true, color: '#EF4444' }
];

export class PipelineService {
  /**
   * Get or create the default sales pipeline for a workspace
   */
  static async getOrCreateDefaultPipeline(workspaceId: string | Types.ObjectId): Promise<IPipeline> {
    let pipeline = await Pipeline.findOne({ workspace: workspaceId, isDefault: true });

    if (!pipeline) {
      pipeline = await Pipeline.create({
        workspace: workspaceId,
        name: 'Sales Pipeline',
        description: 'Primary sales pipeline',
        stages: DEFAULT_STAGES,
        isDefault: true
      });
    }

    return pipeline;
  }

  /**
   * Get Kanban view for a pipeline
   */
  static async getKanbanView(workspaceId: string | Types.ObjectId, pipelineId: string | Types.ObjectId) {
    const pipeline = await Pipeline.findOne({ _id: pipelineId, workspace: workspaceId }).lean();
    if (!pipeline) throw new Error('PIPELINE_NOT_FOUND');

    const deals = await Deal.find({
      workspace: workspaceId,
      pipeline: pipelineId,
      status: 'active'
    })
    .populate('contact', 'name phone tags')
    .populate('assignedAgent', 'name email')
    .lean();

    // Group deals by stage
    const kanban = pipeline.stages.map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      
      return {
        ...stage,
        deals: stageDeals,
        count: stageDeals.length,
        totalValue
      };
    });

    return kanban;
  }

  /**
   * Update pipeline stages
   */
  static async updateStages(workspaceId: string, pipelineId: string, stages: any[]) {
    return await Pipeline.findOneAndUpdate(
      { _id: pipelineId, workspace: workspaceId },
      { $set: { stages } },
      { returnDocument: 'after' }
    );
  }
}
