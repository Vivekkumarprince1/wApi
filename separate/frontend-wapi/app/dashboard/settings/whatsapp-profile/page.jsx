'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaWhatsapp, FaEdit, FaSave, FaImage, FaTrash } from 'react-icons/fa';
import { toast } from '@/lib/toast';
import * as api from '@/lib/api';
import FlashLoader from '@/components/ui/FlashLoader';
import LockedPage from '@/components/shared/LockedPage';

const ACTIVE_PHONE_STATUSES = ['CONNECTED', 'RESTRICTED', 'LIVE', 'ACTIVE', 'VERIFIED'];

export default function WhatsAppProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stage1Status, setStage1Status] = useState(null);
  const [runtimeProfile, setRuntimeProfile] = useState(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    industry: '',
    companySize: '',
    annualRevenue: '',
    website: '',
    address: '',
    businessDescription: '',
    certificationType: '',
    certificationNumber: '',
    about: '',
    email: '',
    vertical: 'OTHER',
    profilePictureUrl: ''
  });
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [deregistering, setDeregistering] = useState(false);
  const [confirmDeregister, setConfirmDeregister] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedReason, setLockedReason] = useState(null);

  useEffect(() => {
    loadPageData();
  }, []);

  const handleDeregister = async () => {
    try {
      setDeregistering(true);
      await api.bspDisconnect();
      toast.success('WhatsApp number deregistered successfully!');
      router.push('/dashboard');
    } catch (error) {
      console.error('Deregister failed:', error);
      toast.error(error?.message || 'Failed to deregister number');
      setConfirmDeregister(false);
    } finally {
      setDeregistering(false);
    }
  };

  const isPhoneConnected = (stage1) => {
    return ACTIVE_PHONE_STATUSES.includes(String(stage1?.details?.phoneStatus || '').toUpperCase()) || stage1?.checklist?.phoneConnected === true;
  };

  const loadRuntimeProfile = async () => {
    try {
      setRuntimeLoading(true);
      const response = await api.bspRuntimeProfile();
      setRuntimeProfile(response?.profile || null);
    } catch (error) {
      console.error('Failed to fetch runtime profile:', error);
      setRuntimeProfile(null);
    } finally {
      setRuntimeLoading(false);
    }
  };

  const buildFormPayload = (workspaceProfile, wabaProfile) => {
    const certType = workspaceProfile?.documents?.documentType || '';
    const certNumber = workspaceProfile?.documents?.certificationNumber
      || workspaceProfile?.documents?.gstNumber
      || workspaceProfile?.documents?.msmeNumber
      || workspaceProfile?.documents?.panNumber
      || '';

    return {
      businessName: workspaceProfile?.businessInfo?.name || '',
      industry: workspaceProfile?.businessInfo?.industry || '',
      companySize: workspaceProfile?.businessInfo?.companySize || '',
      annualRevenue: workspaceProfile?.businessInfo?.annualRevenue || '',
      website: workspaceProfile?.businessInfo?.website || '',
      address: workspaceProfile?.businessInfo?.address || '',
      businessDescription: workspaceProfile?.businessInfo?.description || '',
      certificationType: certType,
      certificationNumber: certNumber,
      about: wabaProfile?.about || '',
      email: wabaProfile?.email || '',
      vertical: wabaProfile?.vertical || 'OTHER',
      profilePictureUrl: wabaProfile?.profilePictureUrl || ''
    };
  };

  const loadPageData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, stage1Response, sessionResponse] = await Promise.all([
        api.getWABASettings(),
        api.bspStage1Status().catch(() => null),
        api.get('/auth/me').catch(() => null)
      ]);

      const loadedWabaProfile = settingsResponse?.profile || {};

      const stage1 = stage1Response?.stage1 || null;
      setStage1Status(stage1);
      await loadRuntimeProfile();

      const ws = sessionResponse?.workspace || null;
      const loadedForm = buildFormPayload(ws || {}, loadedWabaProfile);
      setFormData(loadedForm);
      setSavedSnapshot(loadedForm);

      // Removed auto-redirect to dashboard when disconnected.
      // We want users to be able to see their profile even if they need to reconnect.
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      if (error.status === 403) {
        setIsLocked(true);
        setLockedReason("You don't have permission to view or manage the WhatsApp Business profile.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!formData.businessName || !formData.industry || !formData.certificationType || !formData.certificationNumber) {
        toast.error('Business Name, Industry, Certification Type and Certification Number are required.');
        return;
      }

      await Promise.all([
        api.updateWABASettings({
          profile: {
            businessName: formData.businessName,
            about: formData.about,
            address: formData.address,
            description: formData.businessDescription,
            email: formData.email,
            websites: formData.website ? [formData.website] : [],
            vertical: formData.vertical,
            profilePictureUrl: formData.profilePictureUrl
          }
        }),
        api.saveBusinessInfo({
          businessName: formData.businessName,
          industry: formData.industry,
          companySize: formData.companySize,
          annualRevenue: formData.annualRevenue,
          website: formData.website,
          address: formData.address,
          description: formData.businessDescription,
          documentType: formData.certificationType,
          certificationNumber: formData.certificationNumber,
          gstNumber: formData.certificationType === 'gst' ? formData.certificationNumber : undefined,
          msmeNumber: formData.certificationType === 'msme' ? formData.certificationNumber : undefined,
          panNumber: formData.certificationType === 'pan' ? formData.certificationNumber : undefined
        })
      ]);

      setEditing(false);
      setSavedSnapshot({ ...formData });
      toast.success('Profile saved successfully.');
      await loadPageData();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(error?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    if (savedSnapshot) {
      setFormData(savedSnapshot);
    }
    setEditing(false);
  };

  const handleProfilePictureUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload JPG, PNG, or WEBP image');
      event.target.value = '';
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image size must be less than 2MB');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        profilePictureUrl: reader.result
      }));
      toast.success('Image selected. Click Save Changes to apply.');
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRefreshRuntime = async () => {
    try {
      await api.bspSync();
      await Promise.all([loadRuntimeProfile(), api.bspStage1Status().then((response) => setStage1Status(response?.stage1 || null)).catch(() => null)]);
      toast.success('Runtime status refreshed from Gupshup.');
    } catch (error) {
      console.error('Runtime refresh failed:', error);
      toast.error(error?.message || 'Failed to refresh runtime status');
    }
  };

  const runtimePersisted = runtimeProfile?.persisted || {};
  const runtimeLive = runtimeProfile?.live || {};
  const templateSummary = runtimeLive?.templates?.data;
  const wabaLiveData = runtimeLive?.waba?.data || {};
  const storageBoundary = runtimeProfile?.storageBoundary || {};

  if (isLocked) {
    return (
      <LockedPage 
        title="WhatsApp Profile Locked"
        description={lockedReason}
        requiredRole="Manager"
        isUpgradeRequired={false}
      />
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <FaWhatsapp className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">WhatsApp Business Profile</h1>
              <p className="text-sm text-muted-foreground">Production settings: business profile, certification and WhatsApp display info</p>
            </div>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
            >
              <FaEdit /> Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-border text-foreground rounded-xl hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <FaSave /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto bg-card rounded-xl shadow-premium p-6">
        {loading ? (
          <FlashLoader />
        ) : (
          <div className="space-y-6">
            {isPhoneConnected(stage1Status) && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-3">Connected WhatsApp Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone Number</span>
                    <div className="font-medium text-foreground">{stage1Status?.details?.phoneNumber || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone Number ID</span>
                    <div className="font-medium text-foreground break-all">{stage1Status?.details?.phoneNumberId || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">WABA ID</span>
                    <div className="font-medium text-foreground break-all">{stage1Status?.details?.wabaId || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Business ID</span>
                    <div className="font-medium text-foreground break-all">{stage1Status?.details?.businessId || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Verified Name</span>
                    <div className="font-medium text-foreground">{stage1Status?.details?.verifiedName || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone Status</span>
                    <div className="font-medium text-emerald-600 dark:text-emerald-400">{stage1Status?.details?.phoneStatus || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quality Rating</span>
                    <div className="font-medium text-foreground">{stage1Status?.details?.qualityRating || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Messaging Tier</span>
                    <div className="font-medium text-foreground">{stage1Status?.details?.messagingTier || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Connected At</span>
                    <div className="font-medium text-foreground">{stage1Status?.details?.connectedAt ? new Date(stage1Status.details.connectedAt).toLocaleString() : 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">QR Code</span>
                    <div className="font-medium text-foreground">Not required in BSP Embedded Signup</div>
                  </div>
                </div>

                {/* Deregister Button */}
                <div className="mt-4 pt-4 border-t border-border">
                  {!deregistering ? (
                    !confirmDeregister ? (
                      <button
                        onClick={() => setConfirmDeregister(true)}
                        className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Deregister Number
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-red-600 dark:text-red-400 font-medium">Are you sure? This will disconnect your WhatsApp number.</span>
                        <button
                          onClick={handleDeregister}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                        >
                          Yes, Deregister
                        </button>
                        <button
                          onClick={() => setConfirmDeregister(false)}
                          className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-xl hover:bg-accent transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      Deregistering...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border border-border rounded-xl p-4 bg-card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Live Gupshup Runtime</h2>
                  <p className="text-xs text-muted-foreground mt-1">Lean workspace data is combined with live provider reads for health, templates and subscription visibility.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshRuntime}
                  disabled={runtimeLoading}
                  className="px-3 py-2 text-sm border border-border rounded-xl hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {runtimeLoading ? 'Refreshing...' : 'Refresh Runtime'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <span className="text-muted-foreground">Partner App ID</span>
                  <div className="font-medium text-foreground break-all">{runtimePersisted.gupshupAppId || runtimePersisted.gupshupIdentity?.partnerAppId || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">App Source</span>
                  <div className="font-medium text-foreground">{runtimePersisted.gupshupIdentity?.source || stage1Status?.details?.phoneNumber || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Persisted Phone Status</span>
                  <div className="font-medium text-foreground">{runtimePersisted.phoneStatus || stage1Status?.details?.phoneStatus || 'PENDING'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Runtime Connection</span>
                  <div className={`font-medium ${runtimeProfile?.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {runtimeProfile?.connected ? 'Connected to provider APIs' : 'Provider app not linked yet'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Live WABA</span>
                  <div className="font-medium text-foreground break-all">{runtimePersisted.wabaId || wabaLiveData?.id || wabaLiveData?.wabaId || 'Pending sync'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Approved Templates</span>
                  <div className="font-medium text-foreground">{typeof templateSummary?.total === 'number' ? templateSummary.total : 'N/A'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="rounded-xl border border-border p-3 bg-muted/40">
                  <div className="font-semibold text-foreground mb-2">Stored locally</div>
                  <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                    {(storageBoundary.persist || []).slice(0, 4).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-border p-3 bg-muted/40">
                  <div className="font-semibold text-foreground mb-2">Fetched live</div>
                  <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                    {(storageBoundary.liveFetch || []).slice(0, 4).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-border p-3 bg-muted/40">
                  <div className="font-semibold text-foreground mb-2">Avoid duplicated storage</div>
                  <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                    {(storageBoundary.avoidDuplicating || []).slice(0, 4).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Unified Production Form */}
            <div className="border border-border rounded-xl p-4 bg-card">
              <h2 className="text-sm font-semibold text-foreground mb-3">Business Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input name="businessName" value={formData.businessName} onChange={handleInputChange} disabled={!editing} className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40" placeholder="Business Name *" />
                <input name="industry" value={formData.industry} onChange={handleInputChange} disabled={!editing} className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40" placeholder="Industry *" />
                <input name="companySize" value={formData.companySize} onChange={handleInputChange} disabled={!editing} className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40" placeholder="Company Size" />
                <input name="annualRevenue" value={formData.annualRevenue} onChange={handleInputChange} disabled={!editing} className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40" placeholder="Annual Revenue" />
                <input name="website" value={formData.website} onChange={handleInputChange} disabled={!editing} className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40" placeholder="Website" />
                <input name="address" value={formData.address} onChange={handleInputChange} disabled={!editing} className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40" placeholder="Address" />
                <select name="certificationType" value={formData.certificationType} onChange={handleInputChange} disabled={!editing} className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40">
                  <option value="">Certification Type *</option>
                  <option value="gst">GST</option>
                  <option value="msme">MSME</option>
                  <option value="pan">PAN</option>
                  <option value="other">Other</option>
                </select>
                <input name="certificationNumber" value={formData.certificationNumber} onChange={handleInputChange} disabled={!editing} className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40" placeholder="Certification Number *" />
                <textarea name="businessDescription" value={formData.businessDescription} onChange={handleInputChange} disabled={!editing} rows={3} className="md:col-span-2 w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-muted/40" placeholder="Business description" />
              </div>
            </div>

            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Profile Picture
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-border dark:bg-muted rounded-full flex items-center justify-center overflow-hidden">
                  {formData.profilePictureUrl ? (
                    <img src={formData.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <FaImage className="text-muted-foreground text-2xl" />
                  )}
                </div>
                {editing && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    className="px-4 py-2 border border-border rounded-xl hover:bg-accent transition-colors text-sm"
                  >
                    Upload New Picture
                  </button>
                )}
                {editing && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleProfilePictureUpload}
                  />
                )}
              </div>
              {editing && (
                <p className="mt-2 text-xs text-muted-foreground">Supports JPG, PNG, WEBP up to 2MB</p>
              )}
            </div>

            {/* About */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                About
              </label>
              <textarea
                name="about"
                value={formData.about}
                onChange={handleInputChange}
                disabled={!editing}
                rows={3}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="Tell customers about your business"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!editing}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="business@example.com"
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Industry
              </label>
              <select
                name="vertical"
                value={formData.vertical}
                onChange={handleInputChange}
                disabled={!editing}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground disabled:bg-gray-100 dark:disabled:bg-gray-800 focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <option value="OTHER">Other</option>
                <option value="AUTO">Automotive</option>
                <option value="BEAUTY">Beauty, Spa and Salon</option>
                <option value="APPAREL">Clothing and Apparel</option>
                <option value="EDU">Education</option>
                <option value="ENTERTAIN">Entertainment</option>
                <option value="EVENT_PLAN">Event Planning and Service</option>
                <option value="FINANCE">Finance and Banking</option>
                <option value="GROCERY">Grocery and Retail</option>
                <option value="GOVT">Government</option>
                <option value="HOTEL">Hotel and Lodging</option>
                <option value="HEALTH">Medical and Health</option>
                <option value="NONPROFIT">Non-profit</option>
                <option value="PROF_SERVICES">Professional Services</option>
                <option value="RETAIL">Retail</option>
                <option value="TRAVEL">Travel and Transportation</option>
                <option value="RESTAURANT">Restaurant</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
