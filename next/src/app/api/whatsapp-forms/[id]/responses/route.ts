import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { WhatsAppForm, WhatsAppFormResponse } from '@/lib/models';

export const GET = withAuth(async (req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const format = searchParams.get('format');

    const form = await WhatsAppForm.findOne({
      _id: params.id,
      workspace: workspace._id,
      deletedAt: null,
    }).lean();

    if (!form) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    const query: any = { form: form._id, workspace: workspace._id };
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
        const valuesMap = new Map<string, any>(Object.entries(response?.responses || {}));
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

      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${form.name.replace(/[^a-z0-9-_]/gi, '_')}-responses.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        form,
        responses,
      },
    });
  } catch (error: any) {
    console.error('API Error [WhatsApp Form/RESPONSES]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
