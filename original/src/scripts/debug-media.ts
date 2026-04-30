import { WabaService } from "../lib/services/messaging/waba-service";
import dbConnect from '../lib/db-connect';
import { Workspace } from '../lib/models/workspace/Workspace';
import { GupshupService } from '../lib/services/messaging/gupshup-service';

async function debugMedia() {
  await dbConnect();
  
  // Find a test workspace
  const workspace = await Workspace.findOne({ gupshupAppId: { $ne: null } });
  if (!workspace) {
    console.error("No workspace with Gupshup App ID found.");
    process.exit(1);
  }

  const appId = workspace.gupshupAppId;
  const testPhone = "91XXXXXXXXXX"; // REPLACEME with a real test number if possible, or just look at payload

  const mediaUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
  
  console.log("--- Testing Media Send via Autonomous Service ---");
  const workspaceId = process.env.WORKSPACE_ID;
  if (!workspaceId) throw new Error("WORKSPACE_ID environment variable is missing");
  
  const result = await WabaService.sendMediaMessage(workspaceId, testPhone, "image", "https://i.ibb.co/L5hYy1D/test-image.jpg", "Test image from debug script");
  console.dir(result, { depth: null });

  console.log("\n--- Testing Direct API Call via Factory (Hypothesis: url key) ---");
  // Manually build payload with 'url' to test hypothesis
  const payloadUrl = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: testPhone,
    type: 'image',
    image: {
      url: mediaUrl,
      caption: "Test with url"
    }
  };
  
  try {
    const client = (GupshupService as any).getClient(appId);
    const url = `/partner/app/${appId}/v3/message`;
    const response = await client.post(url, payloadUrl);
    console.log("Result with 'url':");
    console.dir(response.data, { depth: null });
  } catch (err: any) {
    console.error("Error with 'url':", err.response?.data || err.message);
  }

  process.exit(0);
}

debugMedia();
