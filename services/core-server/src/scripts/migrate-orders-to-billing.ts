import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import { Order } from '../models';

dotenv.config();

function mapMonolithOrderToBillingPayload(o: Record<string, any>): Record<string, unknown> {
  const items = Array.isArray(o.items)
    ? o.items.map((it: Record<string, unknown>) => ({
        ...it,
        productId: it.productId ? String(it.productId) : undefined,
      }))
    : o.items;

  const payload: Record<string, unknown> = {
    _id: String(o._id),
    contactId: String(o.contactId),
    orderNumber: o.orderNumber,
    items,
    subtotal: o.subtotal,
    tax: o.tax ?? 0,
    taxPercentage: o.taxPercentage ?? 0,
    shippingCost: o.shippingCost ?? 0,
    discount: o.discount ?? 0,
    total: o.total,
    address: o.address,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentId: o.paymentId,
    source: o.source || 'whatsapp_checkout_bot',
  };

  if (o.conversationId) payload.conversationId = String(o.conversationId);
  if (o.checkoutCartId) payload.checkoutCartId = String(o.checkoutCartId);
  if (o.createdAt) payload.createdAt = o.createdAt;
  if (o.updatedAt) payload.updatedAt = o.updatedAt;
  if (o.confirmedAt) payload.confirmedAt = o.confirmedAt;

  return payload;
}

/**
 * Copy monolith `Order` documents into billing-service (same orderNumber / _id
 * when billing accepts internal create with optional ids).
 *
 * Usage:
 *   npx tsx src/scripts/migrate-orders-to-billing.ts
 *   npx tsx src/scripts/migrate-orders-to-billing.ts --dry-run
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

  await mongoose.connect(process.env.MONGODB_URI);

  const orders = await Order.find({}).sort({ createdAt: 1 }).lean();
  console.log(`Found ${orders.length} order(s) in monolith DB.`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const o of orders) {
    const row = o as Record<string, any>;
    const wid = String(row.workspaceId);

    const body = mapMonolithOrderToBillingPayload(row);

    if (dryRun) {
      console.log(`[dry-run] would import ${row.orderNumber} (${row._id}) workspace=${wid}`);
      continue;
    }

    try {
      const res = await axios.post(`${billingUrl}/api/billing/commerce/wallets/${wid}/orders`, body, {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-secret': secret,
          'x-workspace-id': wid,
        },
        validateStatus: () => true,
      });

      if (res.status === 201 || res.status === 200) {
        console.log(`[ok] ${row.orderNumber}`);
        imported++;
      } else if (res.status === 409) {
        console.log(`[skip] duplicate ${row.orderNumber}`);
        skipped++;
      } else {
        console.error(`[fail] ${row.orderNumber}: ${res.status} ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[error] ${row.orderNumber}:`, msg);
      failed++;
    }
  }

  console.log(`Done. imported=${imported} skipped=${skipped} failed=${failed} dryRun=${dryRun}`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
