import mongoose from 'mongoose';
import { GupshupPartnerService } from './src/lib/services/bsp/gupshup-partner-service';
import dbConnect from './src/lib/db-connect';

async function main() {
  await dbConnect();
  // Find a workspace with a gupshupAppId
  const Workspace = mongoose.model('Workspace');
  const ws = await Workspace.findOne({ gupshupAppId: { $exists: true, $ne: null } });
  if (!ws) {
    console.log("No workspace found with gupshupAppId");
    return;
  }
  const appId = ws.gupshupAppId;
  console.log("Using appId:", appId);
  
  const templates = await GupshupPartnerService.getMetaLibraryTemplates(appId);
  console.log("Got", templates?.length, "templates");
  if (templates && templates.length > 0) {
    console.log("First template structure:", JSON.stringify(templates[0], null, 2));
  }
  process.exit(0);
}
main().catch(console.error);
