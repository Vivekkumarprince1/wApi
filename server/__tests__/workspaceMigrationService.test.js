const {
  selectWorkspaceOwner,
  buildWorkspaceLeanMigrationUpdate
} = require('../src/services/workspace/workspaceMigrationService');

describe('workspaceMigrationService', () => {
  test('selectWorkspaceOwner prefers explicit workspace owner', () => {
    const users = [
      { _id: 'u1', role: 'member', createdAt: '2026-01-01T00:00:00.000Z' },
      { _id: 'u2', role: 'owner', createdAt: '2026-01-02T00:00:00.000Z' }
    ];

    const owner = selectWorkspaceOwner({ owner: 'u1' }, users);
    expect(owner._id).toBe('u1');
  });

  test('buildWorkspaceLeanMigrationUpdate removes redundant phone arrays and sets model metadata', () => {
    const update = buildWorkspaceLeanMigrationUpdate({
      _id: 'workspace_1',
      gupshupAppId: 'app_1',
      whatsappPhoneNumber: '919999000000',
      bspDisplayPhoneNumber: '919999000000',
      phoneNumberId: 'phone_1',
      phoneNumbers: [{ id: 'legacy_phone' }],
      gupshupIdentity: { partnerAppId: 'app_1', appApiKey: 'enc' }
    }, { _id: 'owner_1' });

    expect(update.$set.owner).toBe('owner_1');
    expect(update.$set.dataModelVersion).toBe(2);
    expect(update.$set.gupshupAppId).toBe('app_1');
    expect(update.$set.phoneNumberId).toBe('phone_1');
    expect(update.$unset.phoneNumbers).toBe(1);
    expect(update.$set.leanMigrationAppliedAt).toBeInstanceOf(Date);
  });
});
