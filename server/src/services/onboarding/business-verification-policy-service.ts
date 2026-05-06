import { config } from '@/config';
import { BusinessVerificationPolicy } from '@/models';

const POLICY_KEY = 'global';

export interface BusinessVerificationPolicySnapshot {
  mandatory: boolean;
  source: 'database' | 'environment';
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function getBusinessVerificationPolicy(): Promise<BusinessVerificationPolicySnapshot> {
  const policy = await BusinessVerificationPolicy.findOne({ key: POLICY_KEY }).lean();

  return {
    mandatory: typeof policy?.mandatory === 'boolean' ? policy.mandatory : config.businessVerificationMandatory,
    source: policy ? 'database' : 'environment',
    updatedAt: policy?.updatedAt ? new Date(policy.updatedAt).toISOString() : null,
    updatedBy: policy?.updatedBy ? String(policy.updatedBy) : null,
  };
}

export async function isBusinessVerificationMandatory() {
  const policy = await getBusinessVerificationPolicy();
  return policy.mandatory;
}

export async function setBusinessVerificationMandatory(mandatory: boolean, updatedBy?: string, notes?: string) {
  return BusinessVerificationPolicy.findOneAndUpdate(
    { key: POLICY_KEY },
    {
      $set: {
        key: POLICY_KEY,
        mandatory,
        ...(updatedBy ? { updatedBy } : {}),
        ...(notes ? { notes } : {})
      }
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
}