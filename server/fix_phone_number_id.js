/**
 * One-off fix: Update phoneNumberId for user vivekkumarprince1@gmail.com
 * PhoneNumber:   15557225924
 * PhoneNumberId: 1058773117310270 (from WhatsApp Manager screenshot)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
}

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }), 'workspaces');

    // Find the user
    const user = await User.findOne({ email: 'vivekkumarprince1@gmail.com' }).lean();
    if (!user) {
        console.error('User not found: vivekkumarprince1@gmail.com');
        process.exit(1);
    }
    console.log('Found user:', user._id.toString(), user.email);

    // Find workspaces owned by this user
    const workspaces = await Workspace.find({ owner: user._id }).lean();
    if (!workspaces.length) {
        console.error('No workspaces found for this user');
        process.exit(1);
    }

    console.log(`Found ${workspaces.length} workspace(s)`);

    for (const ws of workspaces) {
        console.log('\n--- Workspace:', ws._id.toString(), ws.name || '(no name)');
        console.log('  Current phoneNumberId:', ws.phoneNumberId || ws.bspPhoneNumberId || '(not set)');
        console.log('  Current wabaId:', ws.wabaId || ws.bspWabaId || '(not set)');
        console.log('  Current whatsappPhoneNumber:', ws.whatsappPhoneNumber || ws.bspDisplayPhoneNumber || '(not set)');

        const result = await Workspace.updateOne(
            { _id: ws._id },
            {
                $set: {
                    phoneNumberId: '1058773117310270',
                    bspPhoneNumberId: '1058773117310270',
                    whatsappPhoneNumberId: '1058773117310270',
                    // Keep phone number in case it's missing
                    whatsappPhoneNumber: ws.whatsappPhoneNumber || '15557225924',
                    bspDisplayPhoneNumber: ws.bspDisplayPhoneNumber || '15557225924',
                }
            }
        );

        console.log('  Update result:', result.modifiedCount > 0 ? '✅ Updated' : '⚠️ No change (already up to date?)');
    }

    // Verify
    console.log('\n--- Verification ---');
    for (const ws of workspaces) {
        const updated = await Workspace.findById(ws._id).lean();
        console.log('Workspace:', updated?._id?.toString());
        console.log('  phoneNumberId:', updated?.phoneNumberId);
        console.log('  bspPhoneNumberId:', updated?.bspPhoneNumberId);
    }

    await mongoose.disconnect();
    console.log('\nDone.');
}

run().catch(err => {
    console.error('Script error:', err);
    process.exit(1);
});
