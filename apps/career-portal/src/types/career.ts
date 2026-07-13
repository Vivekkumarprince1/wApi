export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";
export type WorkMode = "Remote" | "On-site" | "Hybrid";
export type QuestionType = "text" | "multipleChoice" | "checkbox" | "file" | "rating";
export type ApplicationStatus = "pending" | "reviewing" | "shortlisted" | "offered" | "hired" | "rejected";
export type OfferStatus = "issued" | "accepted" | "rejected" | "expired" | "cancelled";
export type ContractStatus = "submitted" | "under_review" | "approved" | "rejected" | "requires_changes";
export type CredentialStatus = "valid" | "expired" | "revoked" | "not_found";
export type UserRole = "user" | "employee" | "admin" | "super-admin";
export type AccountStatus = "active" | "inactive" | "former" | "suspended";

export type PermissionFlag =
  | "canGenerateCertificate"
  | "canGenerateOfferLetter"
  | "canCreateJob"
  | "canViewApplicants"
  | "canManageReviews"
  | "canManageEmployees"
  | "canManageRecommendations"
  | "canAccessDashboard";

export type PermissionSet = Record<PermissionFlag, boolean>;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: AccountStatus;
  department?: string;
  position?: string;
  manager?: string;
  verified: boolean;
  permissions: PermissionSet;
  assignedJobIds?: string[];
}

export interface SessionPayload {
  userId: string;
  exp: number;
}

export interface ScreeningQuestion {
  id: string;
  questionText: string;
  questionType: QuestionType;
  required: boolean;
  options?: string[];
  allowFileUpload?: boolean;
  maxRating?: number;
  order: number;
}

export interface HrContact {
  name: string;
  email: string;
  phone?: string;
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  company: string;
  imageFileName?: string;
  imageUrl?: string;
  department: string;
  position: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  location: string;
  type: EmploymentType;
  workMode: WorkMode;
  salary: string;
  reportingManager: string;
  isActive: boolean;
  isFeatured: boolean;
  hrContact: HrContact;
  questions: ScreeningQuestion[];
  createdAt: string;
  applicantCount: number;
}

export interface QuestionAnswer {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  answer: string | string[] | number | boolean;
  fileUrl?: string;
}

export interface StatusEvent {
  from: ApplicationStatus | "created";
  to: ApplicationStatus;
  actor: string;
  at: string;
  reasonCode?: string;
  candidateMessage?: string;
}

export interface CandidateProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  verified: boolean;
  role: UserRole;
}

export interface Application {
  id: string;
  reference: string;
  jobId: string;
  jobSlug: string;
  jobTitle: string;
  candidate: CandidateProfile;
  resumeFileName: string;
  experience: string;
  education: string;
  skills: string[];
  coverLetter: string;
  questionAnswers: QuestionAnswer[];
  isReferred?: boolean;
  referrerEmployeeId?: string;
  referrerName?: string;
  referrerEmail?: string;
  referralMessage?: string;
  status: ApplicationStatus;
  statusHistory: StatusEvent[];
  reviewerNotes?: string;
  score?: number;
  aiSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferLetter {
  id: string;
  publicId: string;
  applicationId: string;
  candidateName: string;
  candidateEmail?: string;
  companyName?: string;
  position: string;
  department: string;
  salary: string;
  startDate: string;
  validUntil: string;
  workType: WorkMode;
  offerType?: string;
  payoutFrequency?: string;
  joiningLocation?: string;
  reportingManager?: string;
  benefits?: string[];
  status: OfferStatus;
  issuedAt: string;
  issuer: string;
}

export interface ContractDocument {
  id: string;
  type: string;
  fileName: string;
  uploadedAt: string;
}

export interface EmploymentContract {
  id: string;
  offerId: string;
  applicationId: string;
  candidateName: string;
  candidateEmail?: string;
  status: ContractStatus;
  submittedAt: string;
  updatedAt: string;
  decision?: "accepted" | "rejected";
  rejectionReason?: string;
  onboarding: {
    phone?: string;
    dateOfBirth?: string;
    nationality?: string;
    address?: string;
    addressDetails?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    emergencyContact?: string;
    emergencyContactDetails?: {
      name?: string;
      relationship?: string;
      phone?: string;
      email?: string;
    };
    governmentIdType?: string;
    governmentIdLast4?: string;
    identificationDocuments?: {
      idType?: string;
      idNumber?: string;
    };
    bankName?: string;
    accountLast4?: string;
    bankingInfo?: {
      accountHolderName?: string;
      accountNumber?: string;
      bankName?: string;
      ifscCode?: string;
      accountType?: string;
      branch?: string;
    };
    acceptanceComments?: string;
    consentAccepted?: boolean;
    agreementTerms?: {
      termsAccepted?: boolean;
      privacyPolicyAccepted?: boolean;
      acceptedAt?: string;
      ipAddress?: string;
    };
  };
  documents: ContractDocument[];
  reviewer?: string;
  reviewNote?: string;
}

export interface Certificate {
  id: string;
  publicId: string;
  recipientName: string;
  credential: string;
  role: string;
  issuer: string;
  fromDate: string;
  toDate: string;
  issuedAt: string;
  status: Exclude<CredentialStatus, "not_found">;
}

export interface Review {
  id: string;
  reviewerType: "employee" | "offer-recipient";
  name: string;
  role: string;
  department?: string;
  position?: string;
  workType?: WorkMode;
  employmentDuration?: string;
  pros?: string;
  cons?: string;
  advice?: string;
  rating: number;
  title: string;
  body: string;
  anonymous: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt?: string;
  rejectionReason?: string;
}

export interface Recommendation {
  id: string;
  recommender: string;
  recommenderId?: string;
  candidateName: string;
  candidateEmail?: string;
  applicationId?: string;
  applicationReference?: string;
  jobTitle: string;
  jobDepartment?: string;
  rationale: string;
  status: "pending" | "reviewed" | "selected" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  adminNotes?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  manager: string;
  status: "active" | "inactive" | "former" | "suspended";
  permissions: PermissionFlag[];
}

export interface NotificationItem {
  id: string;
  type: "application-status" | "job-update" | "system";
  title: string;
  message: string;
  read: boolean;
  priority: "low" | "normal" | "high";
  createdAt: string;
  recipientEmail?: string;
  recipientRoles?: UserRole[];
  relatedJobId?: string;
  relatedJobSlug?: string;
  relatedJobTitle?: string;
  relatedApplicationId?: string;
  actionUrl?: string;
  jobUpdateDetails?: {
    updateType: "requirements" | "responsibilities" | "both";
    oldRequirements?: string[];
    newRequirements?: string[];
    oldResponsibilities?: string[];
    newResponsibilities?: string[];
  };
}

export interface AuditLog {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  resource: string;
  outcome: "allowed" | "denied" | "queued";
  at: string;
}

export interface DashboardMetrics {
  totalCandidates: number;
  activeOpenings: number;
  pendingContracts: number;
  totalEmployees: number;
  applicationsByStatus: Record<ApplicationStatus, number>;
}

export interface VerificationResult {
  status: CredentialStatus;
  publicId: string;
  recipientName?: string;
  credential?: string;
  position?: string;
  issuer?: string;
  issuedAt?: string;
  validUntil?: string;
}
