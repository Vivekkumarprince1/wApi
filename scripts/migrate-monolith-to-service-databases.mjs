import mongoose from '../services/auth-service/node_modules/mongoose/index.js';

const usage = `
Usage:
  node scripts/migrate-monolith-to-service-databases.mjs --dry-run
  node scripts/migrate-monolith-to-service-databases.mjs --apply

Required environment variables:
  SOURCE_MONGO_URI      Source monolith database URI
  AUTH_TARGET_MONGO_URI Target auth/core database URI
  BSP_TARGET_MONGO_URI  Target service-provider database URI

The migration merges by _id. It never deletes target documents.
`;

const apply = process.argv.includes('--apply');
const dryRun = process.argv.includes('--dry-run');

if ((apply && dryRun) || (!apply && !dryRun)) {
  console.error(usage);
  process.exit(1);
}

const sourceUri = process.env.SOURCE_MONGO_URI;
const authTargetUri = process.env.AUTH_TARGET_MONGO_URI;
const bspTargetUri = process.env.BSP_TARGET_MONGO_URI;

for (const [name, value] of Object.entries({ sourceUri, authTargetUri, bspTargetUri })) {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

// These collections are explicitly owned by auth-service models. Collection
// names are intentionally explicit: chat, CRM, billing, campaign, and
// automation documents must be migrated to their own service databases.
const authCollections = [
  'activitylogs',
  'auditlogs',
  'bsphealths',
  'businessappmaps',
  'businesses',
  'businessverificationpolicies',
  'notifications',
  'onboardingstates',
  'otpchallenges',
  'otps',
  'permissions',
  'pipelines',
  'plans',
  'roles',
  'signupotps',
  'subscriptions',
  'system_settings',
  'tags',
  'teams',
  'usageledgers',
  'users',
  'wallets',
  'wallettransactions',
  'webhookconfigauditlogs',
  'webhookpolicies',
  'whatsappforms',
  'widgetconfigs',
  'workspaceinvitations',
  'workspaces',
];

// Source-to-target transformations for provider data. Only fields represented
// by the service-provider schemas are emitted. Raw provider credentials/tokens
// are not migrated because target services encrypt and manage them separately.
const bspTransforms = {
  gupshupapps: {
    target: 'bsp_apps',
    transform: (doc) => ({
      _id: doc._id,
      workspaceId: String(doc.workspaceId || doc.workspace || ''),
      provider: doc.provider || 'gupshup',
      appId: String(doc.appId || doc.gupshupAppId || doc._id),
      businessId: doc.businessId,
      appName: doc.appName || doc.gupshupAppName || doc.name,
      status: doc.status || doc.onboardingStatus || 'not_started',
      displayPhoneNumber: doc.displayPhoneNumber || doc.bspDisplayPhoneNumber,
      phoneNumberId: doc.phoneNumberId || doc.bspPhoneNumberId,
      wabaId: doc.wabaId || doc.bspWabaId,
      whatsappConnected: Boolean(doc.whatsappConnected),
      connectedAt: doc.connectedAt,
      gupshupAppId: doc.gupshupAppId || doc.appId,
      gupshupAppName: doc.gupshupAppName || doc.appName,
      onboardingStatus: doc.onboardingStatus,
      gupshupAppLive: Boolean(doc.gupshupAppLive),
      gupshupAppHealth: doc.gupshupAppHealth,
      gupshupIdentity: doc.gupshupIdentity,
      bspPhoneNumberId: doc.bspPhoneNumberId,
      bspDisplayPhoneNumber: doc.bspDisplayPhoneNumber,
      bspVerifiedName: doc.bspVerifiedName,
      whatsappPhoneNumberId: doc.whatsappPhoneNumberId,
      whatsappPhoneNumber: doc.whatsappPhoneNumber,
      bspPhoneStatus: doc.bspPhoneStatus || 'PENDING',
      bspQualityRating: doc.bspQualityRating || 'UNKNOWN',
      bspMessagingTier: doc.bspMessagingTier || 'TIER_1K',
      bspOnboardedAt: doc.bspOnboardedAt,
      bspLastSyncedAt: doc.bspLastSyncedAt,
      bspSyncStatus: doc.bspSyncStatus || 'INACTIVE',
      bspAudit: doc.bspAudit,
      businessProfile: doc.businessProfile,
      phoneNumbers: doc.phoneNumbers,
      bspManaged: doc.bspManaged ?? true,
      bspWabaId: doc.bspWabaId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }),
  },
  onboardingstates: {
    target: 'onboardingstates',
    transform: (doc) => doc,
  },
  rcsconfigs: {
    target: 'rcsconfigs',
    transform: (doc) => doc,
  },
  smsconfigs: {
    target: 'smsconfigs',
    transform: (doc) => doc,
  },
  workspaces: {
    target: 'workspaces',
    transform: (doc) => doc,
  },
};

function omitUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));
}

function normalizeForTarget(sourceName, document) {
  const normalized = { ...document };

  // MongoDB unique indexes treat an empty string as a real duplicate value.
  // Auth accounts without a phone/email must omit the field entirely.
  if (sourceName === 'users') {
    if (typeof normalized.phone === 'string' && !normalized.phone.trim()) delete normalized.phone;
    if (typeof normalized.email === 'string' && !normalized.email.trim()) delete normalized.email;
  }

  return normalized;
}

async function collectionExists(db, name) {
  return Boolean(await db.listCollections({ name }, { nameOnly: true }).next());
}

async function mergeCollection({ sourceDb, targetDb, sourceName, targetName, transform }) {
  if (!(await collectionExists(sourceDb, sourceName))) {
    return { source: sourceName, target: targetName, sourceCount: 0, upserted: 0, matched: 0, skipped: true };
  }

  const source = sourceDb.collection(sourceName);
  const target = targetDb.collection(targetName);
  const sourceCount = await source.countDocuments();

  if (dryRun || sourceCount === 0) {
    return { source: sourceName, target: targetName, sourceCount, upserted: 0, matched: 0, conflicts: [], skipped: dryRun };
  }

  let upserted = 0;
  let matched = 0;
  const conflicts = [];
  const cursor = source.find({});
  const operations = [];

  async function executeBatch() {
    if (!operations.length) return;
    try {
      const result = await target.bulkWrite(operations, { ordered: false });
      upserted += result.upsertedCount;
      matched += result.matchedCount;
    } catch (error) {
      if (error?.code !== 11000 || !error.result) throw error;
      upserted += error.result.upsertedCount || 0;
      matched += error.result.matchedCount || 0;
      for (const writeError of error.writeErrors || []) {
        const duplicateKey = writeError.errmsg?.match(/index: ([^ ]+)/)?.[1] || 'unique-index';
        conflicts.push({ source: sourceName, target: targetName, duplicateKey });
      }
    }
    operations.length = 0;
  }

  for await (const sourceDoc of cursor) {
    const targetDoc = normalizeForTarget(sourceName, omitUndefined(transform(sourceDoc)));
    if (!targetDoc._id) throw new Error(`${sourceName} contains a document without _id`);
    operations.push({
      replaceOne: {
        filter: { _id: targetDoc._id },
        replacement: targetDoc,
        upsert: true,
      },
    });

    if (operations.length === 250) {
      await executeBatch();
    }
  }

  await executeBatch();

  return { source: sourceName, target: targetName, sourceCount, upserted, matched, conflicts, skipped: false };
}

const sourceConnection = mongoose.createConnection(sourceUri);
const authTargetConnection = mongoose.createConnection(authTargetUri);
const bspTargetConnection = mongoose.createConnection(bspTargetUri);

try {
  await Promise.all([
    sourceConnection.asPromise(),
    authTargetConnection.asPromise(),
    bspTargetConnection.asPromise(),
  ]);

  const sourceDb = sourceConnection.db;
  const authTargetDb = authTargetConnection.db;
  const bspTargetDb = bspTargetConnection.db;

  const authResults = [];
  for (const collection of authCollections) {
    authResults.push(await mergeCollection({
      sourceDb,
      targetDb: authTargetDb,
      sourceName: collection,
      targetName: collection,
      transform: (doc) => doc,
    }));
  }

  const bspResults = [];
  for (const [sourceName, config] of Object.entries(bspTransforms)) {
    bspResults.push(await mergeCollection({
      sourceDb,
      targetDb: bspTargetDb,
      sourceName,
      targetName: config.target,
      transform: config.transform,
    }));
  }

  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'apply',
    sourceDatabase: sourceDb.databaseName,
    authTargetDatabase: authTargetDb.databaseName,
    bspTargetDatabase: bspTargetDb.databaseName,
    auth: authResults,
    bsp: bspResults,
  }, null, 2));
} finally {
  await Promise.all([
    sourceConnection.close(),
    authTargetConnection.close(),
    bspTargetConnection.close(),
  ]);
}
