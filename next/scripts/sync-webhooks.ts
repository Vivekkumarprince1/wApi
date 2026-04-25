import 'dotenv/config';
import path from 'path';

async function sync() {
  const { GupshupPartnerService } = await import('../src/lib/services/bsp/gupshup-partner-service');
  
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('❌ Error: WHATSAPP_WEBHOOK_URL not found in .env');
    process.exit(1);
  }

  console.log(`\n🔄 [Sync] Starting webhook synchronization...`);
  console.log(`🔗 [Sync] Target URL: ${webhookUrl}\n`);

  try {
    const results = await GupshupPartnerService.syncWebhookUrls(webhookUrl);
    
    console.log(`📊 [Sync] Results:`);
    console.table(results);

    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'error').length;

    console.log(`\n✨ [Sync] Finished: ${successCount} successful, ${failCount} failed.\n`);
  } catch (err: any) {
    console.error('❌ [Sync] Fatal error:', err.message);
    process.exit(1);
  }
}

sync();
