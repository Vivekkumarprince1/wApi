import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { AutomationRule } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withFeature('CRM', async (req: NextRequest, { workspace }) => {
  try {
    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get('pipelineId');

    await dbConnect();

    const query: any = {
      workspace: workspace._id,
      deletedAt: null,
      'trigger.event': 'crm_deal_stage_changed'
    };

    if (pipelineId) {
      query['trigger.config.pipelineId'] = pipelineId;
    }

    const rules = await AutomationRule.find(query).sort({ createdAt: -1 });

    // Transform rules back to simple format for the UI
    const transformedRules = rules.map(rule => ({
      id: rule._id,
      trigger: rule.trigger?.config?.stageId ? 'stage_entry' : rule.trigger?.event,
      action: rule.actions?.[0]?.type,
      config: rule.trigger?.config,
      isActive: rule.enabled
    }));

    return NextResponse.json({ success: true, data: transformedRules });
  } catch (err: any) {
    console.error("[CRM Automation API GET Error]:", err.message);
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
});

export const POST = withFeature('CRM', async (req: NextRequest, { workspace, user }) => {
  try {
    const body = await req.json();
    const { id, trigger, action, isActive, config } = body;

    await dbConnect();

    // Map UI "Simple Rule" to AutomationRule schema
    const ruleData = {
      workspace: workspace._id,
      name: `CRM Automation: ${action} on ${trigger}`,
      category: 'workflow',
      enabled: isActive ?? true,
      trigger: {
        event: 'crm_deal_stage_changed',
        config: {
          pipelineId: config?.pipelineId,
          stageId: config?.stageId // Trigger only on specific stage entry
        }
      },
      actions: [
        {
          type: action,
          config: config?.actionConfig || {},
          order: 0,
          continueOnFailure: true
        }
      ],
      updatedBy: user._id
    };

    let rule;
    if (id && id.length > 20) { // MongoDB ID
       rule = await AutomationRule.findOneAndUpdate(
         { _id: id, workspace: workspace._id },
         ruleData,
         { new: true }
       );
    } else {
       rule = await AutomationRule.create({
         ...ruleData,
         createdBy: user._id
       });
    }

    return NextResponse.json({ 
      success: true, 
      data: rule,
      message: "Automation rule saved successfully" 
    });
  } catch (err: any) {
    console.error("[CRM Automation API POST Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

export const DELETE = withFeature('CRM', async (req: NextRequest, { workspace }) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ message: "ID is required" }, { status: 400 });

    await dbConnect();

    await AutomationRule.findOneAndUpdate(
      { _id: id, workspace: workspace._id },
      { deletedAt: new Date(), enabled: false }
    );

    return NextResponse.json({ success: true, message: "Rule deleted" });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
});
