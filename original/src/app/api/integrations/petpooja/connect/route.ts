import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Integration } from '@/lib/models/integration/Integration';
import { PetpoojaService } from '@/lib/services/integrations/petpooja-service';

export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json();
    const { vendorId, apiKey } = body;

    if (!vendorId || !apiKey) {
      return NextResponse.json({ message: 'Vendor ID and API Key are required' }, { status: 400 });
    }

    // Validate with Petpooja
    const isValid = await PetpoojaService.validateCredentials(vendorId, apiKey);
    if (!isValid) {
      return NextResponse.json({ message: 'Invalid Petpooja credentials' }, { status: 400 });
    }

    // Upsert integration
    let integration = await Integration.findOne({ 
      workspace: user.workspace, 
      type: 'petpooja' 
    });

    if (!integration) {
      integration = new Integration({
        workspace: user.workspace,
        type: 'petpooja',
        name: 'Petpooja POS'
      });
    }

    integration.setEncryptedConfig({ vendorId, apiKey });
    integration.status = 'connected';
    integration.createdBy = user._id;
    await integration.save();

    return NextResponse.json({ message: 'Petpooja connected successfully' });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
});
