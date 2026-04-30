import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WhatsAppForm } from '../models/WhatsAppForm';
import { WhatsAppFormResponse } from '../models/WhatsAppFormResponse';

export const syncForm = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const workspaceId = req.workspace?.id;

        const form = await WhatsAppForm.findOne({
            _id: id,
            workspace: workspaceId,
            deletedAt: null,
        });

        if (!form) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }

        res.json({
            success: true,
            message: 'Form sync completed',
            data: { formId: form._id, syncedAt: new Date().toISOString() },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getForms = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const { status, search } = req.query;

    const query: any = {
      workspace: workspaceId,
      deletedAt: null,
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.name = { $regex: search as string, $options: 'i' };
    }

    const forms = await WhatsAppForm.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: forms,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getFormById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;

    const form = await WhatsAppForm.findOne({
      _id: id,
      workspace: workspaceId,
      deletedAt: null,
    }).lean();

    if (!form) {
      return res.status(404).json({ success: false, error: 'Form not found' });
    }

    res.json({ success: true, data: form });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createForm = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const userId = req.user?.id;
    const body = req.body;

    if (!body?.name?.trim()) {
      return res.status(400).json({ success: false, error: 'Form name is required' });
    }

    const form = await WhatsAppForm.create({
      workspace: workspaceId,
      name: body.name,
      description: body.description || '',
      status: 'draft',
      flowType: body.flowType || 'static',
      flowId: body.flowId || body?.rawFlowJson?.flow_id || body?.rawFlowJson?.flowId,
      screens: Array.isArray(body.screens) ? body.screens : [],
      rawFlowJson: body.rawFlowJson || null,
      dataMapping: Array.isArray(body.dataMapping) ? body.dataMapping : [],
      webhookConfig: {
        enabled: body?.webhookConfig?.enabled ?? false,
        url: body?.webhookConfig?.url || undefined,
        method: body?.webhookConfig?.method || 'POST',
        headers: body?.webhookConfig?.headers || {},
      },
      config: {
        fallbackMessage: body?.config?.fallbackMessage || 'Please update your WhatsApp to use interactive forms.',
        sendConfirmationMessage: body?.config?.sendConfirmationMessage ?? true,
        confirmationText: body?.config?.confirmationText || '',
      },
      tags: Array.isArray(body.tags) ? body.tags : [],
      category: body.category || '',
      createdBy: userId,
    });

    res.status(201).json({ success: true, data: form });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateForm = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const userId = req.user?.id;
    const updates = req.body;

    const current = await WhatsAppForm.findOne({
      _id: id,
      workspace: workspaceId,
      deletedAt: null,
    });

    if (!current) {
      return res.status(404).json({ success: false, error: 'Form not found' });
    }

    if (current.status === 'published') {
      return res.status(400).json({ success: false, error: 'Published forms cannot be edited. Unpublish first.' });
    }

    const updated = await WhatsAppForm.findOneAndUpdate(
      { _id: id, workspace: workspaceId, deletedAt: null },
      {
        $set: {
          name: updates.name ?? current.name,
          description: updates.description ?? current.description,
          flowType: updates.flowType ?? current.flowType,
          flowId: updates.flowId ?? current.flowId,
          screens: Array.isArray(updates.screens) ? updates.screens : current.screens,
          rawFlowJson: updates.rawFlowJson ?? current.rawFlowJson,
          dataMapping: Array.isArray(updates.dataMapping) ? updates.dataMapping : current.dataMapping,
          webhookConfig: updates.webhookConfig
            ? { ...current.webhookConfig, ...updates.webhookConfig }
            : current.webhookConfig,
          config: updates.config ? { ...current.config, ...updates.config } : current.config,
          tags: Array.isArray(updates.tags) ? updates.tags : current.tags,
          category: updates.category ?? current.category,
          updatedBy: userId,
        },
      },
      { returnDocument: 'after' }
    );

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteForm = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;

    const form = await WhatsAppForm.findOneAndUpdate(
      { _id: id, workspace: workspaceId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!form) {
      return res.status(404).json({ success: false, error: 'Form not found' });
    }

    res.json({ success: true, message: 'Form deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const publishForm = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const workspaceId = req.workspace?.id;
        const userId = req.user?.id;

        const existing = await WhatsAppForm.findOne({
            _id: id,
            workspace: workspaceId,
            deletedAt: null,
        });

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }

        const hasScreens = Array.isArray(existing.screens) && existing.screens.length > 0;
        const hasRawPayload = !!existing.rawFlowJson;
        if (!hasScreens && !hasRawPayload) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot publish an empty form. Add screens or flow JSON first.' 
            });
        }

        const resolvedFlowId =
            existing.flowId ||
            existing.rawFlowJson?.flow_id ||
            existing.rawFlowJson?.flowId ||
            `${existing._id}`;

        const form = await WhatsAppForm.findOneAndUpdate(
            { _id: id, workspace: workspaceId, deletedAt: null },
            { 
                $set: { 
                    status: 'published', 
                    publishedAt: new Date(), 
                    publishedBy: userId,
                    flowId: resolvedFlowId
                } 
            },
            { returnDocument: 'after' }
        );

        res.json({ success: true, data: form, message: 'Form published' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const unpublishForm = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const workspaceId = req.workspace?.id;

        const form = await WhatsAppForm.findOneAndUpdate(
            { _id: id, workspace: workspaceId, deletedAt: null },
            { $set: { status: 'draft' } },
            { returnDocument: 'after' }
        );

        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        res.json({ success: true, data: form });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getResponses = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const workspaceId = req.workspace?.id;
        const { status, format } = req.query;

        const form = await WhatsAppForm.findOne({
            _id: id,
            workspace: workspaceId,
            deletedAt: null,
        }).lean();

        if (!form) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }

        const query: any = { form: id, workspace: workspaceId };
        if (status && status !== 'all') {
            query.status = status;
        }

        const responses = await WhatsAppFormResponse.find(query)
            .sort({ createdAt: -1 })
            .lean();

        if (format === 'csv') {
            const dynamicKeys = new Set<string>();
            responses.forEach((response: any) => {
                const entries = response?.responses ? Array.from(Object.entries(response.responses)) : [];
                entries.forEach(([key]) => dynamicKeys.add(String(key)));
            });

            const orderedDynamicKeys = Array.from(dynamicKeys).sort();
            const headers = [
                'phone',
                'name',
                'status',
                'startedAt',
                'completedAt',
                'timeSpent',
                ...orderedDynamicKeys,
            ];

            const escapeCsv = (value: any) => {
                const raw = value == null ? '' : String(value);
                const needsQuotes = raw.includes(',') || raw.includes('"') || raw.includes('\n');
                const escaped = raw.replace(/"/g, '""');
                return needsQuotes ? `"${escaped}"` : escaped;
            };

            const lines = [headers.join(',')];

            responses.forEach((response: any) => {
                const responsesObj = response?.responses instanceof Map 
                    ? Object.fromEntries(response.responses)
                    : (response?.responses || {});
                
                const valuesMap = new Map<string, any>(Object.entries(responsesObj));
                const row = [
                    response.userPhone || '',
                    response.userName || '',
                    response.status || '',
                    response.startedAt ? new Date(response.startedAt).toISOString() : '',
                    response.completedAt ? new Date(response.completedAt).toISOString() : '',
                    response.timeSpent ?? '',
                    ...orderedDynamicKeys.map((key) => valuesMap.get(key) ?? ''),
                ];

                lines.push(row.map(escapeCsv).join(','));
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${form.name.replace(/[^a-z0-9-_]/gi, '_')}-responses.csv"`);
            return res.send(lines.join('\n'));
        }

        res.json({
            success: true,
            data: {
                form,
                responses,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
