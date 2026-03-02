const mongoose = require('mongoose');

async function debugWorkspace() {
    try {
        const mongoUri = 'mongodb://localhost:27017/wapi_development';
        await mongoose.connect(mongoUri);

        const WorkspaceSchema = new mongoose.Schema({}, { strict: false });
        const Workspace = mongoose.model('Workspace', WorkspaceSchema);

        // Search by common attributes since the string ID might have been slightly off or 
        // it was a different collection
        const ws = await Workspace.findOne({ name: /vivek/i }) || await Workspace.findOne();

        if (ws) {
            console.log('--- WORKSPACE CONFIG ---');
            console.log('ID:', ws._id);
            console.log('Name:', ws.name);
            console.log('whatsappPhoneNumber:', ws.whatsappPhoneNumber);
            console.log('whatsappPhoneNumberId:', ws.whatsappPhoneNumberId);
            console.log('gupshupAppId:', ws.gupshupAppId);
            console.log('gupshupIdentity:', JSON.stringify(ws.gupshupIdentity, null, 2));
            console.log('bspDisplayPhoneNumber:', ws.bspDisplayPhoneNumber);
            console.log('------------------------');
        } else {
            console.log('No workspace found at all');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Debug failed:', err);
    }
}

debugWorkspace();
