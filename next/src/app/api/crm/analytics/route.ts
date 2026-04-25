import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Deal, Pipeline, Contact, Task } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import mongoose from "mongoose";

export const GET = withFeature('REPORTS', async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    const workspaceId = workspace._id;
    const ObjectId = mongoose.Types.ObjectId;

    // 1. Funnel Data (Deals per stage)
    // We'll get the default pipeline or the one specified
    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get('pipelineId');
    
    let pipeline;
    if (pipelineId) {
      pipeline = await Pipeline.findOne({ _id: pipelineId, workspace: workspaceId });
    } else {
      pipeline = await Pipeline.findOne({ workspace: workspaceId, isDefault: true }) || 
                 await Pipeline.findOne({ workspace: workspaceId });
    }

    if (!pipeline) {
      return NextResponse.json({ success: false, message: "No pipeline found" }, { status: 404 });
    }

    const deals = await Deal.find({ workspace: workspaceId, pipeline: pipeline._id });

    // Count deals per stage
    const funnelData = pipeline.stages.map(stage => ({
      stage: stage.title,
      count: deals.filter(d => d.stage === stage.id).length,
      value: deals.filter(d => d.stage === stage.id).reduce((sum, d) => sum + (d.value || 0), 0)
    }));

    // 2. Status Distribution (Won / Lost / Active)
    const statusData = [
      { name: 'Active', value: deals.filter(d => d.status === 'active').length, color: '#3B82F6' },
      { name: 'Won', value: deals.filter(d => d.status === 'won').length, color: '#10B981' },
      { name: 'Lost', value: deals.filter(d => d.status === 'lost').length, color: '#EF4444' },
      { name: 'Archived', value: deals.filter(d => d.status === 'archived').length, color: '#6B7280' }
    ];

    // 3. Agent Performance (Top agents by deals won)
    const agentPerformance = await Deal.aggregate([
      { $match: { workspace: new ObjectId(workspaceId), status: 'won' } },
      { $group: { 
          _id: "$assignedAgent", 
          count: { $sum: 1 }, 
          totalValue: { $sum: "$value" } 
      } },
      { $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "agent"
      } },
      { $unwind: "$agent" },
      { $project: {
          name: "$agent.name",
          count: 1,
          totalValue: 1
      } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // 4. Overdue Tasks vs Pending
    const tasks = await Task.find({ workspace: workspaceId, status: { $ne: 'Completed' } });
    const now = new Date();
    const taskStats = {
      pending: tasks.length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length
    };

    // 5. Total Metrics
    const activeValue = deals.filter(d => d.status === 'active').reduce((sum, d) => sum + (d.value || 0), 0);
    const wonValue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + (d.value || 0), 0);
    const winRate = deals.length > 0 ? (deals.filter(d => d.status === 'won').length / deals.length) * 100 : 0;

    // 6. Intelligence Insights (Calculated)
    
    // A. Velocity: Avg. Age in Pipeline
    let totalAgeDays = 0;
    deals.forEach(d => {
      const end = d.closedAt ? new Date(d.closedAt) : now;
      const start = new Date(d.createdAt);
      totalAgeDays += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    });
    const avgAgeInPipeline = deals.length > 0 ? Math.round((totalAgeDays / deals.length) * 10) / 10 : 0;

    // B. Friction: Stage with highest dropout (Lost deals)
    const stageDropouts: Record<string, number> = {};
    deals.filter(d => d.status === 'lost').forEach(d => {
      if (d.stage) stageDropouts[d.stage] = (stageDropouts[d.stage] || 0) + 1;
    });
    
    let frictionStage = "None";
    let maxDropouts = -1;
    Object.entries(stageDropouts).forEach(([sId, count]) => {
      if (count > maxDropouts) {
        maxDropouts = count;
        const stage = pipeline.stages.find(s => s.id === sId);
        frictionStage = stage ? stage.title : sId;
      }
    });

    // C. Attribution: Source Analysis
    const sourceAttribution = await Deal.aggregate([
      { $match: { workspace: new ObjectId(workspaceId) } },
      { $group: { 
          _id: "$source", 
          count: { $sum: 1 }, 
          totalValue: { $sum: "$value" } 
      } },
      { $project: {
          label: { $ifNull: ["$_id", "Unknown"] },
          val: { $multiply: [{ $divide: ["$count", deals.length || 1] }, 100] },
          color: { $literal: "bg-primary" } // Frontend handles color mapping
      } },
      { $sort: { val: -1 } }
    ]);

    return NextResponse.json({
      success: true,
      data: {
        funnelData,
        statusData,
        agentPerformance,
        taskStats,
        intelligence: {
          avgAgeInPipeline,
          frictionStage,
          sourceAttribution,
          velocityIndex: 70, // Mocked index based on velocity
          hustleFactor: 85 // Mocked index based on activityLog/Task ratio
        },
        metrics: {
          activeValue,
          wonValue,
          winRate: Math.round(winRate * 10) / 10,
          totalDeals: deals.length
        }
      }
    });

  } catch (err: any) {
    console.error("[CRM Analytics API Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
