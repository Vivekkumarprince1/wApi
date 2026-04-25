#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
const { mongoUri } = require('../src/config');
const { Workspace, User, Permission } = require('../src/models');
const {
  selectWorkspaceOwner,
  buildWorkspaceLeanMigrationUpdate
} = require('../src/services/workspace/workspaceMigrationService');

function parseArgs(argv) {
  const args = { apply: true };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--dry-run') args.apply = false;
    if (token === '--email' && next) args.email = next;
    if (token === '--userId' && next) args.userId = next;
    if (token === '--workspaceId' && next) args.workspaceId = next;
  }

  return args;
}

async function findTargetWorkspaces(args) {
  if (args.workspaceId) {
    const workspace = await Workspace.findById(args.workspaceId);
    return workspace ? [workspace] : [];
  }

  if (args.email || args.userId) {
    const user = await User.findOne({
      ...(args.email ? { email: args.email } : {}),
      ...(args.userId ? { _id: args.userId } : {})
    });

    if (!user?.workspace) return [];

    const workspace = await Workspace.findById(user.workspace);
    return workspace ? [workspace] : [];
  }

  return Workspace.find({});
}

async function ensureOwnerPermission(workspaceId, ownerId, apply) {
  if (!ownerId) return;
  if (!apply) return;

  await Permission.findOneAndUpdate(
    { workspace: workspaceId, user: ownerId },
    {
      $set: {
        role: 'owner',
        permissions: Permission.getDefaultPermissions('owner'),
        isActive: true
      }
    },
    { upsert: true, new: true }
  );
}

async function migrateWorkspace(workspace, args) {
  const users = await User.find({ workspace: workspace._id }).sort({ createdAt: 1 });
  const ownerUser = selectWorkspaceOwner(workspace, users);
  const update = buildWorkspaceLeanMigrationUpdate(workspace, ownerUser);

  const summary = {
    workspaceId: String(workspace._id),
    workspaceName: workspace.name,
    ownerUserId: ownerUser?._id ? String(ownerUser._id) : null,
    ownerEmail: ownerUser?.email || null,
    apply: args.apply,
    set: Object.keys(update.$set || {}),
    unset: Object.keys(update.$unset || {})
  };

  if (!args.apply) {
    return summary;
  }

  await Workspace.updateOne({ _id: workspace._id }, update);

  if (ownerUser) {
    if (String(ownerUser.role || '').toLowerCase() !== 'owner') {
      ownerUser.role = 'owner';
    }
    if (!ownerUser.workspace || String(ownerUser.workspace) !== String(workspace._id)) {
      ownerUser.workspace = workspace._id;
    }
    await ownerUser.save();
    await ensureOwnerPermission(workspace._id, ownerUser._id, args.apply);
  }

  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mongoose.connect(mongoUri);

  try {
    const workspaces = await findTargetWorkspaces(args);

    if (workspaces.length === 0) {
      console.log(JSON.stringify({ success: false, message: 'No matching workspaces found' }, null, 2));
      return;
    }

    const results = [];
    for (const workspace of workspaces) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await migrateWorkspace(workspace, args));
    }

    console.log(JSON.stringify({ success: true, migrated: results.length, results }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('[migrateLeanGupshupData] Failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_err) {
  }
  process.exitCode = 1;
});
