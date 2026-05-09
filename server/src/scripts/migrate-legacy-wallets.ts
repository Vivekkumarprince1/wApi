import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import { Workspace } from '../models';

dotenv.config();

/**
 * One-shot: push monolith Workspace legacy wallet balances into the billing DB
 * via `POST /api/billing/wallets/:id/sync` (idempotent per `isLegacySynced`).
 *
 * Usage:
 *   npx tsx src/scripts/migrate-legacy-wallets.ts
 *   npx tsx src/scripts/migrate-legacy-wallets.ts --dry-run
 *   npx tsx src/scripts/migrate-legacy-wallets.ts --clear-monolith-wallet
 *
 * Env: MONGODB_URI, BILLING_SERVICE_URL, INTERNAL_SERVICE_SECRET
 */
async function main() {
  const billingUrl = process.env.BILLING_SERVICE_URL?.replace(/\/$/, '');
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (!billingUrl) throw new Error('BILLING_SERVICE_URL is required');
  if (!secret) throw new Error('INTERNAL_SERVICE_SECRET is required');

  const dryRun = process.argv.includes('--dry-run');
  const clearMonolith = process.argv.includes('--clear-monolith-wallet');

  await mongoose.connect(process.env.MONGODB_URI);

  const workspaces = await Workspace.find({
    $or: [{ 'wallet.balance': { $gt: 0 } }, { walletBalance: { $gt: 0 } }],
  })
    .select('_id name wallet walletBalance walletParkedBalance')
    .lean();

  console.log(`Found ${workspaces.length} workspace(s) with positive legacy wallet fields.`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const w of workspaces) {
    const id = String(w._id);
    const localPaise =
      (w as { wallet?: { balance?: number }; walletBalance?: number }).wallet?.balance ??
      (w as { walletBalance?: number }).walletBalance ??
      0;
    if (localPaise <= 0) continue;

    try {
      const getRes = await axios.get(`${billingUrl}/api/billing/wallets/${id}`, {
        headers: {
          'x-internal-service-secret': secret,
          'x-workspace-id': id,
        },
        validateStatus: () => true,
      });

      const remote = getRes.data?.wallet || getRes.data?.data || {};
      if (remote.isLegacySynced) {
        console.log(`[skip] ${w.name} (${id}): already legacy-synced in billing`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] would sync ${w.name} (${id}): ${localPaise} paise`);
        continue;
      }

      const postRes = await axios.post(
        `${billingUrl}/api/billing/wallets/${id}/sync`,
        { balancePaise: localPaise },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-internal-service-secret': secret,
          },
          validateStatus: () => true,
        }
      );

      if (postRes.status !== 200) {
        console.error(`[fail] ${w.name} (${id}): ${postRes.status} ${JSON.stringify(postRes.data)}`);
        failed++;
        continue;
      }

      console.log(`[ok] synced ${w.name} (${id}): +${localPaise} paise`);
      synced++;

      if (clearMonolith) {
        await Workspace.updateOne(
          { _id: w._id },
          {
            $set: {
              'wallet.balance': 0,
              'wallet.parkedBalance': 0,
              walletBalance: 0,
              walletParkedBalance: 0,
            },
          }
        );
        console.log(`      cleared monolith legacy wallet fields`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[error] ${id}:`, msg);
      failed++;
    }
  }

  console.log(`Done. synced=${synced} skipped=${skipped} failed=${failed} dryRun=${dryRun}`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
