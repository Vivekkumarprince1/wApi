import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProviderTemplateMirror } from '../../../models/provider-template-mirror.schema';
import { ProviderApp } from '../../../models/provider-app.schema';
import { GupshupClientService } from '../providers/gupshup/gupshup-client.service';

@Injectable()
export class TemplateSeedingService {
  constructor(
    @InjectModel(ProviderTemplateMirror.name) private readonly templateModel: Model<ProviderTemplateMirror>,
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    private readonly gupshup: GupshupClientService,
  ) {}

  private mapCategoryToVertical(category: string = ''): string {
    const c = category.toLowerCase();
    if (c.includes('retail') || c.includes('shop') || c.includes('e-comm') || c.includes('store')) return 'RETAIL';
    if (c.includes('food') || c.includes('hotel') || c.includes('restaurant') || c.includes('cafe')) return 'HOSPITALITY';
    if (c.includes('edu') || c.includes('school') || c.includes('college') || c.includes('learning') || c.includes('teach')) return 'EDTECH';
    if (c.includes('health') || c.includes('hospital') || c.includes('doctor') || c.includes('clinic')) return 'HEALTHCARE';
    if (c.includes('finance') || c.includes('bank') || c.includes('insurance') || c.includes('loan')) return 'BFSI';
    if (c.includes('real') || c.includes('property') || c.includes('estate') || c.includes('builder')) return 'REAL_ESTATE';
    
    return 'MARKETING'; // Default fallback
  }

  async seedBestPracticeTemplates(workspaceId: string) {
    const mainDb = this.appModel.db.useDb('connectsphere');
    
    let workspace: any = null;
    try {
      workspace = await mainDb.collection('workspaces').findOne({ _id: new Types.ObjectId(workspaceId) });
    } catch (err: any) {
      console.warn(`[TemplateSeeding] Failed to fetch workspace details:`, err.message);
      return;
    }
    
    const gupshupAppId = workspace?.gupshupAppId || workspace?.gupshupIdentity?.partnerAppId;
    if (!workspace || !gupshupAppId) {
      console.log(`[TemplateSeeding] Workspace ${workspaceId} not found or gupshupAppId missing.`);
      return;
    }

    // Skip if templates already exist to be idempotent
    const existingCount = await this.templateModel.countDocuments({ workspaceId, appId: gupshupAppId });
    if (existingCount >= 5) {
      console.log(`[TemplateSeeding] Workspace ${workspaceId} already has ${existingCount} templates. Skipping seeds.`);
      return;
    }

    let business: any = null;
    try {
      business = await mainDb.collection('businesses').findOne({ workspaceId: new Types.ObjectId(workspaceId) })
        || await mainDb.collection('businesses').findOne({ workspace: new Types.ObjectId(workspaceId) });
    } catch (err: any) {
      console.warn(`[TemplateSeeding] Failed to fetch business details:`, err.message);
    }
    
    const vertical = this.mapCategoryToVertical(business?.category);
    
    console.log(`[TemplateSeeding] Seeding templates for ${workspace.name || workspaceId} (Vertical: ${vertical})...`);

    if (!gupshupAppId.startsWith('mock_')) {
      try {
        const libraryTemplates = await this.gupshup.getMetaLibraryTemplates(gupshupAppId, vertical);
        
        if (!libraryTemplates || libraryTemplates.length === 0) {
          console.warn(`[TemplateSeeding] No templates found in library for vertical: ${vertical}`);
        } else {
          // Pick top 5-7 templates from the library
          const templatesToClone = libraryTemplates.slice(0, 7);

          for (const libTemplate of templatesToClone) {
            try {
              const payload = {
                elementName: libTemplate.elementName,
                languageCode: libTemplate.languageCode || 'en_US',
                category: libTemplate.category || 'UTILITY',
                components: libTemplate.components || []
              };

              const result = await this.gupshup.cloneMetaLibraryTemplate(gupshupAppId, payload);
              
              if (result?.status === 'success' || result?.data?.id) {
                 console.log(`[TemplateSeeding] Successfully cloned library template: ${libTemplate.elementName}`);
              }
            } catch (cloneErr: any) {
              console.error(`[TemplateSeeding] Failed to clone ${libTemplate.elementName}:`, cloneErr.message);
            }
          }
        }

        // Set default business profile on Gupshup
        console.log(`[TemplateSeeding] Setting default business profile...`);
        let ownerEmail: string | undefined = undefined;
        if (workspace.owner) {
          try {
            const owner = await mainDb.collection('users').findOne({ _id: new Types.ObjectId(workspace.owner) });
            ownerEmail = owner?.email || owner?.username || owner?.emailAddress;
          } catch (err: any) {
            console.warn(`[TemplateSeeding] Failed to fetch owner email:`, err.message);
          }
        }

        const profilePayload = {
          description: workspace.description || 'WhatsApp Business Account',
          address: business?.address?.line1 || workspace.address || 'India',
          email: business?.email || ownerEmail,
          websites: workspace.website ? [workspace.website] : []
        };
        
        await this.gupshup.updateBusinessProfile(gupshupAppId, profilePayload).catch(err => {
          console.warn(`[TemplateSeeding] Profile update failed: ${err.message}`);
        });

      } catch (err: any) {
        console.error(`[TemplateSeeding] Meta library seeding failed for ${workspaceId}:`, err.message);
      }
    } else {
      console.log(`[TemplateSeeding] Skipping Gupshup calls for ${gupshupAppId} (Mock App)`);
      // For mock/sandbox mode, we can seed a few mock templates locally in the bsp_template_mirrors collection
      // to make testing easier. Let's seed 5 mock templates:
      try {
        const mockTemplates = [
          { name: 'hello_world', category: 'UTILITY', body: 'Hello {{1}}, welcome to {{2}}!' },
          { name: 'order_status', category: 'UTILITY', body: 'Your order {{1}} status is: {{2}}.' },
          { name: 'appointment_reminder', category: 'UTILITY', body: 'Reminder: You have an appointment on {{1}}.' },
          { name: 'feedback_request', category: 'MARKETING', body: 'How was your recent experience with {{1}}? Reply with feedback.' },
          { name: 'welcome_offer', category: 'MARKETING', body: 'Welcome to our store! Use code WELCOME10 for 10% off.' }
        ];

        for (const mt of mockTemplates) {
          const mirror = {
            workspaceId,
            provider: 'gupshup',
            appId: gupshupAppId,
            name: mt.name,
            language: 'en',
            status: 'APPROVED',
            category: mt.category,
            providerData: {
              raw: mt,
              bodyText: mt.body,
              components: [
                { type: 'BODY', text: mt.body }
              ],
            }
          };

          await this.templateModel.updateOne(
            { workspaceId, provider: 'gupshup', appId: gupshupAppId, name: mt.name, language: 'en' },
            { $set: mirror },
            { upsert: true }
          );
        }
        console.log(`[TemplateSeeding] Seeded mock templates for mock app ${gupshupAppId}`);
      } catch (mockErr: any) {
        console.error(`[TemplateSeeding] Mock seeding failed:`, mockErr.message);
      }
    }

    // Call templates synchronization to pull cloned/existing templates into our database
    await this.syncTemplates(workspaceId, gupshupAppId);

    // Mark template setup and onboarding as complete in workspaces collection
    try {
      await mainDb.collection('workspaces').updateOne(
        { _id: new Types.ObjectId(workspaceId) },
        {
          $set: {
            'onboarding.templateSetupCompleted': true,
            'onboarding.completed': true,
            'onboarding.completedAt': new Date(),
          }
        }
      );
      console.log(`[TemplateSeeding] Marked onboarding complete for workspace ${workspaceId}`);
    } catch (err: any) {
      console.error(`[TemplateSeeding] Failed to update onboarding completed status:`, err.message);
    }
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

  async syncTemplates(workspaceId: string, appId: string) {
    if (!appId || appId === 'default' || appId.startsWith('mock_')) {
      return;
    }

    console.log(`[TemplateSeedingService:sync] Syncing templates for workspace ${workspaceId} app ${appId}...`);
    try {
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
      console.log(`[TemplateSeedingService:sync] Synced ${providerTemplates.length} templates (Created: ${created}, Updated: ${updated}, Stale deleted: ${stale.deletedCount || 0})`);
    } catch (err: any) {
      console.warn(`[TemplateSeedingService:sync] Sync failed:`, err.message);
    }
  }
}
