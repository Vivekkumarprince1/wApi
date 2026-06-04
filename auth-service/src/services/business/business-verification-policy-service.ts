import { config } from '../../config/index.js';
import { BusinessVerificationPolicy } from '../../models/index.js';

const POLICY_KEY = 'global';

export interface BusinessVerificationPolicySnapshot {
  mandatory: boolean;
  source: 'database' | 'environment';
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function getBusinessVerificationPolicy(): Promise<BusinessVerificationPolicySnapshot> {
  const policy = await (BusinessVerificationPolicy as any).findOne({ key: POLICY_KEY }).lean();

  return {
    mandatory: typeof policy?.mandatory === 'boolean' ? policy.mandatory : !!config.devAllowOtpWithoutEmail, // Fallback safely to configuration values
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
  return (BusinessVerificationPolicy as any).findOneAndUpdate(
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
