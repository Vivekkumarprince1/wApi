import { Business, Workspace, Template } from '@/lib/models';
import { GupshupPartnerService } from '@/lib/services/bsp/gupshup-partner-service';

export class TemplateSeedingService {
  /**
   * Maps internal business category to Gupshup Meta Library vertical.
   */
  private static mapCategoryToVertical(category: string = ''): string {
    const c = category.toLowerCase();
    if (c.includes('retail') || c.includes('shop') || c.includes('e-comm') || c.includes('store')) return 'RETAIL';
    if (c.includes('food') || c.includes('hotel') || c.includes('restaurant') || c.includes('cafe')) return 'HOSPITALITY';
    if (c.includes('edu') || c.includes('school') || c.includes('college') || c.includes('learning') || c.includes('teach')) return 'EDTECH';
    if (c.includes('health') || c.includes('hospital') || c.includes('doctor') || c.includes('clinic')) return 'HEALTHCARE';
    if (c.includes('finance') || c.includes('bank') || c.includes('insurance') || c.includes('loan')) return 'BFSI';
    if (c.includes('real') || c.includes('property') || c.includes('estate') || c.includes('builder')) return 'REAL_ESTATE';
    
    return 'MARKETING'; // Default fallback
  }

  /**
   * Automatically seeds 5+ templates for a new workspace.
   */
  static async seedBestPracticeTemplates(workspaceId: string) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !workspace.gupshupAppId) return;

    // Skip if templates already exist to be idempotent
    const existingCount = await Template.countDocuments({ workspace: workspaceId });
    if (existingCount >= 5) {
      console.log(`[TemplateSeeding] Workspace ${workspaceId} already has ${existingCount} templates. Skipping seeds.`);
      return;
    }

    const business = await Business.findOne({ workspace: workspaceId });
    const vertical = this.mapCategoryToVertical(business?.category);
    
    console.log(`[TemplateSeeding] Seeding templates for ${workspace.name} (Vertical: ${vertical})...`);

    try {
      const libraryTemplates = await GupshupPartnerService.getMetaLibraryTemplates(workspace.gupshupAppId, vertical);
      
      if (!libraryTemplates || libraryTemplates.length === 0) {
        console.warn(`[TemplateSeeding] No templates found in library for vertical: ${vertical}`);
        return;
      }

      // Pick top 5-7 templates from the library
      const templatesToClone = libraryTemplates.slice(0, 7);
      const businessName = business?.name || workspace.name || 'Our Store';

      for (const libTemplate of templatesToClone) {
        try {
          // 1. Prepare components for cloning
          // We can inject the business name into the variables if the text allows it, 
          // but library templates usually have their own standard body.
          const payload = {
            elementName: libTemplate.elementName,
            languageCode: libTemplate.languageCode || 'en_US',
            category: libTemplate.category || 'UTILITY',
            components: libTemplate.components || []
          };

          // 2. Clone using Gupshup API
          const result = await GupshupPartnerService.cloneMetaLibraryTemplate(workspace.gupshupAppId, payload);
          
          if (result?.status === 'success' || result?.data?.id) {
             console.log(`[TemplateSeeding] Successfully cloned library template: ${libTemplate.elementName}`);
          }
        } catch (cloneErr: any) {
          console.error(`[TemplateSeeding] Failed to clone ${libTemplate.elementName}:`, cloneErr.message);
        }
      }

      // Final synchronization to bring the new templates into our database
      // await wabaService.syncTemplates(workspaceId); 
      // (This will happen automatically via Step 8.1 in PostOnboardingService)

    } catch (err: any) {
      console.error(`[TemplateSeeding] Orchestration failed for ${workspaceId}:`, err.message);
    }
  }
}
