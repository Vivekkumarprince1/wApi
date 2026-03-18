const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const PORT = process.env.PORT || 5001;
const ENV_PATH = path.join(__dirname, '../.env');

(async () => {
  try {
    console.log(`\n🚀 Starting ngrok on port ${PORT}...`);
    
    // Start ngrok in background
    const ngrokProcess = spawn('ngrok', ['http', PORT], { stdio: 'ignore', detached: true });
    ngrokProcess.unref();

    console.log(`⏳ Waiting for ngrok to initialize...`);
    
    // Poll local ngrok API
    let tunnelUrl = null;
    for(let i=0; i<10; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
            const res = await axios.get('http://127.0.0.1:4040/api/tunnels');
            const tunnels = res.data.tunnels;
            const httpsTunnel = tunnels.find(t => t.public_url.startsWith('https'));
            if(httpsTunnel) {
                tunnelUrl = httpsTunnel.public_url;
                break;
            }
        } catch(e) {
            // Keep trying
        }
    }

    if (!tunnelUrl) {
       console.log('❌ Could not fetch ngrok URL. Make sure ngrok is authenticated and installed.');
       process.exit(1);
    }
    
    console.log(`🔗 Public URL: ${tunnelUrl}`);
    const webhookUrl = `${tunnelUrl}/api/v1/webhook/gupshup`;
    console.log(`🎯 Webhook URL: ${webhookUrl}`);
    
    // Update .env file
    if (fs.existsSync(ENV_PATH)) {
      let envContent = fs.readFileSync(ENV_PATH, 'utf8');
      
      const webhookRegex = /^WHATSAPP_WEBHOOK_URL=.*$/m;
      if (webhookRegex.test(envContent)) {
        envContent = envContent.replace(webhookRegex, `WHATSAPP_WEBHOOK_URL=${webhookUrl}`);
      } else {
        envContent += `\nWHATSAPP_WEBHOOK_URL=${webhookUrl}\n`;
      }
      
      fs.writeFileSync(ENV_PATH, envContent);
      console.log(`✅ Updated .env file with new WHATSAPP_WEBHOOK_URL`);
      
    } else {
      console.log(`⚠️ .env file not found at ${ENV_PATH}`);
    }

    console.log(`\n✅ Ngrok is running in the background. Run 'npm run tunnel' again if you need a new URL.`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();