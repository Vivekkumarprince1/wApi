import {
  applications,
  auditLogs,
  certificates,
  employees,
  jobs,
  notifications,
  offers,
  recommendations,
  reviews,
} from "@/data/seed";
import type {
  Application,
  ApplicationStatus,
  AuthUser,
  Certificate,
  DashboardMetrics,
  EmploymentContract,
  Job,
  NotificationItem,
  OfferLetter,
  OfferStatus,
  Recommendation,
  Review,
  ScreeningQuestion,
  VerificationResult,
} from "@/types/career";
import { applicationReference } from "@/lib/utils";
import type {
  ApplicationAnswersInput,
  ApplicationFormInput,
  CertificateIssueInput,
  ContactInput,
  ContractDocumentInput,
  ContractStatusInput,
  ContractSubmissionInput,
  OfferIssueInput,
  OfferDecisionInput,
  QuestionInput,
  QuestionReorderInput,
  ReviewInput,
} from "@/lib/validators";
import { canAccessAdminArea, listAuthUsers } from "@/lib/auth-store";

type CareerStoreState = {
  applications: Application[];
  jobs: Job[];
  certificates: Certificate[];
  offers: OfferLetter[];
  recommendations: Recommendation[];
  reviews: Review[];
  notifications: NotificationItem[];
  contracts: EmploymentContract[];
};

const cloneSeed = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const careerGlobal = globalThis as typeof globalThis & {
  __connectSphereCareerStore?: CareerStoreState;
};

const store =
  careerGlobal.__connectSphereCareerStore ??
  (careerGlobal.__connectSphereCareerStore = {
    applications: cloneSeed(applications),
    jobs: cloneSeed(jobs),
    certificates: cloneSeed(certificates),
    offers: cloneSeed(offers),
    recommendations: cloneSeed(recommendations),
    reviews: cloneSeed(reviews),
    notifications: cloneSeed(notifications),
    contracts: [],
  });

const mutableApplications = store.applications;
const mutableJobs = store.jobs;
const mutableCertificates = store.certificates;
const mutableOffers = store.offers;
const mutableRecommendations = store.recommendations;
const mutableReviews = store.reviews;
const mutableNotifications = store.notifications;
const mutableContracts = store.contracts;

export function listJobs(filters?: {
  q?: string;
  location?: string;
  department?: string;
  type?: string;
}) {
  const query = filters?.q?.trim().toLowerCase();
  const location = filters?.location?.trim().toLowerCase();
  const department = filters?.department?.trim().toLowerCase();
  const type = filters?.type?.trim().toLowerCase();

  return mutableJobs
    .filter((job) => job.isActive)
    .filter((job) => {
      const haystack = [
        job.title,
        job.description,
        job.department,
        job.location,
        job.type,
        job.workMode,
      ]
        .join(" ")
        .toLowerCase();
      return !query || haystack.includes(query);
    })
    .filter((job) => !location || job.location.toLowerCase().includes(location))
    .filter((job) => !department || job.department.toLowerCase() === department)
    .filter((job) => !type || job.type.toLowerCase() === type)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function featuredJobs() {
  return listJobs()
    .filter((job) => job.isFeatured)
    .slice(0, 3);
}

export function getJobBySlug(slug: string) {
  return mutableJobs.find((job) => (job.slug === slug || job.id === slug) && job.isActive);
}

export function getJobById(id: string) {
  return mutableJobs.find((job) => job.id === id || job.slug === id);
}

export function deleteJob(id: string) {
  const job = getJobById(id);
  if (!job) throw new Error("Job not found.");
  job.isActive = false;
  return job;
}

export function listSortedJobs(sortBy?: string) {
  const allJobs = listJobs();
  if (sortBy === "applicants") return allJobs.sort((a, b) => b.applicantCount - a.applicantCount);
  if (sortBy === "title") return allJobs.sort((a, b) => a.title.localeCompare(b.title));
  if (sortBy === "department") return allJobs.sort((a, b) => a.department.localeCompare(b.department));
  return allJobs;
}

export function listJobQuestions(id: string) {
  const job = getJobById(id);
  if (!job) throw new Error("Job not found.");
  return [...job.questions].sort((a, b) => a.order - b.order);
}

export function addJobQuestion(id: string, input: QuestionInput) {
  const job = getJobById(id);
  if (!job) throw new Error("Job not found.");
  const question = {
    ...input,
    id: input.id || `q_${crypto.randomUUID()}`,
    order: job.questions.length,
  };
  job.questions.push(question);
  return question;
}

export function updateJobQuestion(jobId: string, questionId: string, input: QuestionInput) {
  const job = getJobById(jobId);
  if (!job) throw new Error("Job not found.");
  const index = job.questions.findIndex((question) => question.id === questionId);
  if (index === -1) throw new Error("Question not found.");
  job.questions[index] = {
    ...job.questions[index],
    ...input,
    id: questionId,
    order: job.questions[index].order,
  };
  return job.questions[index];
}

export function deleteJobQuestion(jobId: string, questionId: string) {
  const job = getJobById(jobId);
  if (!job) throw new Error("Job not found.");
  const index = job.questions.findIndex((question) => question.id === questionId);
  if (index === -1) throw new Error("Question not found.");
  job.questions.splice(index, 1);
  job.questions.forEach((question, order) => {
    question.order = order;
  });
  return { deleted: true };
}

export function reorderJobQuestions(jobId: string, input: QuestionReorderInput) {
  const job = getJobById(jobId);
  if (!job) throw new Error("Job not found.");
  const orderMap = new Map(input.questionIds.map((id, order) => [id, order]));
  job.questions.forEach((question) => {
    const order = orderMap.get(question.id);
    if (order !== undefined) question.order = order;
  });
  job.questions.sort((a, b) => a.order - b.order);
  return job.questions;
}

export function getRelatedJobs(job: Job) {
  return listJobs()
    .filter((candidate) => candidate.id !== job.id)
    .filter((candidate) => candidate.department === job.department || candidate.workMode === job.workMode)
    .slice(0, 3);
}

export function listApplications(filters?: { q?: string; status?: ApplicationStatus | "all"; jobId?: string }) {
  const query = filters?.q?.trim().toLowerCase();
  const status = filters?.status;
  const jobId = filters?.jobId;

  return mutableApplications
    .filter((application) => !status || status === "all" || application.status === status)
    .filter((application) => !jobId || application.jobId === jobId)
    .filter((application) => {
      const haystack = [
        application.reference,
        application.candidate.name,
        application.candidate.email,
        application.candidate.phone,
        application.jobTitle,
        application.skills.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function listCandidateApplications(email?: string) {
  const allApplications = listApplications();
  if (!email) return allApplications.slice(0, 3);
  return allApplications.filter((application) => application.candidate.email.toLowerCase() === email.toLowerCase());
}

export function listApplicationsForRecommendation(user: AuthUser) {
  const currentUserEmail = user.email.toLowerCase();
  const recommendedApplicationIds = new Set(
    mutableRecommendations.map((recommendation) => recommendation.applicationId).filter(Boolean),
  );

  return listApplications()
    .filter((application) => application.status === "pending" || application.status === "reviewing")
    .filter((application) => application.candidate.email.toLowerCase() !== currentUserEmail)
    .filter((application) => !application.isReferred)
    .filter((application) => !recommendedApplicationIds.has(application.id));
}

export function createApplication(input: ApplicationFormInput, user?: AuthUser) {
  const job = mutableJobs.find((candidate) => candidate.id === input.jobId || candidate.slug === input.jobSlug);
  if (!job || !job.isActive) {
    throw new Error("This job is not accepting applications.");
  }

  if (user && user.email.toLowerCase() !== input.email.toLowerCase()) {
    throw new Error("Application email must match the signed-in account.");
  }

  const duplicate = mutableApplications.some(
    (application) => application.jobId === job.id && application.candidate.email === input.email
  );
  if (duplicate) {
    throw new Error("You already have an application for this role.");
  }

  const now = new Date().toISOString();
  const application: Application = {
    id: `app_${crypto.randomUUID()}`,
    reference: applicationReference(),
    jobId: job.id,
    jobSlug: job.slug,
    jobTitle: job.title,
    candidate: {
      id: user?.id || `user_${input.email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
      name: input.fullName,
      email: input.email,
      phone: input.phone,
      location: input.location,
      verified: user?.verified ?? true,
      role: user?.role || "user"
    },
    resumeFileName: input.resumeFileName,
    experience: input.experience,
    education: input.education,
    skills: input.skills,
    coverLetter: input.coverLetter ?? "",
    questionAnswers: input.questionAnswers,
    isReferred: input.isReferred,
    referrerEmployeeId: input.isReferred ? input.referrerEmployeeId : undefined,
    referrerName: input.isReferred ? input.referrerName : undefined,
    referrerEmail: input.isReferred ? input.referrerEmail : undefined,
    referralMessage: input.isReferred ? input.referralMessage : undefined,
    status: "pending",
    statusHistory: [
      {
        from: "created",
        to: "pending",
        actor: "system",
        at: now,
        candidateMessage: "Application received. HR will review it shortly."
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  mutableApplications.unshift(application);
  return application;
}

export function getDashboardMetrics(): DashboardMetrics {
  const applicationsByStatus = mutableApplications.reduce(
    (acc, application) => {
      acc[application.status] += 1;
      return acc;
    },
    {
      pending: 0,
      reviewing: 0,
      shortlisted: 0,
      offered: 0,
      hired: 0,
      rejected: 0,
    } satisfies Record<ApplicationStatus, number>
  );

  return {
    totalCandidates: new Set(mutableApplications.map((application) => application.candidate.email)).size,
    activeOpenings: mutableJobs.filter((job) => job.isActive).length,
    pendingContracts: mutableOffers.filter((offer) => offer.status === "issued").length,
    totalEmployees: employees.filter((employee) => employee.status === "active").length,
    applicationsByStatus,
  };
}

export function getAdminDashboard() {
  return {
    metrics: getDashboardMetrics(),
    jobs: listJobs(),
    applications: listApplications(),
    offers: mutableOffers,
    certificates: mutableCertificates,
    recommendations: mutableRecommendations,
    employees,
    reviews: mutableReviews,
    auditLogs,
    users: listAuthUsers(),
    contracts: mutableContracts,
  };
}

function canAccessNotification(notification: NotificationItem, user?: AuthUser | null) {
  if (!user) return true;
  if (canAccessAdminArea(user)) return true;

  const emailMatches = notification.recipientEmail?.toLowerCase() === user.email.toLowerCase();
  const roleMatches = notification.recipientRoles?.includes(user.role);

  return Boolean((!notification.recipientEmail && !notification.recipientRoles?.length) || emailMatches || roleMatches);
}

export function getNotifications(user?: AuthUser | null) {
  return mutableNotifications.filter((notification) => canAccessNotification(notification, user));
}

export function getUnreadNotificationCount(user?: AuthUser | null) {
  return getNotifications(user).filter((notification) => !notification.read).length;
}

export function markNotificationRead(id: string, user?: AuthUser | null) {
  const notification = mutableNotifications.find((item) => item.id === id && canAccessNotification(item, user));
  if (!notification) throw new Error("Notification not found.");
  notification.read = true;
  return notification;
}

export function markAllNotificationsRead(user?: AuthUser | null) {
  const visibleNotifications = getNotifications(user);
  visibleNotifications.forEach((notification) => {
    notification.read = true;
  });
  return {
    updated: visibleNotifications.length,
    unread: getUnreadNotificationCount(user),
  };
}

export function deleteNotification(id: string, user?: AuthUser | null) {
  const index = mutableNotifications.findIndex((item) => item.id === id && canAccessNotification(item, user));
  if (index === -1) throw new Error("Notification not found.");
  mutableNotifications.splice(index, 1);
  return { deleted: true };
}

export function getApprovedReviews() {
  return mutableReviews.filter((review) => review.status === "approved");
}

export function listReviews(filters?: { status?: Review["status"]; q?: string }) {
  const status = filters?.status;
  const query = filters?.q?.trim().toLowerCase();
  return mutableReviews.filter((review) => {
    const haystack = [
      review.name,
      review.role,
      review.department,
      review.position,
      review.workType,
      review.employmentDuration,
      review.title,
      review.body,
      review.pros,
      review.cons,
      review.advice,
      review.status,
    ].join(" ").toLowerCase();
    return (!status || review.status === status) && (!query || haystack.includes(query));
  });
}

export function getReviewByUser(name: string) {
  return mutableReviews.find((review) => review.name.toLowerCase() === name.toLowerCase());
}

export function getReviewEligibility(user: AuthUser) {
  const eligible = user.role === "employee" && ["active", "former"].includes(user.status);
  const existingReview = getReviewByUser(user.name);
  return {
    eligible: eligible && !existingReview,
    reason: !eligible ? "Only active or former employees can submit reviews." : existingReview ? "A review has already been submitted." : null,
    existingReview,
  };
}

export function getOfferById(id: string) {
  return mutableOffers.find((offer) => offer.id === id || offer.publicId.toLowerCase() === id.toLowerCase());
}

export function listCertificates() {
  return [...mutableCertificates].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
}

export function getCertificateById(id: string) {
  return mutableCertificates.find((certificate) => certificate.id === id || certificate.publicId.toLowerCase() === id.toLowerCase());
}

function randomPublicId(prefix: "CRT" | "OFR") {
  const year = new Date().getFullYear();
  const code = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `${prefix}-CS-${year}-${code}`;
}

export function issueCertificate(input: CertificateIssueInput, issuer: string) {
  const now = new Date().toISOString();
  const certificate: Certificate = {
    id: `cert_${crypto.randomUUID()}`,
    publicId: randomPublicId("CRT"),
    recipientName: input.recipientName,
    credential: input.credential,
    role: input.role,
    issuer,
    fromDate: input.fromDate,
    toDate: input.toDate,
    issuedAt: now,
    status: "valid",
  };

  mutableCertificates.unshift(certificate);
  return certificate;
}

export function setCertificateStatus(id: string, status: Certificate["status"]) {
  const certificate = getCertificateById(id);
  if (!certificate) throw new Error("Certificate not found.");
  certificate.status = status;
  return certificate;
}

export function certificateArtifact(id: string) {
  const certificate = getCertificateById(id);
  if (!certificate) throw new Error("Certificate not found.");
  return [
    "ConnectSphere Certificate",
    `Public ID: ${certificate.publicId}`,
    `Recipient: ${certificate.recipientName}`,
    `Credential: ${certificate.credential}`,
    `Role: ${certificate.role}`,
    `Issued by: ${certificate.issuer}`,
    `Valid: ${certificate.fromDate} - ${certificate.toDate}`,
    `Status: ${certificate.status}`,
  ].join("\n");
}

export function listOffers() {
  return [...mutableOffers].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
}

export function issueOffer(input: OfferIssueInput, issuer: string) {
  const application = input.applicationId ? getApplicationById(input.applicationId) : undefined;
  const job = application ? getJobById(application.jobId) || getJobBySlug(application.jobSlug) : undefined;
  const now = new Date().toISOString();
  const offer = {
    id: `offer_${crypto.randomUUID()}`,
    publicId: randomPublicId("OFR"),
    applicationId: application?.id || input.applicationId || `manual_${crypto.randomUUID()}`,
    candidateName: input.candidateName || application?.candidate.name || "Candidate",
    candidateEmail: input.candidateEmail || application?.candidate.email,
    companyName: input.companyName || job?.company || "ConnectSphere",
    position: input.position || application?.jobTitle || "ConnectSphere role",
    department: input.department || "People Operations",
    salary: input.salary,
    startDate: input.startDate,
    validUntil: input.validUntil,
    workType: input.workType,
    offerType: input.offerType,
    payoutFrequency: input.payoutFrequency,
    joiningLocation: input.joiningLocation || job?.location,
    reportingManager: input.reportingManager || job?.reportingManager,
    benefits: input.benefits,
    status: "issued" as const,
    issuedAt: now,
    issuer,
  };

  mutableOffers.unshift(offer);

  if (application && application.status !== "offered") {
    transitionApplicationStatus(application.id, "offered", issuer, "Your offer letter has been issued.");
  }

  return offer;
}

export function setOfferValidUntil(id: string, validUntil: string) {
  const offer = getOfferById(id);
  if (!offer) throw new Error("Offer not found.");
  offer.validUntil = validUntil;
  if (offer.status === "expired") offer.status = "issued";
  return offer;
}

export function regenerateOfferToken(id: string) {
  const offer = getOfferById(id);
  if (!offer) throw new Error("Offer not found.");
  offer.publicId = randomPublicId("OFR");
  return offer;
}

export function offerArtifact(id: string) {
  const offer = getOfferById(id);
  if (!offer) throw new Error("Offer not found.");
  return [
    "ConnectSphere Offer Letter",
    `Public ID: ${offer.publicId}`,
    `Candidate: ${offer.candidateName}`,
    `Position: ${offer.position}`,
    `Department: ${offer.department}`,
    `Salary: ${offer.salary}`,
    `Start date: ${offer.startDate}`,
    `Valid until: ${offer.validUntil}`,
    `Work type: ${offer.workType}`,
    `Status: ${offer.status}`,
    `Issuer: ${offer.issuer}`,
  ].join("\n");
}

type AddressDetails = NonNullable<ContractSubmissionInput["addressDetails"]>;
type EmergencyContactDetails = NonNullable<ContractSubmissionInput["emergencyContactDetails"]>;
type IdentificationDocuments = NonNullable<ContractSubmissionInput["identificationDocuments"]>;
type BankingInfo = NonNullable<ContractSubmissionInput["bankingInfo"]>;
type AgreementTerms = NonNullable<ContractSubmissionInput["agreementTerms"]>;

function compactAddress(details?: AddressDetails) {
  const cityLine = [details?.city, details?.state, details?.zipCode].filter(Boolean).join(" ");
  return [details?.street, cityLine, details?.country].filter(Boolean).join(", ") || undefined;
}

function compactEmergencyContact(details?: EmergencyContactDetails) {
  const contactLine = [details?.relationship, details?.phone, details?.email].filter(Boolean).join(" - ");
  return [details?.name, contactLine].filter(Boolean).join(" - ") || undefined;
}

function lastFour(value?: string) {
  const normalized = value?.replace(/\s+/g, "");
  return normalized ? normalized.slice(-4) : undefined;
}

function consentFromAgreement(agreementTerms?: AgreementTerms) {
  return agreementTerms?.termsAccepted && agreementTerms?.privacyPolicyAccepted;
}

function deriveOnboardingSummaries(input: {
  address?: string;
  addressDetails?: AddressDetails;
  emergencyContact?: string;
  emergencyContactDetails?: EmergencyContactDetails;
  governmentIdType?: string;
  governmentIdLast4?: string;
  identificationDocuments?: IdentificationDocuments;
  bankName?: string;
  accountLast4?: string;
  bankingInfo?: BankingInfo;
  consentAccepted?: boolean;
  agreementTerms?: AgreementTerms;
}) {
  return {
    address: input.address || compactAddress(input.addressDetails),
    emergencyContact: input.emergencyContact || compactEmergencyContact(input.emergencyContactDetails),
    governmentIdType: input.governmentIdType || input.identificationDocuments?.idType,
    governmentIdLast4: input.governmentIdLast4 || lastFour(input.identificationDocuments?.idNumber),
    bankName: input.bankName || input.bankingInfo?.bankName,
    accountLast4: input.accountLast4 || lastFour(input.bankingInfo?.accountNumber),
    consentAccepted: input.consentAccepted ?? consentFromAgreement(input.agreementTerms),
  };
}

function ensureContractForOffer(offer: OfferLetter) {
  const existing = mutableContracts.find((contract) => contract.offerId === offer.id || contract.offerId === offer.publicId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const application = getApplicationById(offer.applicationId);
  const contract: EmploymentContract = {
    id: `contract_${crypto.randomUUID()}`,
    offerId: offer.id,
    applicationId: offer.applicationId,
    candidateName: offer.candidateName,
    candidateEmail: application?.candidate.email,
    status: "submitted",
    submittedAt: now,
    updatedAt: now,
    onboarding: {},
    documents: [],
  };

  mutableContracts.unshift(contract);
  return contract;
}

export function listContracts(filters?: { status?: EmploymentContract["status"]; q?: string }) {
  const status = filters?.status;
  const query = filters?.q?.trim().toLowerCase();

  return mutableContracts
    .filter((contract) => !status || contract.status === status)
    .filter((contract) => {
      const haystack = [
        contract.id,
        contract.candidateName,
        contract.candidateEmail,
        contract.applicationId,
        contract.offerId,
        contract.status,
      ]
        .join(" ")
        .toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getContractById(id: string) {
  return mutableContracts.find((contract) => contract.id === id || contract.offerId === id);
}

export function getContractByApplicationId(applicationId: string) {
  return mutableContracts.find((contract) => contract.applicationId === applicationId);
}

export function getOfferForAcceptance(token: string) {
  const offer = getOfferById(token);
  if (!offer) throw new Error("Offer not found.");
  return {
    offer,
    contract: mutableContracts.find((contract) => contract.offerId === offer.id),
  };
}

export function decideOffer(token: string, input: OfferDecisionInput) {
  const offer = getOfferById(token);
  if (!offer) throw new Error("Offer not found.");

  const contract = ensureContractForOffer(offer);
  const now = new Date().toISOString();
  const status = input.decision === "accepted" ? "accepted" : "rejected";
  const nextOnboarding = input.onboarding || {};
  const summaries = deriveOnboardingSummaries(nextOnboarding);

  setOfferStatus(offer.id, status);
  contract.decision = input.decision;
  contract.status = input.decision === "accepted" ? "submitted" : "rejected";
  contract.rejectionReason = input.rejectionReason;
  contract.updatedAt = now;
  contract.onboarding = {
    ...contract.onboarding,
    ...nextOnboarding,
    address: summaries.address || contract.onboarding.address,
    emergencyContact: summaries.emergencyContact || contract.onboarding.emergencyContact,
    governmentIdType: summaries.governmentIdType || contract.onboarding.governmentIdType,
    governmentIdLast4: summaries.governmentIdLast4 || contract.onboarding.governmentIdLast4,
    bankName: summaries.bankName || contract.onboarding.bankName,
    accountLast4: summaries.accountLast4 || contract.onboarding.accountLast4,
    consentAccepted: summaries.consentAccepted ?? contract.onboarding.consentAccepted,
  };

  if (input.documentName) {
    contract.documents.unshift({
      id: `doc_${crypto.randomUUID()}`,
      type: "candidate-upload",
      fileName: input.documentName,
      uploadedAt: now,
    });
  }

  const application = getApplicationById(offer.applicationId);
  if (application && input.decision === "accepted" && application.status !== "hired") {
    transitionApplicationStatus(application.id, "hired", "candidate", "Offer accepted and onboarding submitted.");
  }
  if (application && input.decision === "rejected" && application.status !== "rejected") {
    transitionApplicationStatus(application.id, "rejected", "candidate", input.rejectionReason || "Offer rejected by candidate.");
  }

  return { offer: getOfferById(offer.id), contract };
}

export function submitOfferContract(token: string, input: ContractSubmissionInput) {
  const offer = getOfferById(token);
  if (!offer) throw new Error("Offer not found.");

  const contract = ensureContractForOffer(offer);
  const now = new Date().toISOString();
  const summaries = deriveOnboardingSummaries(input);
  contract.status = "submitted";
  contract.decision = "accepted";
  contract.updatedAt = now;
  contract.onboarding = {
    ...contract.onboarding,
    phone: input.phone,
    dateOfBirth: input.dateOfBirth,
    nationality: input.nationality,
    address: summaries.address || contract.onboarding.address,
    addressDetails: input.addressDetails,
    emergencyContact: summaries.emergencyContact || contract.onboarding.emergencyContact,
    emergencyContactDetails: input.emergencyContactDetails,
    governmentIdType: summaries.governmentIdType || contract.onboarding.governmentIdType,
    governmentIdLast4: summaries.governmentIdLast4 || contract.onboarding.governmentIdLast4,
    identificationDocuments: input.identificationDocuments,
    bankName: summaries.bankName || contract.onboarding.bankName,
    accountLast4: summaries.accountLast4 || contract.onboarding.accountLast4,
    bankingInfo: input.bankingInfo,
    acceptanceComments: input.acceptanceComments,
    consentAccepted: summaries.consentAccepted ?? false,
    agreementTerms: input.agreementTerms,
  };
  contract.documents.unshift(
    ...input.documents.map((document) => ({
      id: `doc_${crypto.randomUUID()}`,
      type: document.type,
      fileName: document.fileName,
      uploadedAt: now,
    })),
  );
  setOfferStatus(offer.id, "accepted");
  const application = getApplicationById(offer.applicationId);
  if (application && application.status !== "hired") {
    transitionApplicationStatus(application.id, "hired", "candidate", "Offer accepted and onboarding submitted.");
  }
  return contract;
}

export function uploadContractDocument(contractId: string, input: ContractDocumentInput) {
  const contract = getContractById(contractId);
  if (!contract) throw new Error("Contract not found.");

  const document = {
    id: `doc_${crypto.randomUUID()}`,
    type: input.documentType,
    fileName: input.fileName,
    uploadedAt: new Date().toISOString(),
  };
  contract.documents.unshift(document);
  contract.updatedAt = document.uploadedAt;
  return { contract, document };
}

export function setContractStatus(contractId: string, input: ContractStatusInput, reviewer: string) {
  const contract = getContractById(contractId);
  if (!contract) throw new Error("Contract not found.");

  contract.status = input.status;
  contract.reviewNote = input.reviewNote;
  contract.reviewer = reviewer;
  contract.updatedAt = new Date().toISOString();

  if (input.status === "approved") {
    const application = getApplicationById(contract.applicationId);
    if (application && application.status !== "hired") {
      transitionApplicationStatus(application.id, "hired", reviewer, "Onboarding contract approved.");
    }
  }

  return contract;
}

export function contractArtifact(contractId: string) {
  const contract = getContractById(contractId);
  if (!contract) throw new Error("Contract not found.");

  return [
    "ConnectSphere Employment Contract",
    `Contract ID: ${contract.id}`,
    `Offer ID: ${contract.offerId}`,
    `Application ID: ${contract.applicationId}`,
    `Candidate: ${contract.candidateName}`,
    `Status: ${contract.status}`,
    `Submitted: ${contract.submittedAt}`,
    `Updated: ${contract.updatedAt}`,
    `Documents: ${contract.documents.map((document) => document.fileName).join(", ") || "none"}`,
    `Review note: ${contract.reviewNote || "none"}`,
  ].join("\n");
}

export function getApplicationById(id: string) {
  return mutableApplications.find((application) => application.id === id || application.reference === id);
}

export function getApplicationStatusForJob(jobId: string, email: string) {
  const application = mutableApplications.find(
    (item) => item.jobId === jobId && item.candidate.email.toLowerCase() === email.toLowerCase(),
  );
  return application
    ? {
        applied: true,
        applicationId: application.id,
        reference: application.reference,
        status: application.status,
        updatedAt: application.updatedAt,
      }
    : { applied: false, status: "Not Applied" };
}

export function getApplicationStatuses(email: string) {
  return mutableJobs.map((job) => ({
    jobId: job.id,
    jobSlug: job.slug,
    title: job.title,
    ...getApplicationStatusForJob(job.id, email),
  }));
}

export function getApplicationOffer(applicationId: string) {
  return mutableOffers.find((offer) => offer.applicationId === applicationId);
}

export function resumeAccess(applicationId: string, user: AuthUser) {
  const application = getApplicationById(applicationId);
  if (!application) throw new Error("Application not found.");
  const canAccess = user.email.toLowerCase() === application.candidate.email.toLowerCase() || user.permissions.canViewApplicants;
  if (!canAccess) throw new Error("You cannot access this resume.");
  return {
    fileName: application.resumeFileName,
    url: `/api/v1/applications/${application.id}/resume-access?download=1`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

export function updateApplicationAnswers(applicationId: string, input: ApplicationAnswersInput, user: AuthUser) {
  const application = getApplicationById(applicationId);
  if (!application) throw new Error("Application not found.");
  const canAccess = user.email.toLowerCase() === application.candidate.email.toLowerCase() || user.permissions.canViewApplicants;
  if (!canAccess) throw new Error("You cannot update this application.");
  application.questionAnswers = input.questionAnswers;
  application.updatedAt = new Date().toISOString();
  return application;
}

export function parseResumeDemo(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  return {
    fileName,
    parsedAt: new Date().toISOString(),
    candidateName: baseName.replace(/\b\w/g, (char) => char.toUpperCase()),
    skills: ["Communication", "Operations", "SaaS"],
    experience: "Demo parser extracted experience summary from the uploaded resume name.",
    confidence: 0.82,
  };
}

export function questionFileUploadDemo(fileName: string) {
  return {
    fileName,
    fileId: `question_file_${crypto.randomUUID()}`,
    uploadedAt: new Date().toISOString(),
    url: `/uploads/questions/${encodeURIComponent(fileName)}`,
  };
}

export function transitionApplicationStatus(
  id: string,
  status: ApplicationStatus,
  actor: string,
  candidateMessage?: string
) {
  const application = getApplicationById(id);
  if (!application) throw new Error("Application not found.");

  const now = new Date().toISOString();
  application.statusHistory.unshift({
    from: application.status,
    to: status,
    actor,
    at: now,
    candidateMessage,
  });
  application.status = status;
  application.updatedAt = now;
  return application;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeHrContact(input?: Partial<Job["hrContact"]>, fallback?: Job["hrContact"]): Job["hrContact"] {
  return {
    name: input?.name?.trim() || fallback?.name || "People Operations",
    email: input?.email?.trim() || fallback?.email || "careers@connectsphere.example",
    phone: input?.phone?.trim() || fallback?.phone,
  };
}

export function saveJob(input: {
  id?: string;
  title: string;
  company?: string;
  imageFileName?: string;
  imageUrl?: string;
  department: string;
  position: string;
  description: string;
  location: string;
  type: Job["type"];
  workMode: Job["workMode"];
  salary: string;
  reportingManager: string;
  requirements: string[];
  responsibilities: string[];
  questions: ScreeningQuestion[];
  isFeatured?: boolean;
  isActive?: boolean;
  hrContact?: Partial<Job["hrContact"]>;
}) {
  const existing = input.id ? getJobById(input.id) : undefined;
  const now = new Date().toISOString();
  const slug = existing?.slug || slugify(input.title);

  if (existing) {
    Object.assign(existing, {
      ...input,
      slug,
      company: input.company || existing.company || "ConnectSphere",
      imageFileName: input.imageFileName !== undefined ? input.imageFileName || undefined : existing.imageFileName,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl || undefined : existing.imageUrl,
      applicantCount: existing.applicantCount,
      createdAt: existing.createdAt,
      hrContact: normalizeHrContact(input.hrContact, existing.hrContact),
      isActive: input.isActive ?? existing.isActive,
      isFeatured: input.isFeatured ?? existing.isFeatured,
    });
    return existing;
  }

  const job: Job = {
    id: `job_${crypto.randomUUID()}`,
    slug,
    title: input.title,
    company: input.company || "ConnectSphere",
    imageFileName: input.imageFileName || undefined,
    imageUrl: input.imageUrl || undefined,
    department: input.department,
    position: input.position,
    description: input.description,
    requirements: input.requirements,
    responsibilities: input.responsibilities,
    location: input.location,
    type: input.type,
    workMode: input.workMode,
    salary: input.salary,
    reportingManager: input.reportingManager,
    isActive: input.isActive ?? true,
    isFeatured: input.isFeatured ?? false,
    hrContact: normalizeHrContact(input.hrContact),
    questions: input.questions,
    createdAt: now,
    applicantCount: 0,
  };

  mutableJobs.unshift(job);
  return job;
}

export function setOfferStatus(id: string, status: OfferStatus) {
  const offer = getOfferById(id);
  if (!offer) throw new Error("Offer not found.");
  offer.status = status;
  return offer;
}

export function listRecommendationsByUser(name: string) {
  return mutableRecommendations
    .filter((recommendation) => recommendation.recommender.toLowerCase() === name.toLowerCase())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function createRecommendation(input: { applicationId: string; rationale: string }, user: AuthUser) {
  if (user.status !== "active") throw new Error("Only active employees can make job recommendations.");

  const lookup = input.applicationId.trim().toLowerCase();
  const application = listApplicationsForRecommendation(user).find(
    (item) => item.id.toLowerCase() === lookup || item.reference.toLowerCase() === lookup,
  );
  if (!application) throw new Error("Application not found for recommendation.");

  const pendingCount = listRecommendationsByUser(user.name).filter((item) => item.status === "pending").length;
  if (pendingCount >= 5) throw new Error("You already have five pending recommendations.");

  const now = new Date().toISOString();
  const recommendation = {
    id: `rec_${crypto.randomUUID()}`,
    recommender: user.name,
    recommenderId: user.id,
    candidateName: application.candidate.name,
    candidateEmail: application.candidate.email,
    applicationId: application.id,
    applicationReference: application.reference,
    jobTitle: application.jobTitle,
    jobDepartment: mutableJobs.find((job) => job.id === application.jobId)?.department,
    rationale: input.rationale,
    status: "pending" as const,
    createdAt: now,
  };

  application.isReferred = true;
  application.referrerEmployeeId = user.id;
  application.referrerName = user.name;
  application.referrerEmail = user.email;
  application.referralMessage = input.rationale;
  application.updatedAt = now;

  mutableRecommendations.unshift(recommendation);
  return recommendation;
}

export function deleteRecommendation(id: string, user: AuthUser) {
  const index = mutableRecommendations.findIndex((recommendation) => recommendation.id === id);
  if (index === -1) throw new Error("Recommendation not found.");

  const recommendation = mutableRecommendations[index];
  if (recommendation.recommender.toLowerCase() !== user.name.toLowerCase()) {
    throw new Error("You can only delete your own recommendations.");
  }
  if (recommendation.status !== "pending") {
    throw new Error("Only pending recommendations can be deleted.");
  }

  mutableRecommendations.splice(index, 1);
  return { deleted: true };
}

export function setRecommendationStatus(id: string, status: Recommendation["status"], adminNotes?: string) {
  const recommendation = mutableRecommendations.find((item) => item.id === id);
  if (!recommendation) throw new Error("Recommendation not found.");
  recommendation.status = status;
  recommendation.reviewedAt = new Date().toISOString();
  if (adminNotes !== undefined) recommendation.adminNotes = adminNotes;
  return recommendation;
}

export function setReviewStatus(id: string, status: Review["status"]) {
  const review = mutableReviews.find((item) => item.id === id);
  if (!review) throw new Error("Review not found.");
  review.status = status;
  return review;
}

export function verifyCertificate(publicId: string): VerificationResult {
  const certificate = mutableCertificates.find((item) => item.publicId.toLowerCase() === publicId.toLowerCase());
  if (!certificate) {
    return { status: "not_found", publicId };
  }

  return {
    status: certificate.status,
    publicId: certificate.publicId,
    recipientName: certificate.recipientName,
    credential: certificate.credential,
    position: certificate.role,
    issuer: certificate.issuer,
    issuedAt: certificate.issuedAt,
    validUntil: certificate.toDate,
  };
}

export function verifyOffer(publicId: string): VerificationResult {
  const offer = mutableOffers.find((item) => item.publicId.toLowerCase() === publicId.toLowerCase());
  if (!offer) {
    return { status: "not_found", publicId };
  }

  return {
    status: offer.status === "accepted" || offer.status === "issued" ? "valid" : offer.status === "expired" ? "expired" : "revoked",
    publicId: offer.publicId,
    recipientName: offer.candidateName,
    credential: "Offer Letter",
    position: offer.position,
    issuer: offer.issuer,
    issuedAt: offer.issuedAt,
    validUntil: offer.validUntil,
  };
}

export function acceptContact(input: ContactInput) {
  return {
    id: `msg_${crypto.randomUUID()}`,
    status: "queued",
    subject: input.subject,
    receivedAt: new Date().toISOString(),
  };
}

export function acceptReview(input: ReviewInput, reviewerName = "Employee") {
  if (getReviewByUser(reviewerName)) {
    throw new Error("A review has already been submitted for this account.");
  }

  const review: Review = {
    id: `review_${crypto.randomUUID()}`,
    reviewerType: "employee",
    name: reviewerName,
    role: input.role,
    department: input.department || undefined,
    position: input.position || undefined,
    workType: input.workType || undefined,
    employmentDuration: input.employmentDuration || undefined,
    pros: input.pros || undefined,
    cons: input.cons || undefined,
    advice: input.advice || undefined,
    status: "pending",
    rating: input.rating,
    title: input.title,
    body: input.body,
    anonymous: input.anonymous,
    createdAt: new Date().toISOString(),
  };
  mutableReviews.unshift(review);
  return review;
}

export function updateReview(id: string, input: Partial<ReviewInput>) {
  const review = mutableReviews.find((item) => item.id === id);
  if (!review) throw new Error("Review not found.");
  if (input.rating !== undefined) review.rating = input.rating;
  if (input.title !== undefined) review.title = input.title;
  if (input.role !== undefined) review.role = input.role;
  if (input.body !== undefined) review.body = input.body;
  if (input.department !== undefined) review.department = input.department || undefined;
  if (input.position !== undefined) review.position = input.position || undefined;
  if (input.workType !== undefined) review.workType = input.workType || undefined;
  if (input.employmentDuration !== undefined) review.employmentDuration = input.employmentDuration || undefined;
  if (input.pros !== undefined) review.pros = input.pros || undefined;
  if (input.cons !== undefined) review.cons = input.cons || undefined;
  if (input.advice !== undefined) review.advice = input.advice || undefined;
  if (input.anonymous !== undefined) review.anonymous = input.anonymous;
  return review;
}

export function listRecommendations(filters?: { status?: Recommendation["status"]; q?: string }) {
  const status = filters?.status;
  const query = filters?.q?.trim().toLowerCase();
  return mutableRecommendations.filter((recommendation) => {
    const haystack = [
      recommendation.recommender,
      recommendation.recommenderId,
      recommendation.candidateName,
      recommendation.candidateEmail,
      recommendation.applicationId,
      recommendation.applicationReference,
      recommendation.jobTitle,
      recommendation.jobDepartment,
      recommendation.rationale,
      recommendation.status,
    ]
      .join(" ")
      .toLowerCase();
    return (!status || recommendation.status === status) && (!query || haystack.includes(query));
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function recommendationStats() {
  const byStatus = mutableRecommendations.reduce(
    (acc, recommendation) => {
      acc[recommendation.status] += 1;
      return acc;
    },
    { pending: 0, reviewed: 0, selected: 0, rejected: 0 },
  );
  return {
    total: mutableRecommendations.length,
    byStatus,
    pending: byStatus.pending,
    reviewed: byStatus.reviewed,
    selected: byStatus.selected,
    rejected: byStatus.rejected,
  };
}

export function linkExistingApplicationsToRecommendations() {
  let linkedCount = 0;

  mutableRecommendations.forEach((recommendation) => {
    if (recommendation.status !== "selected" || recommendation.applicationId || !recommendation.candidateEmail) return;

    const application = mutableApplications.find(
      (item) =>
        item.candidate.email.toLowerCase() === recommendation.candidateEmail?.toLowerCase() &&
        item.jobTitle.toLowerCase() === recommendation.jobTitle.toLowerCase(),
    );

    if (!application) return;

    recommendation.applicationId = application.id;
    recommendation.applicationReference = application.reference;
    recommendation.candidateName = application.candidate.name;
    recommendation.candidateEmail = application.candidate.email;
    recommendation.jobDepartment = mutableJobs.find((job) => job.id === application.jobId)?.department;

    application.isReferred = true;
    application.referrerEmployeeId = recommendation.recommenderId;
    application.referrerName = recommendation.recommender;
    application.referralMessage = recommendation.rationale;
    application.updatedAt = new Date().toISOString();
    linkedCount += 1;
  });

  return {
    linkedCount,
    applications: mutableApplications.length,
    recommendations: listRecommendations(),
    message: `Successfully linked ${linkedCount} recommendation${linkedCount === 1 ? "" : "s"} with applications.`,
  };
}

export {
  auditLogs,
  mutableCertificates as certificates,
  mutableContracts as contracts,
  employees,
  mutableJobs as jobs,
  mutableOffers as offers,
  mutableRecommendations as recommendations,
  mutableReviews as reviews,
};
