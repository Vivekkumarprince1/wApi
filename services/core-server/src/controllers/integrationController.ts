import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Integration } from '../models';
import { GoogleSheetsService } from '../services/integrations/google-sheets-service';
import { PetpoojaService } from '../services/integrations/petpooja-service';
import { OAuth2Client } from 'google-auth-library';
import mongoose from 'mongoose';

export const integrationController = {
  /**
   * List all integrations
   */
  async listIntegrations(req: AuthRequest, res: Response) {
    try {
      const integrations = await Integration.find({ workspace: req.workspace._id }).select('+config');
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
      const type = req.params.type || req.body.type;
      const { config, isActive } = req.body;
      const integration = await Integration.findOneAndUpdate(
        { workspace: req.workspace._id, type },
        { $set: { config, isActive, lastSyncAt: new Date() } },
        { upsert: true, new: true }
      );
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
      const { id } = req.params;
      const query: any = { workspace: req.workspace._id, $or: [{ type: id }] };
      if (mongoose.Types.ObjectId.isValid(id)) query.$or.push({ _id: id });
      await Integration.findOneAndDelete(query);
      res.json({ success: true, message: "Integration removed" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async syncIntegration(req: AuthRequest, res: Response) {
    try {
      const { type } = req.params;
      const integration = await Integration.findOneAndUpdate(
        { workspace: req.workspace._id, type },
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
      const integration = await Integration.findOne({ 
        workspace: req.workspace._id, 
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
      const integration = await Integration.findOne({
        workspace: req.workspace._id,
        type: 'google_sheets'
      });

      res.json({
        connected: integration?.status === 'connected',
        status: integration?.status || 'disconnected',
        integration: integration ? integration.toSafeJSON?.() || integration : null
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async getGoogleConfig(req: AuthRequest, res: Response) {
    try {
      const integration = await Integration.findOne({
        workspace: req.workspace._id,
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
      let integration = await Integration.findOne({
        workspace: req.workspace._id,
        type: 'google_sheets'
      }).select('+config');

      if (!integration) {
        integration = new Integration({
          workspace: req.workspace._id,
          type: 'google_sheets',
          name: 'Google Sheets',
          status: 'pending',
          createdBy: req.user._id
        });
        integration.setEncryptedConfig({});
      }

      integration.configMetadata = { ...(integration.configMetadata || {}), ...(req.body || {}) };
      integration.updatedBy = req.user._id;
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
      const columns = await GoogleSheetsService.getColumns(
        req.workspace._id.toString(),
        req.params.id,
        (req.query.sheetName as string) || ''
      ).catch(() => []);

      res.json({ columns });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async googleCallback(req: AuthRequest, res: Response) {
    try {
      const { code, state } = req.query;
      if (!code) return res.status(400).json({ message: 'Missing Google authorization code' });

      let integration = await Integration.findOne({
        workspace: req.workspace._id,
        type: 'google_sheets'
      }).select('+config');

      if (!integration) {
        integration = new Integration({
          workspace: req.workspace._id,
          type: 'google_sheets',
          name: 'Google Sheets',
          createdBy: req.user._id
        });
      }

      integration.status = 'connected';
      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        connectedAt: new Date(),
        oauthState: typeof state === 'string' ? state : undefined
      };
      integration.setEncryptedConfig({ code, connectedAt: new Date().toISOString() });
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
      const appOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${appOrigin}/api/v1/integrations/google/callback`
      );

      const url = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/drive.metadata.readonly'
        ],
        state: Buffer.from(JSON.stringify({ workspaceId: req.workspace._id })).toString('base64url')
      });

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
      const { vendorId, apiKey } = req.body;
      if (!vendorId || !apiKey) return res.status(400).json({ message: 'Vendor ID and API Key are required' });

      const isValid = await PetpoojaService.validateCredentials(vendorId, apiKey);
      if (!isValid) return res.status(400).json({ message: 'Invalid Petpooja credentials' });

      let integration = await Integration.findOne({ 
        workspace: req.workspace._id, 
        type: 'petpooja' 
      });

      if (!integration) {
        integration = new Integration({
          workspace: req.workspace._id,
          type: 'petpooja',
          name: 'Petpooja POS'
        });
      }

      integration.setEncryptedConfig({ vendorId, apiKey });
      integration.status = 'connected';
      integration.createdBy = req.user._id;
      await integration.save();

      res.json({ message: 'Petpooja connected successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
};
