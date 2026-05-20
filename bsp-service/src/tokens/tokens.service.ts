import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BspToken } from '../models/bsp-token.schema';
import { GupshupClientService } from '../gupshup/gupshup-client.service';

@Injectable()
export class TokensService {
  constructor(
    @InjectModel(BspToken.name) private readonly tokenModel: Model<BspToken>,
    private readonly gupshup: GupshupClientService,
  ) {}

  async refreshAppToken(appId: string, workspaceId = 'system') {
    const result = await this.gupshup.refreshAppToken(appId);
    return this.tokenModel.findOneAndUpdate(
      { workspaceId, provider: 'gupshup', tokenType: 'app', appId },
      {
        $set: {
          workspaceId,
          provider: 'gupshup',
          tokenType: 'app',
          appId,
          token: result.token,
          expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
          status: 'active',
        },
      },
      { upsert: true, new: true },
    );
  }
}
