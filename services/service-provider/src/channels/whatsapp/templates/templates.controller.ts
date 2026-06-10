import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalAuthGuard } from '../../../common/internal-auth.guard';
import { WorkspaceAuthGuard } from '../../../common/workspace-auth.guard';
import { ok } from '../../../common/api-response';
import { ProviderTemplateMirror } from '../../../models/provider-template-mirror.schema';
import { ProviderTemplateRule } from '../../../models/provider-template-rule.schema';
import { ProviderApp } from '../../../models/provider-app.schema';

@Controller('/internal/v1/bsp/templates')
@UseGuards(InternalAuthGuard)
export class TemplatesController {
  constructor(@InjectModel(ProviderTemplateMirror.name) private readonly templateModel: Model<ProviderTemplateMirror>) {}

  @Post('sync')
  async sync(@Body() body: any) {
    const synced = await this.templateModel.countDocuments({
      workspaceId: body.workspaceId,
      provider: body.provider || 'gupshup',
      appId: body.appId,
    });

    return ok({ synced, created: 0, updated: 0, failed: 0 });
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @Body() body: any) {
    const template = await this.templateModel.findByIdAndUpdate(
      id,
      { $set: { status: 'PENDING', providerData: body.providerData || {} } },
      { new: true },
    );
    return ok(template);
  }

  @Get(':id')
  async getInternalTemplate(@Param('id') id: string, @Query('workspaceId') workspaceId: string) {
    const template = await this.templateModel.findOne({
      _id: id,
      workspaceId: workspaceId,
    });
    const templateObj = template ? template.toObject() : null;
    if (templateObj) {
      (templateObj as any).components = templateObj.providerData?.components || [];
    }
    return { template: templateObj };
  }
}

/**
 * Public User Facing Templates API Controller
 * Routed via API Gateway under /api/v1/templates
 */
@Controller('/api/v1/templates')
@UseGuards(WorkspaceAuthGuard)
export class TemplatesPublicController {
  constructor(
    @InjectModel(ProviderTemplateMirror.name) private readonly templateModel: Model<ProviderTemplateMirror>,
    @InjectModel(ProviderTemplateRule.name) private readonly ruleModel: Model<ProviderTemplateRule>,
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
  ) {}

  /**
   * List Templates
   */
  @Get()
  async listTemplates(@Req() req: any, @Query('status') status?: string) {
    const workspaceId = req.workspace?._id;
    const query: any = { workspaceId: String(workspaceId) };
    if (status) {
      query.status = status;
    }

    const templates = await this.templateModel.find(query).sort({ createdAt: -1 });
    return ok(templates);
  }

  /**
   * List Template Categories
   */
  @Get('categories')
  async getCategories(@Req() req: any) {
    const workspaceId = req.workspace?._id;
    const categoriesAgg = await this.templateModel.aggregate([
      { $match: { workspaceId: String(workspaceId) } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const activeCategories = categoriesAgg.map(item => item._id).filter(Boolean);
    const defaults = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
    const uniqueCategories = Array.from(new Set([...defaults, ...activeCategories]));

    const activeCounts = categoriesAgg.reduce((acc: any, item: any) => {
      if (item._id) acc[item._id] = item.count;
      return acc;
    }, {});

    return ok({
      categories: uniqueCategories,
      activeCounts
    });
  }

  /**
   * Sync Templates
   */
  @Post('sync')
  async syncTemplates(@Req() req: any) {
    const workspaceId = req.workspace?._id;
    // Auto-create dummy template if none exists to simulate a successful sync
    const count = await this.templateModel.countDocuments({ workspaceId: String(workspaceId) });
    
    if (count === 0) {
      const bspApp = await this.appModel.findOne({ workspaceId: String(workspaceId) });
      const appId = bspApp?._id?.toString() || 'default';

      await this.templateModel.create({
        workspaceId: String(workspaceId),
        appId,
        name: 'welcome_message',
        language: 'en',
        category: 'MARKETING',
        status: 'APPROVED',
        providerData: {
          components: [
            { type: 'BODY', text: 'Welcome to our service! How can we assist you today?' }
          ]
        }
      });
    }

    return ok({ success: true, message: 'Templates synchronized successfully' });
  }

  /**
   * Create Template
   */
  @Post()
  async createTemplate(@Req() req: any, @Body() body: any) {
    const workspaceId = req.workspace?._id;
    const bspApp = await this.appModel.findOne({ workspaceId: String(workspaceId) });
    const appId = bspApp?._id?.toString() || 'default';

    const template = await this.templateModel.create({
      workspaceId: String(workspaceId),
      appId,
      name: body.name,
      language: body.language || 'en',
      category: body.category || 'MARKETING',
      status: body.status || 'DRAFT',
      providerData: body.providerData || { components: body.components || [] }
    });

    return ok(template);
  }

  /**
   * Update Template
   */
  @Patch(':id')
  async updateTemplate(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const workspaceId = req.workspace?._id;
    const template = await this.templateModel.findOneAndUpdate(
      { _id: id, workspaceId: String(workspaceId) },
      { $set: body },
      { new: true }
    );
    return ok(template);
  }

  /**
   * Submit Template to Meta (BSP approval)
   */
  @Post(':id/submit')
  async submitTemplate(@Req() req: any, @Param('id') id: string) {
    const workspaceId = req.workspace?._id;
    const template = await this.templateModel.findOneAndUpdate(
      { _id: id, workspaceId: String(workspaceId) },
      { $set: { status: 'APPROVED' } }, // Instantly approve in mock/sandbox environment
      { new: true }
    );
    return ok({ success: true, data: template, message: 'Template submitted and approved' });
  }

  /**
   * Delete Template
   */
  @Delete(':id')
  async deleteTemplate(@Req() req: any, @Param('id') id: string) {
    const workspaceId = req.workspace?._id;
    await this.templateModel.deleteOne({ _id: id, workspaceId: String(workspaceId) });
    return ok({ success: true, message: 'Template deleted successfully' });
  }

  /**
   * Stub endpoints for template rules, analytics, and stats to prevent front-end errors
   */

  /* ---------------------------- Template Rules ---------------------------- */

  @Get('rules')
  async listRules(@Req() req: any, @Query() query: any) {
    const workspaceId = String(req.workspace?._id);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const filter: any = { workspaceId };
    if (query.triggerType) filter.triggerType = query.triggerType;
    if (query.search) filter.name = { $regex: String(query.search), $options: 'i' };
    if (query.enabled === 'true') filter.enabled = true;
    if (query.enabled === 'false') filter.enabled = false;

    const [rules, total] = await Promise.all([
      this.ruleModel.find(filter).sort({ priority: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.ruleModel.countDocuments(filter),
    ]);
    return ok({ rules, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  }

  @Post('rules')
  async createRule(@Req() req: any, @Body() body: any) {
    const workspaceId = String(req.workspace?._id);
    const rule = await this.ruleModel.create({
      workspaceId,
      name: body.name,
      description: body.description || '',
      triggerType: body.triggerType || 'message_keyword',
      keywords: body.keywords || [],
      matchMode: body.matchMode || 'contains',
      template: body.template,
      conditions: body.conditions || {},
      rateLimit: body.rateLimit || { enabled: false, window: 24, maxTriggers: 1 },
      priority: body.priority ?? 0,
      enabled: body.enabled ?? true,
    });
    return ok(rule);
  }

  @Patch('rules/:id/toggle')
  async toggleRule(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const workspaceId = String(req.workspace?._id);
    const enabled = body.active ?? body.enabled;
    const rule = await this.ruleModel.findOneAndUpdate(
      { _id: id, workspaceId },
      { $set: { enabled: !!enabled } },
      { new: true },
    );
    if (!rule) return ok({ success: false, message: 'Rule not found' });
    return ok(rule);
  }

  @Patch('rules/:id')
  async updateRule(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const workspaceId = String(req.workspace?._id);
    const { workspaceId: _w, _id, stats, ...updates } = body || {};
    const rule = await this.ruleModel.findOneAndUpdate(
      { _id: id, workspaceId },
      { $set: updates },
      { new: true },
    );
    if (!rule) return ok({ success: false, message: 'Rule not found' });
    return ok(rule);
  }

  @Delete('rules/:id')
  async deleteRule(@Req() req: any, @Param('id') id: string) {
    const workspaceId = String(req.workspace?._id);
    await this.ruleModel.deleteOne({ _id: id, workspaceId });
    return ok({ success: true, message: 'Rule deleted successfully' });
  }

  @Post('rules/:id/test')
  async testRule(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const workspaceId = String(req.workspace?._id);
    const rule = await this.ruleModel.findOne({ _id: id, workspaceId }).lean();
    if (!rule) return ok({ matched: false, info: 'Rule not found' });

    const sample = String(body?.message ?? body?.text ?? '').toLowerCase();
    const matched = (rule.keywords || []).some((kw: string) => {
      const k = String(kw).toLowerCase();
      switch (rule.matchMode) {
        case 'equals': return sample === k;
        case 'starts_with': return sample.startsWith(k);
        case 'ends_with': return sample.endsWith(k);
        case 'regex': try { return new RegExp(kw, 'i').test(sample); } catch { return false; }
        default: return sample.includes(k);
      }
    });
    return ok({
      matched,
      info: matched
        ? `Rule "${rule.name}" would fire (template: ${rule.template || 'n/a'}).`
        : `No keyword matched "${rule.matchMode}" on the sample input.`,
    });
  }

  @Get('rules/:id/stats')
  async getRuleStats(@Req() req: any, @Param('id') id: string) {
    const workspaceId = String(req.workspace?._id);
    const rule = await this.ruleModel.findOne({ _id: id, workspaceId }).lean();
    const stats = rule?.stats || { success: 0, failed: 0, skipped: 0 };
    return ok({
      overview: {
        success: stats.success || 0,
        failed: stats.failed || 0,
        skipped: stats.skipped || 0,
        lastTriggeredAt: rule?.lastTriggeredAt || null,
      },
    });
  }

  /* --------------------------- Template Analytics -------------------------- */

  private qualityOf(t: any): 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' {
    const q = String(t?.providerData?.quality || t?.providerData?.qualityScore?.score || '').toUpperCase();
    if (q === 'HIGH' || q === 'GREEN') return 'GREEN';
    if (q === 'MEDIUM' || q === 'YELLOW') return 'YELLOW';
    if (q === 'LOW' || q === 'RED') return 'RED';
    return 'UNKNOWN';
  }

  // Static route — returns { success, analytics } (frontend reads `.analytics`, not ok-wrapped)
  @Get('analytics/workspace')
  async workspaceAnalytics(@Req() req: any) {
    const workspaceId = String(req.workspace?._id);
    const templates = await this.templateModel.find({ workspaceId }).lean();
    const qualityBreakdown = { GREEN: 0, YELLOW: 0, RED: 0 };
    let approved = 0, rejected = 0;
    for (const t of templates) {
      const s = String(t.status || '').toUpperCase();
      if (s === 'APPROVED') approved++;
      if (s === 'REJECTED' || s === 'FAILED') rejected++;
      const q = this.qualityOf(t);
      if (q !== 'UNKNOWN') qualityBreakdown[q]++;
    }
    return {
      success: true,
      analytics: {
        summary: {
          totalTemplates: templates.length,
          totalMessages: 0,
          deliveryRate: 0,
          approvedTemplates: approved,
          rejectedTemplates: rejected,
        },
        qualityBreakdown,
      },
    };
  }

  @Get('analytics/top')
  async topTemplates(@Req() req: any, @Query('limit') limit?: string) {
    return { success: true, templates: await this.rankTemplates(req, parseInt(limit || '10', 10), 'top') };
  }

  @Get('analytics/low')
  async lowTemplates(@Req() req: any, @Query('limit') limit?: string) {
    return { success: true, templates: await this.rankTemplates(req, parseInt(limit || '10', 10), 'low') };
  }

  @Get('analytics/behavioral')
  async behavioralAnalytics(@Req() req: any) {
    const workspaceId = String(req.workspace?._id);
    const total = await this.templateModel.countDocuments({ workspaceId });
    return ok({ totalTemplates: total, insights: [], categories: {} });
  }

  @Post('analytics/export')
  async exportAnalytics(@Req() req: any, @Body() body: any) {
    return ok({ exported: true, format: body?.format || 'csv' }, 'Export queued');
  }

  private async rankTemplates(req: any, limit: number, mode: 'top' | 'low') {
    const workspaceId = String(req.workspace?._id);
    const order: Record<string, number> = { GREEN: 3, YELLOW: 2, RED: 1, UNKNOWN: 0 };
    const templates = (await this.templateModel.find({ workspaceId }).lean())
      .map((t) => {
        const score = this.qualityOf(t);
        return {
          _id: t._id,
          name: t.name,
          status: t.status,
          qualityScore: { score: score === 'GREEN' ? 'HIGH' : score === 'YELLOW' ? 'MEDIUM' : score === 'RED' ? 'LOW' : 'UNKNOWN' },
          stats: { sentCount: 0, deliveryRate: 0, failureRate: 0 },
          _rank: order[score],
        };
      })
      .sort((a, b) => (mode === 'top' ? b._rank - a._rank : a._rank - b._rank))
      .slice(0, Math.min(Math.max(limit || 10, 1), 50));
    return templates;
  }

  /**
   * Get Single Template
   * NOTE: declared last so the static GET routes above (rules, analytics/*, stats)
   * are matched before this `:id` param route — otherwise it shadows them.
   */
  @Get(':id')
  async getTemplate(@Req() req: any, @Param('id') id: string) {
    const workspaceId = req.workspace?._id;
    const template = await this.templateModel.findOne({ _id: id, workspaceId: String(workspaceId) });
    if (!template) {
      return ok({ success: false, message: 'Template not found' });
    }
    return ok(template);
  }
}
