import { Request, Response, NextFunction } from 'express';
import { Workspace } from '../models';

export interface ExternalApiRequest extends Request {
  workspace?: {
    id: string;
    _id: string;
  };
  developerApiKey?: {
    id?: string;
    name?: string;
  };
}

function apiKeyFrom(req: Request) {
  const headerKey = req.header('x-api-key');
  if (headerKey) return headerKey.trim();

  const auth = req.header('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return '';
}

export async function authenticateExternalApiKey(req: ExternalApiRequest, res: Response, next: NextFunction) {
  try {
    const key = apiKeyFrom(req);
    if (!key) {
      return res.status(401).json({
        success: false,
        message: 'Missing API key. Send it in the x-api-key header.',
      });
    }

    const workspace = await (Workspace as any)
      .findOneAndUpdate(
        { 'apiKeys.key': key, 'apiKeys.isActive': true },
        { $set: { 'apiKeys.$.lastUsedAt': new Date() } },
        { new: true }
      )
      .select('apiKeys name gupshupAppId bspPhoneNumberId')
      .lean();

    if (!workspace) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive API key.',
      });
    }

    const matchingKey = (workspace.apiKeys || []).find((item: any) => item.key === key);
    req.workspace = {
      id: workspace._id.toString(),
      _id: workspace._id.toString(),
    };
    req.developerApiKey = {
      id: matchingKey?._id?.toString?.(),
      name: matchingKey?.name,
    };

    next();
  } catch (err) {
    next(err);
  }
}
