const { buildLeanWorkspaceProjection } = require('../bsp/gupshupDataBoundaryService');

function selectWorkspaceOwner(workspace, users = []) {
  if (workspace?.owner) {
    const explicitOwner = users.find((user) => String(user._id) === String(workspace.owner));
    if (explicitOwner) return explicitOwner;
  }

  const ownerRoleUser = users.find((user) => String(user.role || '').toLowerCase() === 'owner');
  if (ownerRoleUser) return ownerRoleUser;

  return users
    .slice()
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())[0] || null;
}

function buildWorkspaceLeanMigrationUpdate(workspace, ownerUser) {
  const projection = buildLeanWorkspaceProjection(
    workspace?.toObject ? workspace.toObject() : workspace,
    { currentWorkspace: workspace }
  );

  const hasGupshupIdentity = Boolean(
    workspace?.gupshupAppId ||
    workspace?.gupshupIdentity?.partnerAppId ||
    workspace?.phoneNumberId ||
    workspace?.bspPhoneNumberId ||
    workspace?.whatsappPhoneNumberId
  );

  return {
    $set: {
      ...(hasGupshupIdentity ? projection : {}),
      owner: ownerUser?._id || workspace?.owner || null,
      dataModelVersion: 2,
      leanMigrationAppliedAt: new Date()
    },
    $unset: {
      ...(hasGupshupIdentity ? { phoneNumbers: 1 } : {})
    }
  };
}

module.exports = {
  selectWorkspaceOwner,
  buildWorkspaceLeanMigrationUpdate
};
