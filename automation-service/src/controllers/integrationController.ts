import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Integration } from '../models';
import { GoogleSheetsService } from '../services/integrations/google-sheets-service';
import { PetpoojaService } from '../services/integrations/petpooja-service';
import mongoose from 'mongoose';

export const integrationController = {
  /**
   * List all integrations
   */
  async listIntegrations(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integrations = await (Integration as any).find({ workspace: workspaceId }).select('+config');
      res.json({ success: true, integrations });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Connect/create integration
   */
  async connect(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const type = req.params.type || req.body.type;
      const { config, isActive } = req.body;
      
      let integration = await (Integration as any).findOne({ workspace: workspaceId, type }).select('+config');
      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type,
          name: type === 'google_sheets' ? 'Google Sheets' : type === 'petpooja' ? 'Petpooja POS' : type,
          status: 'connected',
          createdBy: req.user?._id || req.user?.id
        });
      }

      if (config) {
        (integration as any).setEncryptedConfig(config);
      }
      integration.status = 'connected';
      integration.updatedBy = req.user?._id || req.user?.id;
      await integration.save();

      res.json({ success: true, integration });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Disconnect/remove integration
   */
  async disconnect(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const id = req.params.id as string;
      const query: any = { workspace: workspaceId, $or: [{ type: id }] };
      if (mongoose.Types.ObjectId.isValid(id)) {
        query.$or.push({ _id: id });
      }

      await (Integration as any).findOneAndDelete(query);
      res.json({ success: true, message: "Integration removed" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async syncIntegration(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const { type } = req.params;
      const integration = await (Integration as any).findOneAndUpdate(
        { workspace: workspaceId, type },
        { $set: { lastSyncAt: new Date(), status: 'connected' } },
        { new: true }
      );

      res.json({
        success: true,
        message: integration ? `${type} sync completed` : `${type} sync queued`,
        data: integration
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Google Sheets - List Spreadsheets
   */
  async listGoogleSpreadsheets(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({ 
        workspace: workspaceId, 
        type: 'google_sheets' 
      }).select('+config');

      if (!integration) return res.json({ files: [] });

      const files = await GoogleSheetsService.listSpreadsheets(integration);
      res.json({ files });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async getGoogleStatus(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'google_sheets'
      });

      res.json({
        connected: integration?.status === 'connected',
        status: integration?.status || 'disconnected',
        integration: integration ? ((integration as any).toSafeJSON ? (integration as any).toSafeJSON() : integration) : null
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async getGoogleConfig(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'google_sheets'
      }).select('+config');

      res.json({
        success: true,
        config: integration?.configMetadata || {},
        connected: integration?.status === 'connected'
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async saveGoogleConfig(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      let integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'google_sheets'
      }).select('+config');

      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type: 'google_sheets',
          name: 'Google Sheets',
          status: 'pending',
          createdBy: req.user?._id || req.user?.id
        });
        (integration as any).setEncryptedConfig({});
      }

      integration.configMetadata = { ...(integration.configMetadata || {}), ...(req.body || {}) };
      integration.updatedBy = req.user?._id || req.user?.id;
      await integration.save();

      res.json({ success: true, config: integration.configMetadata });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async listGoogleSheets(req: AuthRequest, res: Response) {
    try {
      res.json({ sheets: [] });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async listGoogleColumns(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const columns = await GoogleSheetsService.getColumns(
        workspaceId.toString(),
        req.params.id as string,
        (req.query.sheetName as string) || ''
      ).catch(() => []);


      res.json({ columns });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async googleCallback(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const { code, state } = req.query;
      if (!code) return res.status(400).json({ message: 'Missing Google authorization code' });

      let integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'google_sheets'
      }).select('+config');

      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type: 'google_sheets',
          name: 'Google Sheets',
          createdBy: req.user?._id || req.user?.id
        });
      }

      integration.status = 'connected';
      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        connectedAt: new Date(),
        oauthState: typeof state === 'string' ? state : undefined
      };
      (integration as any).setEncryptedConfig({ code, connectedAt: new Date().toISOString() });
      await integration.save();

      res.redirect('/integrations?google=connected');
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Google Auth URL
   */
  async getGoogleAuthUrl(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const appOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const redirectUri = `${appOrigin}/api/v1/integrations/google/callback`;
      const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64url');
      const scope = encodeURIComponent('https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly');
      
      const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Petpooja Connect
   */
  async connectPetpooja(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const { vendorId, apiKey } = req.body;
      if (!vendorId || !apiKey) return res.status(400).json({ message: 'Vendor ID and API Key are required' });

      const isValid = await PetpoojaService.validateCredentials(vendorId, apiKey);
      if (!isValid) return res.status(400).json({ message: 'Invalid Petpooja credentials' });

      let integration = await (Integration as any).findOne({ 
        workspace: workspaceId, 
        type: 'petpooja' 
      });

      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type: 'petpooja',
          name: 'Petpooja POS'
        });
      }

      (integration as any).setEncryptedConfig({ vendorId, apiKey });
      integration.status = 'connected';
      integration.createdBy = req.user?._id || req.user?.id;
      await integration.save();

      res.json({ message: 'Petpooja connected successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
};
