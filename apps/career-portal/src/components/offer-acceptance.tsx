"use client";

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileUp,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { EmploymentContract, OfferLetter, OfferStatus } from "@/types/career";
import { Badge, Button, Field, Input, Select, StatusBadge, Surface, Textarea } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type StepId = 1 | 2 | 3 | 4;
type ResponsePath = "" | "accept" | "reject";
type RecordedDecision = "accepted" | "rejected" | null;

type DocumentDraft = {
  id: string;
  type: string;
  fileName: string;
};

type AcceptanceForm = {
  phone: string;
  personalInfo: {
    dateOfBirth: string;
    nationality: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    emergencyContact: {
      name: string;
      relationship: string;
      phone: string;
      email: string;
    };
    identificationDocuments: {
      idType: string;
      idNumber: string;
    };
  };
  bankingInfo: {
    accountHolderName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    accountType: string;
    branch: string;
  };
  acceptanceComments: string;
  agreementTerms: {
    termsAccepted: boolean;
    privacyPolicyAccepted: boolean;
  };
};

const steps: { id: StepId; label: string; detail: string }[] = [
  { id: 1, label: "Review Offer", detail: "Offer terms" },
  { id: 2, label: "Personal Info", detail: "Profile and ID" },
  { id: 3, label: "Banking Info", detail: "Salary account" },
  { id: 4, label: "Review & Submit", detail: "Agreements" },
];

const relationshipOptions = ["", "Spouse", "Parent", "Sibling", "Friend", "Other"];
const idTypeOptions = ["Aadhar", "PAN", "Passport", "Driving License", "Voter ID"];
const accountTypes = ["Savings", "Current"];
const documentTypes = ["identity-document", "address-proof", "bank-proof", "signed-document", "supporting-document"];

export function OfferAcceptance({
  offer,
  initialContract,
}: {
  offer: OfferLetter;
  initialContract?: EmploymentContract;
}) {
  const initialDecision = getInitialDecision(offer, initialContract);
  const [decision, setDecision] = useState<RecordedDecision>(initialDecision);
  const [selectedPath, setSelectedPath] = useState<ResponsePath>(initialDecision === "accepted" ? "accept" : initialDecision === "rejected" ? "reject" : "");
  const [step, setStep] = useState<StepId>(initialDecision === "accepted" ? 4 : 1);
  const [formData, setFormData] = useState<AcceptanceForm>(() => buildInitialForm(offer, initialContract));
  const [documents, setDocuments] = useState<DocumentDraft[]>(() =>
    initialContract?.documents.map((document) => ({ id: document.id, type: document.type, fileName: document.fileName })) || [],
  );
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [rejectionReason, setRejectionReason] = useState(initialContract?.rejectionReason || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(initialDecision === "accepted" ? "Offer already accepted. Your onboarding details are recorded." : "");
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setCurrentTime(Date.now());
  }, []);

  const isExpired = offer.status === "expired" || (currentTime > 0 && Date.parse(offer.validUntil) < currentTime);
  const isCancelled = offer.status === "cancelled";
  const isLocked = Boolean(decision) || isExpired || isCancelled;
  const displayStatus: OfferStatus = isExpired ? "expired" : decision || offer.status;
  const currentStep = selectedPath === "accept" ? step : 1;

  const updateAddress = (key: keyof AcceptanceForm["personalInfo"]["address"], value: string) => {
    setFormData((current) => ({
      ...current,
      personalInfo: {
        ...current.personalInfo,
        address: {
          ...current.personalInfo.address,
          [key]: value,
        },
      },
    }));
  };

  const updateEmergencyContact = (key: keyof AcceptanceForm["personalInfo"]["emergencyContact"], value: string) => {
    setFormData((current) => ({
      ...current,
      personalInfo: {
        ...current.personalInfo,
        emergencyContact: {
          ...current.personalInfo.emergencyContact,
          [key]: value,
        },
      },
    }));
  };

  const updateIdentification = (key: keyof AcceptanceForm["personalInfo"]["identificationDocuments"], value: string) => {
    setFormData((current) => ({
      ...current,
      personalInfo: {
        ...current.personalInfo,
        identificationDocuments: {
          ...current.personalInfo.identificationDocuments,
          [key]: value,
        },
      },
    }));
  };

  const updateBanking = (key: keyof AcceptanceForm["bankingInfo"], value: string) => {
    setFormData((current) => ({
      ...current,
      bankingInfo: {
        ...current.bankingInfo,
        [key]: value,
      },
    }));
  };

  const updateAgreement = (key: keyof AcceptanceForm["agreementTerms"], value: boolean) => {
    setFormData((current) => ({
      ...current,
      agreementTerms: {
        ...current.agreementTerms,
        [key]: value,
      },
    }));
  };

  const validateStep = (stepNumber: StepId) => {
    if (stepNumber === 2) {
      const personalInfo = formData.personalInfo;
      if (!formData.phone.trim()) return "Enter your phone number.";
      if (!personalInfo.dateOfBirth || !personalInfo.nationality.trim()) return "Complete date of birth and nationality.";
      if (!personalInfo.address.street.trim() || !personalInfo.address.city.trim() || !personalInfo.address.state.trim() || !personalInfo.address.zipCode.trim()) {
        return "Complete the address fields.";
      }
      if (!personalInfo.emergencyContact.name.trim() || !personalInfo.emergencyContact.relationship || !personalInfo.emergencyContact.phone.trim()) {
        return "Complete the emergency contact fields.";
      }
      if (!personalInfo.identificationDocuments.idType || !personalInfo.identificationDocuments.idNumber.trim()) {
        return "Complete the identification fields.";
      }
    }

    if (stepNumber === 3) {
      const bankingInfo = formData.bankingInfo;
      if (
        !bankingInfo.accountHolderName.trim() ||
        !bankingInfo.accountNumber.trim() ||
        !bankingInfo.bankName.trim() ||
        !bankingInfo.ifscCode.trim() ||
        !bankingInfo.accountType ||
        !bankingInfo.branch.trim()
      ) {
        return "Complete all banking fields.";
      }
    }

    if (stepNumber === 4 && (!formData.agreementTerms.termsAccepted || !formData.agreementTerms.privacyPolicyAccepted)) {
      return "Accept the employment terms and privacy policy.";
    }

    return "";
  };

  const nextStep = () => {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }

    setError("");
    setStep((current) => (current < 4 ? ((current + 1) as StepId) : current));
  };

  const previousStep = () => {
    setError("");
    if (step <= 2) {
      setStep(1);
      if (!isLocked) setSelectedPath("");
      return;
    }

    setStep((current) => (current > 1 ? ((current - 1) as StepId) : current));
  };

  const handleDocumentUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setDocuments((current) => [
      ...current,
      ...files.map((file, index) => ({
        id: `doc_${Date.now()}_${index}_${file.name}`,
        type: documentType,
        fileName: file.name,
      })),
    ]);
    event.target.value = "";
  };

  const removeDocument = (id: string) => {
    setDocuments((current) => current.filter((document) => document.id !== id));
  };

  const handleAcceptOffer = async () => {
    if (isLocked) return;

    const validationMessage = ([2, 3, 4] as StepId[]).map((value) => validateStep(value)).find(Boolean);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/v1/contracts/offer/${offer.publicId}/contract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildContractPayload(formData, documents)),
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message || "Could not accept this offer.");

      setDecision("accepted");
      setSelectedPath("accept");
      setStep(4);
      setSuccess("Offer accepted successfully. Your onboarding details have been submitted to HR.");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Could not accept this offer.");
    } finally {
      setSaving(false);
    }
  };

  const handleRejectOffer = async () => {
    if (isLocked) return;
    if (!rejectionReason.trim()) {
      setError("Please provide a reason for declining this offer.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/v1/contracts/offer/reject/${offer.publicId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rejectionReason }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message || "Could not decline this offer.");

      setDecision("rejected");
      setSuccess("Offer declined. Thank you for reviewing the opportunity.");
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Could not decline this offer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-page grid gap-5 py-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Surface className="overflow-hidden">
        <header className="border-b p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <StatusBadge status={displayStatus} />
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">Job Offer Response</h1>
              <p className="mt-1 text-sm text-muted-foreground">Offer from {offer.companyName || "ConnectSphere"}</p>
            </div>
            <span className="safe-text rounded-md border bg-muted px-3 py-2 text-xs font-medium">{offer.publicId}</span>
          </div>
        </header>

        <div className="p-5">
          <StepProgress current={currentStep} locked={isLocked} />

          {isExpired ? (
            <Callout tone="warning" title="Offer expired" icon={<AlertTriangle className="size-4" aria-hidden="true" />}>
              This offer was valid until {formatDate(offer.validUntil)}.
            </Callout>
          ) : null}

          {isCancelled ? (
            <Callout tone="danger" title="Offer cancelled" icon={<XCircle className="size-4" aria-hidden="true" />}>
              This offer is no longer available for candidate response.
            </Callout>
          ) : null}

          {success ? (
            <Callout tone="success" title="Decision recorded" icon={<CheckCircle2 className="size-4" aria-hidden="true" />}>
              {success}
            </Callout>
          ) : null}

          {error ? (
            <Callout tone="danger" title="Action needed" icon={<AlertTriangle className="size-4" aria-hidden="true" />}>
              {error}
            </Callout>
          ) : null}

          {currentStep === 1 ? (
            <OfferReviewStep
              offer={offer}
              selectedPath={selectedPath}
              rejectionReason={rejectionReason}
              saving={saving}
              locked={isLocked}
              decision={decision}
              onAccept={() => {
                setSelectedPath("accept");
                setStep(2);
                setError("");
              }}
              onReject={() => {
                setSelectedPath("reject");
                setError("");
              }}
              onCancelReject={() => {
                setSelectedPath("");
                setRejectionReason("");
                setError("");
              }}
              onRejectionReasonChange={setRejectionReason}
              onSubmitRejection={handleRejectOffer}
            />
          ) : null}

          {selectedPath === "accept" && currentStep === 2 ? (
            <PersonalInfoStep
              formData={formData}
              disabled={isLocked || saving}
              onPhoneChange={(value) => setFormData((current) => ({ ...current, phone: value }))}
              onDateOfBirthChange={(value) =>
                setFormData((current) => ({
                  ...current,
                  personalInfo: { ...current.personalInfo, dateOfBirth: value },
                }))
              }
              onNationalityChange={(value) =>
                setFormData((current) => ({
                  ...current,
                  personalInfo: { ...current.personalInfo, nationality: value },
                }))
              }
              onAddressChange={updateAddress}
              onEmergencyContactChange={updateEmergencyContact}
              onIdentificationChange={updateIdentification}
              onNext={nextStep}
              onPrev={previousStep}
            />
          ) : null}

          {selectedPath === "accept" && currentStep === 3 ? (
            <BankingInfoStep
              formData={formData}
              disabled={isLocked || saving}
              onBankingChange={updateBanking}
              onNext={nextStep}
              onPrev={previousStep}
            />
          ) : null}

          {selectedPath === "accept" && currentStep === 4 ? (
            <FinalStep
              offer={offer}
              formData={formData}
              documents={documents}
              documentType={documentType}
              saving={saving}
              locked={isLocked}
              onDocumentTypeChange={setDocumentType}
              onDocumentUpload={handleDocumentUpload}
              onRemoveDocument={removeDocument}
              onCommentsChange={(value) => setFormData((current) => ({ ...current, acceptanceComments: value }))}
              onAgreementChange={updateAgreement}
              onPrev={previousStep}
              onSubmit={handleAcceptOffer}
            />
          ) : null}
        </div>
      </Surface>

      <aside className="space-y-4">
        <Surface className="p-4">
          <h2 className="text-base font-semibold">Response progress</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <ProgressRow label="Candidate" value={offer.candidateName} />
            <ProgressRow label="Position" value={offer.position} />
            <ProgressRow label="Status" value={decision ? decision : isExpired ? "expired" : offer.status} />
            <ProgressRow label="Valid until" value={formatDate(offer.validUntil)} />
          </div>
        </Surface>

        <Surface className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Sensitive data
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Government ID and banking values are stored for onboarding review with masked summaries in HR views.
          </p>
        </Surface>
      </aside>
    </div>
  );
}

function OfferReviewStep({
  offer,
  selectedPath,
  rejectionReason,
  saving,
  locked,
  decision,
  onAccept,
  onReject,
  onCancelReject,
  onRejectionReasonChange,
  onSubmitRejection,
}: {
  offer: OfferLetter;
  selectedPath: ResponsePath;
  rejectionReason: string;
  saving: boolean;
  locked: boolean;
  decision: RecordedDecision;
  onAccept: () => void;
  onReject: () => void;
  onCancelReject: () => void;
  onRejectionReasonChange: (value: string) => void;
  onSubmitRejection: () => void;
}) {
  const compensationLabel = offer.offerType === "Internship" || offer.position.toLowerCase().includes("intern") ? "Monthly stipend" : "Annual salary";
  const compensation = offer.offerType === "Internship" && offer.payoutFrequency ? `${offer.salary} (${offer.payoutFrequency})` : offer.salary;

  return (
    <div className="mt-5 space-y-6">
      <SectionTitle title="Review Your Job Offer" />
      <dl className="grid gap-3 sm:grid-cols-2">
        <OfferInfo label="Candidate" value={offer.candidateName} />
        {offer.candidateEmail ? <OfferInfo label="Email" value={offer.candidateEmail} /> : null}
        <OfferInfo label="Position" value={offer.position} />
        <OfferInfo label="Department" value={offer.department} />
        <OfferInfo label={compensationLabel} value={compensation} />
        <OfferInfo label="Work Type" value={offer.workType} />
        <OfferInfo label="Start Date" value={formatDate(offer.startDate)} />
        <OfferInfo label="Location" value={offer.joiningLocation || "Not specified"} />
        <OfferInfo label="Valid Until" value={formatDate(offer.validUntil)} />
        {offer.reportingManager ? <OfferInfo label="Reporting Manager" value={offer.reportingManager} /> : null}
      </dl>

      {offer.benefits?.length ? (
        <div>
          <p className="text-sm font-medium">Benefits</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {offer.benefits.map((benefit) => (
              <Badge key={benefit} className="bg-muted text-foreground">
                {benefit}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {selectedPath === "reject" ? (
        <div className="rounded-md border bg-background p-4">
          <Field id="rejection-reason" label="Reason for Rejection *">
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(event.target.value)}
              placeholder="Please provide a reason for declining this offer."
              disabled={locked || saving}
              rows={4}
            />
          </Field>
        </div>
      ) : null}

      {locked ? (
        <Callout
          tone={decision === "rejected" ? "danger" : "success"}
          title={decision === "rejected" ? "Offer declined" : decision === "accepted" ? "Offer accepted" : "Offer closed"}
          icon={decision === "rejected" ? <XCircle className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
        >
          {decision === "rejected" ? rejectionReason || "A rejection decision has already been recorded." : "A response has already been recorded for this offer."}
        </Callout>
      ) : null}

      {!locked && selectedPath === "" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" onClick={onAccept} className="min-h-11">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Accept Offer
          </Button>
          <Button type="button" variant="destructive" onClick={onReject} className="min-h-11">
            <XCircle className="size-4" aria-hidden="true" />
            Decline Offer
          </Button>
        </div>
      ) : null}

      {!locked && selectedPath === "reject" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={onCancelReject} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" className="sm:flex-1" onClick={onSubmitRejection} disabled={saving || !rejectionReason.trim()}>
            <XCircle className="size-4" aria-hidden="true" />
            {saving ? "Submitting..." : "Confirm Rejection"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PersonalInfoStep({
  formData,
  disabled,
  onPhoneChange,
  onDateOfBirthChange,
  onNationalityChange,
  onAddressChange,
  onEmergencyContactChange,
  onIdentificationChange,
  onNext,
  onPrev,
}: {
  formData: AcceptanceForm;
  disabled: boolean;
  onPhoneChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onNationalityChange: (value: string) => void;
  onAddressChange: (key: keyof AcceptanceForm["personalInfo"]["address"], value: string) => void;
  onEmergencyContactChange: (key: keyof AcceptanceForm["personalInfo"]["emergencyContact"], value: string) => void;
  onIdentificationChange: (key: keyof AcceptanceForm["personalInfo"]["identificationDocuments"], value: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="mt-5 space-y-6">
      <SectionTitle title="Personal Information" detail="Step 2 of 4" />

      <section className="space-y-4">
        <h3 className="text-base font-semibold">Contact Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="candidate-phone" label="Phone Number *">
            <Input id="candidate-phone" type="tel" value={formData.phone} onChange={(event) => onPhoneChange(event.target.value)} placeholder="+91 9876543210" disabled={disabled} required />
          </Field>
          <Field id="candidate-dob" label="Date of Birth *">
            <Input id="candidate-dob" type="date" value={formData.personalInfo.dateOfBirth} onChange={(event) => onDateOfBirthChange(event.target.value)} disabled={disabled} required />
          </Field>
          <Field id="candidate-nationality" label="Nationality *">
            <Input id="candidate-nationality" value={formData.personalInfo.nationality} onChange={(event) => onNationalityChange(event.target.value)} disabled={disabled} required />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t pt-5">
        <h3 className="text-base font-semibold">Address</h3>
        <Field id="address-street" label="Street Address *">
          <Input
            id="address-street"
            value={formData.personalInfo.address.street}
            onChange={(event) => onAddressChange("street", event.target.value)}
            placeholder="123 Main Street, Apartment/Unit Number"
            disabled={disabled}
            required
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field id="address-city" label="City *">
            <Input id="address-city" value={formData.personalInfo.address.city} onChange={(event) => onAddressChange("city", event.target.value)} disabled={disabled} required />
          </Field>
          <Field id="address-state" label="State *">
            <Input id="address-state" value={formData.personalInfo.address.state} onChange={(event) => onAddressChange("state", event.target.value)} disabled={disabled} required />
          </Field>
          <Field id="address-zip" label="ZIP/Postal Code *">
            <Input id="address-zip" value={formData.personalInfo.address.zipCode} onChange={(event) => onAddressChange("zipCode", event.target.value)} disabled={disabled} required />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t pt-5">
        <h3 className="text-base font-semibold">Emergency Contact</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="emergency-name" label="Full Name *">
            <Input id="emergency-name" value={formData.personalInfo.emergencyContact.name} onChange={(event) => onEmergencyContactChange("name", event.target.value)} disabled={disabled} required />
          </Field>
          <Field id="emergency-relationship" label="Relationship *">
            <Select
              id="emergency-relationship"
              value={formData.personalInfo.emergencyContact.relationship}
              onChange={(event) => onEmergencyContactChange("relationship", event.target.value)}
              disabled={disabled}
              required
            >
              <option value="">Select Relationship</option>
              {relationshipOptions.slice(1).map((relationship) => (
                <option key={relationship} value={relationship}>
                  {relationship}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="emergency-phone" label="Phone Number *">
            <Input
              id="emergency-phone"
              type="tel"
              value={formData.personalInfo.emergencyContact.phone}
              onChange={(event) => onEmergencyContactChange("phone", event.target.value)}
              disabled={disabled}
              required
            />
          </Field>
          <Field id="emergency-email" label="Email (Optional)">
            <Input
              id="emergency-email"
              type="email"
              value={formData.personalInfo.emergencyContact.email}
              onChange={(event) => onEmergencyContactChange("email", event.target.value)}
              disabled={disabled}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t pt-5">
        <h3 className="text-base font-semibold">Identification</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="id-type" label="ID Type *">
            <Select
              id="id-type"
              value={formData.personalInfo.identificationDocuments.idType}
              onChange={(event) => onIdentificationChange("idType", event.target.value)}
              disabled={disabled}
              required
            >
              {idTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type === "Aadhar" ? "Aadhar Card" : type}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="id-number" label="ID Number *">
            <Input id="id-number" value={formData.personalInfo.identificationDocuments.idNumber} onChange={(event) => onIdentificationChange("idNumber", event.target.value)} disabled={disabled} required />
          </Field>
        </div>
      </section>

      <StepActions onPrev={onPrev} onNext={onNext} nextLabel="Next: Banking Information" disabled={disabled} />
    </div>
  );
}

function BankingInfoStep({
  formData,
  disabled,
  onBankingChange,
  onNext,
  onPrev,
}: {
  formData: AcceptanceForm;
  disabled: boolean;
  onBankingChange: (key: keyof AcceptanceForm["bankingInfo"], value: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="mt-5 space-y-6">
      <SectionTitle title="Banking Information" detail="Step 3 of 4" />

      <Callout tone="info" title="Secure Banking Information" icon={<LockKeyhole className="size-4" aria-hidden="true" />}>
        This information is used for payroll setup and HR onboarding review.
      </Callout>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="account-holder" label="Account Holder Name *">
          <Input id="account-holder" value={formData.bankingInfo.accountHolderName} onChange={(event) => onBankingChange("accountHolderName", event.target.value)} placeholder="As per bank records" disabled={disabled} required />
        </Field>
        <Field id="account-type" label="Account Type *">
          <Select id="account-type" value={formData.bankingInfo.accountType} onChange={(event) => onBankingChange("accountType", event.target.value)} disabled={disabled} required>
            {accountTypes.map((type) => (
              <option key={type} value={type}>
                {type} Account
              </option>
            ))}
          </Select>
        </Field>
        <Field id="account-number" label="Account Number *">
          <Input id="account-number" value={formData.bankingInfo.accountNumber} onChange={(event) => onBankingChange("accountNumber", event.target.value)} placeholder="Enter account number" disabled={disabled} required />
        </Field>
        <Field id="ifsc-code" label="IFSC Code *">
          <Input id="ifsc-code" value={formData.bankingInfo.ifscCode} onChange={(event) => onBankingChange("ifscCode", event.target.value.toUpperCase())} placeholder="e.g., SBIN0001234" disabled={disabled} required />
        </Field>
        <Field id="bank-name" label="Bank Name *">
          <Input id="bank-name" value={formData.bankingInfo.bankName} onChange={(event) => onBankingChange("bankName", event.target.value)} placeholder="e.g., State Bank of India" disabled={disabled} required />
        </Field>
        <Field id="branch-name" label="Branch Name *">
          <Input id="branch-name" value={formData.bankingInfo.branch} onChange={(event) => onBankingChange("branch", event.target.value)} placeholder="e.g., Mumbai Main Branch" disabled={disabled} required />
        </Field>
      </div>

      <StepActions onPrev={onPrev} onNext={onNext} nextLabel="Next: Review & Submit" disabled={disabled} />
    </div>
  );
}

function FinalStep({
  offer,
  formData,
  documents,
  documentType,
  saving,
  locked,
  onDocumentTypeChange,
  onDocumentUpload,
  onRemoveDocument,
  onCommentsChange,
  onAgreementChange,
  onPrev,
  onSubmit,
}: {
  offer: OfferLetter;
  formData: AcceptanceForm;
  documents: DocumentDraft[];
  documentType: string;
  saving: boolean;
  locked: boolean;
  onDocumentTypeChange: (value: string) => void;
  onDocumentUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveDocument: (id: string) => void;
  onCommentsChange: (value: string) => void;
  onAgreementChange: (key: keyof AcceptanceForm["agreementTerms"], value: boolean) => void;
  onPrev: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = !saving && !locked && formData.agreementTerms.termsAccepted && formData.agreementTerms.privacyPolicyAccepted;

  return (
    <div className="mt-5 space-y-6">
      <SectionTitle title="Review & Submit" detail="Step 4 of 4" />

      <div className="rounded-md border bg-background p-4">
        <h3 className="text-base font-semibold">Application Summary</h3>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <SummaryLine label="Position" value={offer.position} />
          <SummaryLine label="Start Date" value={formatDate(offer.startDate)} />
          <SummaryLine label="Phone" value={formData.phone || "Not provided"} />
          <SummaryLine label="Bank" value={formData.bankingInfo.bankName || "Not provided"} />
        </dl>
      </div>

      <Field id="acceptance-comments" label="Additional Comments (Optional)">
        <Textarea
          id="acceptance-comments"
          value={formData.acceptanceComments}
          onChange={(event) => onCommentsChange(event.target.value)}
          placeholder="Any additional comments or questions..."
          rows={3}
          disabled={locked || saving}
        />
      </Field>

      <div className="space-y-3 border-t pt-5">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-base font-semibold">Documents</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
          <Select value={documentType} onChange={(event) => onDocumentTypeChange(event.target.value)} disabled={locked || saving} aria-label="Document type">
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {type.split("-").join(" ")}
              </option>
            ))}
          </Select>
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/40 p-4 text-center hover:bg-muted">
            <FileUp className="size-6 text-muted-foreground" aria-hidden="true" />
            <span className="mt-2 text-sm font-medium">Upload onboarding document</span>
            <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG or PNG</span>
            <input type="file" className="sr-only" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={onDocumentUpload} disabled={locked || saving} multiple />
          </label>
        </div>
        {documents.length ? (
          <div className="grid gap-2">
            {documents.map((document) => (
              <div key={document.id} className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <FileCheck2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="safe-text min-w-0 flex-1">{document.fileName}</span>
                <Badge className="shrink-0 bg-muted text-foreground">{document.type}</Badge>
                {!locked ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${document.fileName}`} onClick={() => onRemoveDocument(document.id)} disabled={saving}>
                    <XCircle className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 border-t pt-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={formData.agreementTerms.termsAccepted}
            onChange={(event) => onAgreementChange("termsAccepted", event.target.checked)}
            disabled={locked || saving}
            required
          />
          <span>I agree to the Terms and Conditions of employment *</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={formData.agreementTerms.privacyPolicyAccepted}
            onChange={(event) => onAgreementChange("privacyPolicyAccepted", event.target.checked)}
            disabled={locked || saving}
            required
          />
          <span>I agree to the Privacy Policy *</span>
        </label>
      </div>

      <Callout tone="warning" title="Important" icon={<AlertTriangle className="size-4" aria-hidden="true" />}>
        Submitting this form accepts the job offer and sends onboarding information to HR.
      </Callout>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" onClick={onPrev} disabled={saving || locked}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>
        <Button type="button" className="sm:flex-1" onClick={onSubmit} disabled={!canSubmit}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {saving ? "Submitting..." : locked ? "Submitted" : "Accept Offer & Submit"}
        </Button>
      </div>
    </div>
  );
}

function StepProgress({ current, locked }: { current: StepId; locked: boolean }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-4" aria-label="Offer response progress">
      {steps.map((item) => {
        const active = item.id === current;
        const complete = item.id < current || (locked && current === 4);
        return (
          <li
            key={item.id}
            className={cn(
              "min-w-0 rounded-md border px-3 py-2 text-sm",
              active ? "border-primary bg-emerald-50 text-emerald-950" : complete ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "bg-background text-muted-foreground",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", complete ? "border-emerald-400 bg-emerald-100" : "bg-card")}>
                {complete ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : item.id}
              </span>
              <div className="min-w-0">
                <p className="safe-text font-medium">{item.label}</p>
                <p className="safe-text text-xs opacity-80">{item.detail}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepActions({
  onPrev,
  onNext,
  nextLabel,
  disabled,
}: {
  onPrev: () => void;
  onNext: () => void;
  nextLabel: string;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row">
      <Button type="button" variant="outline" onClick={onPrev} disabled={disabled}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Previous
      </Button>
      <Button type="button" className="sm:flex-1" onClick={onNext} disabled={disabled}>
        {nextLabel}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function Callout({
  tone,
  title,
  icon,
  children,
}: {
  tone: "success" | "danger" | "warning" | "info";
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  }[tone];

  return (
    <div className={cn("mt-5 rounded-md border p-4 text-sm", toneClass)}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <div className="mt-1 text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

function OfferInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="safe-text mt-1 font-medium">{value}</dd>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="safe-text mt-1 font-medium">{value}</dd>
    </div>
  );
}

function ProgressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="safe-text mt-1 font-medium">{value}</p>
    </div>
  );
}

function getInitialDecision(offer: OfferLetter, contract?: EmploymentContract): RecordedDecision {
  if (offer.status === "accepted" || offer.status === "rejected") return offer.status;
  if (contract?.decision === "accepted" || contract?.decision === "rejected") return contract.decision;
  return null;
}

function buildInitialForm(offer: OfferLetter, contract?: EmploymentContract): AcceptanceForm {
  const onboarding = contract?.onboarding;
  return {
    phone: onboarding?.phone || "",
    personalInfo: {
      dateOfBirth: onboarding?.dateOfBirth || "",
      nationality: onboarding?.nationality || "Indian",
      address: {
        street: onboarding?.addressDetails?.street || "",
        city: onboarding?.addressDetails?.city || "",
        state: onboarding?.addressDetails?.state || "",
        zipCode: onboarding?.addressDetails?.zipCode || "",
        country: onboarding?.addressDetails?.country || "India",
      },
      emergencyContact: {
        name: onboarding?.emergencyContactDetails?.name || "",
        relationship: onboarding?.emergencyContactDetails?.relationship || "",
        phone: onboarding?.emergencyContactDetails?.phone || "",
        email: onboarding?.emergencyContactDetails?.email || "",
      },
      identificationDocuments: {
        idType: onboarding?.identificationDocuments?.idType || onboarding?.governmentIdType || "Aadhar",
        idNumber: onboarding?.identificationDocuments?.idNumber || "",
      },
    },
    bankingInfo: {
      accountHolderName: onboarding?.bankingInfo?.accountHolderName || offer.candidateName,
      accountNumber: onboarding?.bankingInfo?.accountNumber || "",
      bankName: onboarding?.bankingInfo?.bankName || onboarding?.bankName || "",
      ifscCode: onboarding?.bankingInfo?.ifscCode || "",
      accountType: onboarding?.bankingInfo?.accountType || "Savings",
      branch: onboarding?.bankingInfo?.branch || "",
    },
    acceptanceComments: onboarding?.acceptanceComments || "",
    agreementTerms: {
      termsAccepted: onboarding?.agreementTerms?.termsAccepted ?? onboarding?.consentAccepted ?? false,
      privacyPolicyAccepted: onboarding?.agreementTerms?.privacyPolicyAccepted ?? onboarding?.consentAccepted ?? false,
    },
  };
}

function buildContractPayload(formData: AcceptanceForm, documents: DocumentDraft[]) {
  const personalInfo = formData.personalInfo;
  const address = compactAddress(personalInfo.address);
  const emergencyContact = compactEmergencyContact(personalInfo.emergencyContact);

  return {
    phone: formData.phone,
    dateOfBirth: personalInfo.dateOfBirth,
    nationality: personalInfo.nationality,
    address,
    addressDetails: personalInfo.address,
    emergencyContact,
    emergencyContactDetails: personalInfo.emergencyContact,
    governmentIdType: personalInfo.identificationDocuments.idType,
    governmentIdLast4: lastFour(personalInfo.identificationDocuments.idNumber),
    identificationDocuments: personalInfo.identificationDocuments,
    bankName: formData.bankingInfo.bankName,
    accountLast4: lastFour(formData.bankingInfo.accountNumber),
    bankingInfo: formData.bankingInfo,
    acceptanceComments: formData.acceptanceComments,
    consentAccepted: formData.agreementTerms.termsAccepted && formData.agreementTerms.privacyPolicyAccepted,
    agreementTerms: {
      ...formData.agreementTerms,
      acceptedAt: new Date().toISOString(),
    },
    documents: documents.map((document) => ({ type: document.type, fileName: document.fileName })),
  };
}

function compactAddress(address: AcceptanceForm["personalInfo"]["address"]) {
  const cityLine = [address.city, address.state, address.zipCode].filter(Boolean).join(" ");
  return [address.street, cityLine, address.country].filter(Boolean).join(", ");
}

function compactEmergencyContact(contact: AcceptanceForm["personalInfo"]["emergencyContact"]) {
  const contactLine = [contact.relationship, contact.phone, contact.email].filter(Boolean).join(" - ");
  return [contact.name, contactLine].filter(Boolean).join(" - ");
}

function lastFour(value: string) {
  return value.replace(/\s+/g, "").slice(-4);
}
