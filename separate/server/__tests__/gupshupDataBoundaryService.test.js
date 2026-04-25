const {
  STORAGE_BOUNDARY,
  buildLeanWorkspaceProjection
} = require('../src/services/bsp/gupshupDataBoundaryService');

describe('gupshupDataBoundaryService', () => {
  test('buildLeanWorkspaceProjection keeps only routing-critical workspace fields', () => {
    const projection = buildLeanWorkspaceProjection({
      businessId: 'biz_123',
      wabaId: 'waba_123',
      gupshupAppId: 'app_123',
      displayPhoneNumber: '919999000000',
      phoneNumberId: 'phone_number_id_123',
      verifiedName: 'Acme',
      qualityRating: 'GREEN',
      messagingLimit: 'TIER_10K',
      phoneStatus: 'CONNECTED',
      gupshupIdentity: {
        partnerAppId: 'app_123',
        appApiKey: 'encrypted-token',
        source: '919999000000'
      },
      phoneNumbers: [{ id: 'duplicate', displayPhoneNumber: 'duplicate' }],
      rawProviderSnapshot: { nested: true }
    });

    expect(projection).toEqual(expect.objectContaining({
      businessId: 'biz_123',
      wabaId: 'waba_123',
      bspWabaId: 'waba_123',
      gupshupAppId: 'app_123',
      whatsappPhoneNumber: '919999000000',
      bspDisplayPhoneNumber: '919999000000',
      phoneNumberId: 'phone_number_id_123',
      bspPhoneNumberId: 'phone_number_id_123',
      whatsappPhoneNumberId: 'phone_number_id_123',
      verifiedName: 'Acme',
      bspVerifiedName: 'Acme',
      qualityRating: 'GREEN',
      bspQualityRating: 'GREEN',
      messagingLimitTier: 'TIER_10K',
      bspMessagingTier: 'TIER_10K',
      bspPhoneStatus: 'CONNECTED',
      whatsappConnected: true
    }));

    expect(projection.phoneNumbers).toBeUndefined();
    expect(projection.rawProviderSnapshot).toBeUndefined();
  });

  test('storage boundary documents live provider reads', () => {
    expect(STORAGE_BOUNDARY.liveFetch).toContain('partner app details');
    expect(STORAGE_BOUNDARY.avoidDuplicating).toContain('full provider phone arrays when a single routed phone is already stored');
  });
});
