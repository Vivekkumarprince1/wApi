import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Provider } from '../../../models/provider.schema';
import { GupshupClientService } from '../providers/gupshup/gupshup-client.service';

@Injectable()
export class ProviderActionsService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    private readonly gupshup: GupshupClientService,
  ) {}

  // ── Provider registry (bsp_providers) ──────────────────────────────────────

  async list() {
    return this.providerModel.find().sort({ code: 1 }).lean();
  }

  async get(code: string) {
    const provider = await this.providerModel.findOne({ code }).lean();
    if (!provider) throw new NotFoundException(`Provider '${code}' not found`);
    return provider;
  }

  async upsert(input: { code: string; name: string; active?: boolean; config?: Record<string, unknown> }) {
    return this.providerModel.findOneAndUpdate(
      { code: input.code },
      {
        $set: {
          code: input.code,
          name: input.name,
          active: input.active ?? true,
          config: input.config || {},
        },
      },
      { new: true, upsert: true },
    ).lean();
  }

  // ── Provider actions (delegated to the Gupshup client) ─────────────────────

  async execute(input: { appId?: string; action: string; payload?: Record<string, unknown> }) {
    return this.gupshup.providerAction({
      appId: input.appId,
      action: input.action,
      payload: input.payload || {},
    });
  }
}
