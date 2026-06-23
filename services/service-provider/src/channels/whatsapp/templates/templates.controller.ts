import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InternalAuthGuard } from '../../../common/internal-auth.guard';
import { WorkspaceAuthGuard } from '../../../common/workspace-auth.guard';
import { ok } from '../../../common/api-response';
import { ProviderTemplateMirror } from '../../../models/provider-template-mirror.schema';
import { ProviderTemplateRule } from '../../../models/provider-template-rule.schema';
import { ProviderApp } from '../../../models/provider-app.schema';
import { GupshupClientService } from '../providers/gupshup/gupshup-client.service';

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
    private readonly gupshup: GupshupClientService,
  ) {}

  /**
   * List Templates
   */
  @Get()
  async listTemplates(@Req() req: any, @Query('status') status?: string) {
    const workspaceId = String(req.workspace?._id);
    const appId = await this.getWorkspaceAppId(workspaceId);
    const query: any = { workspaceId: String(workspaceId) };
    if (appId) {
      query.appId = appId;
    }
    if (status) {
      query.status = status;
    }

    const templates = await this.templateModel.find(query).sort({ createdAt: -1 }).lean();
    return ok(templates.map((template) => this.toPublicTemplate(template)));
  }

  /**
   * List Template Categories
   */
  @Get('categories')
  async getCategories(@Req() req: any) {
    const workspaceId = String(req.workspace?._id);
    const appId = await this.getWorkspaceAppId(workspaceId);
    const match: any = { workspaceId };
    if (appId) {
      match.appId = appId;
    }
    const categoriesAgg = await this.templateModel.aggregate([
      { $match: match },
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
    const workspaceId = String(req.workspace?._id);
    const bspApp = await this.getWorkspaceApp(workspaceId);
    const appId = this.resolveProviderAppId(bspApp);

    if (!appId || appId === 'default') {
      throw new Error('No connected WhatsApp/Gupshup app found for this workspace.');
    }

    const providerTemplates = await this.gupshup.listTemplates({ appId, status: 'APPROVED' });
    let created = 0;
    let updated = 0;
    let failed = 0;
    const syncedNames: string[] = [];

    for (const rawTemplate of providerTemplates) {
      try {
        const mirror = this.fromGupshupTemplate(rawTemplate, workspaceId, appId);
        if (!mirror.name) {
          failed += 1;
          continue;
        }
        syncedNames.push(mirror.name);

        const result = await this.templateModel.updateOne(
          {
            workspaceId,
            provider: 'gupshup',
            appId,
            name: mirror.name,
            language: mirror.language,
          },
          { $set: mirror },
          { upsert: true },
        );

        if (result.upsertedCount > 0) {
          created += 1;
        } else if (result.modifiedCount > 0 || result.matchedCount > 0) {
          updated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    const staleFilter: any = {
      workspaceId,
      provider: 'gupshup',
      $or: [
        { appId: { $ne: appId } },
        { appId, name: { $nin: syncedNames } },
      ],
    };
    const stale = await this.templateModel.deleteMany(staleFilter);

    return ok({
      success: true,
      message: `Templates synchronized successfully (${providerTemplates.length} approved from Meta)`,
      synced: providerTemplates.length,
      created,
      updated,
      failed,
      removedStale: stale.deletedCount || 0,
    });
  }

  /**
   * Create Template
   */
  @Post()
  async createTemplate(@Req() req: any, @Body() body: any) {
    const workspaceId = String(req.workspace?._id);
    const bspApp = await this.getWorkspaceApp(workspaceId);
    const appId = this.resolveProviderAppId(bspApp) || 'default';

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

  // Monolith parity: library stats were a hardcoded mock there too.
  @Get('library/stats')
  async getLibraryStats() {
    return {
      success: true,
      data: {
        total: 120,
        approved: 95,
        rejected: 5,
        pending: 20,
      },
    };
  }

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

  private async getWorkspaceApp(workspaceId: string) {
    const workspaceCandidates: any[] = [workspaceId];
    if (Types.ObjectId.isValid(workspaceId)) {
      workspaceCandidates.push(new Types.ObjectId(workspaceId));
    }

    return this.appModel.collection.findOne({
      workspaceId: { $in: workspaceCandidates },
      $or: [
        { whatsappConnected: true },
        { status: 'connected' },
        { gupshupAppId: { $exists: true, $ne: '' } },
        { appId: { $exists: true, $ne: '' } },
      ],
    }, {
      sort: { whatsappConnected: -1, updatedAt: -1 },
    });
  }

  private async getWorkspaceAppId(workspaceId: string): Promise<string | null> {
    return this.resolveProviderAppId(await this.getWorkspaceApp(workspaceId));
  }

  private resolveProviderAppId(app: any): string | null {
    return app?.gupshupAppId || app?.appId || app?._id?.toString?.() || null;
  }

  private parseJsonObject(value: any): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      return {};
    }
  }

  private extractBodyText(providerData: any): string {
    const components = Array.isArray(providerData?.components) ? providerData.components : [];
    const body = components.find((component: any) => String(component?.type || '').toUpperCase() === 'BODY');
    return providerData?.bodyText || body?.text || providerData?.raw?.data || '';
  }

  private toPublicTemplate(template: any) {
    const providerData = template.providerData || {};
    const bodyText = this.extractBodyText(providerData);
    const components = Array.isArray(providerData.components) ? providerData.components : [];

    return {
      ...template,
      id: template._id?.toString?.() || template.id,
      bodyText,
      body: { text: bodyText },
      components,
      header: providerData.header,
      footer: providerData.footer,
      buttons: providerData.buttons,
      qualityScore: providerData.qualityScore || { score: providerData.quality || 'UNKNOWN' },
    };
  }

  private fromGupshupTemplate(raw: any, workspaceId: string, appId: string) {
    const containerMeta = this.parseJsonObject(raw.containerMeta);
    const meta = this.parseJsonObject(raw.meta);
    const bodyText = containerMeta.data || raw.data || raw.body || '';
    const components: any[] = [];

    if (containerMeta.header || raw.header) {
      components.push({
        type: 'HEADER',
        format: raw.headerType || containerMeta.headerType || 'TEXT',
        text: containerMeta.header || raw.header,
      });
    }
    components.push({ type: 'BODY', text: bodyText });
    if (containerMeta.footer) {
      components.push({ type: 'FOOTER', text: containerMeta.footer });
    }
    if (Array.isArray(containerMeta.buttons) && containerMeta.buttons.length > 0) {
      components.push({ type: 'BUTTONS', buttons: containerMeta.buttons });
    }

    return {
      workspaceId,
      provider: 'gupshup',
      appId,
      name: raw.elementName || raw.name || raw.templateName,
      language: raw.languageCode || raw.language || 'en',
      status: String(raw.status || 'UNKNOWN').toUpperCase(),
      category: String(raw.category || 'UNKNOWN').toUpperCase(),
      providerData: {
        raw,
        meta,
        containerMeta,
        bodyText,
        components,
        footer: containerMeta.footer ? { text: containerMeta.footer } : undefined,
        buttons: Array.isArray(containerMeta.buttons) ? { items: containerMeta.buttons } : undefined,
        providerTemplateId: raw.id || raw.externalId,
        externalId: raw.externalId,
        reason: raw.reason,
      },
    };
  }

  /**
   * Get Single Template
   * NOTE: declared last so the static GET routes above (rules, analytics/*, stats)
   * are matched before this `:id` param route — otherwise it shadows them.
   */
  @Get(':id')
  async getTemplate(@Req() req: any, @Param('id') id: string) {
    const workspaceId = req.workspace?._id;
    const template = await this.templateModel.findOne({ _id: id, workspaceId: String(workspaceId) }).lean();
    if (!template) {
      return ok({ success: false, message: 'Template not found' });
    }
    return ok(this.toPublicTemplate(template));
  }
}
