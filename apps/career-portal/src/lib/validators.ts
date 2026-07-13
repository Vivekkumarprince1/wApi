import { z } from "zod";

const phonePattern = /^(\+91)?[6-9]\d{9}$/;
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const dateValueSchema = z.string().datetime().or(z.string().regex(dateOnlyPattern));

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const firstText = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();

export const applicationFormSchema = z
  .object({
    jobId: z.string().min(1),
    jobSlug: z.string().min(1),
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone: z.string().trim().regex(phonePattern, "Use an Indian 10 digit mobile number or +91 format"),
    location: z.string().trim().min(2, "Enter your current location").max(120),
    resumeFileName: z.string().trim().min(1, "Attach your resume"),
    experience: z.string().trim().min(10, "Summarise your experience").max(4000),
    education: z.string().trim().min(3, "Add your education").max(4000),
    skills: z.array(z.string().trim().min(1).max(80)).min(1, "Add at least one skill").max(30),
    coverLetter: z.string().trim().min(1, "Cover letter is required").max(5000),
    questionAnswers: z
      .array(
        z.object({
          questionId: z.string(),
          questionText: z.string(),
          questionType: z.enum(["text", "multipleChoice", "checkbox", "file", "rating"]),
          answer: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]),
          fileUrl: z.string().trim().optional(),
        })
      )
      .default([]),
    privacyAccepted: z.boolean().refine(Boolean, "Accept the privacy notice"),
    captchaToken: z.string().min(1, "CAPTCHA is required"),
    isReferred: z.boolean().default(false),
    referrerEmployeeId: z.string().trim().max(80).optional().or(z.literal("")),
    referrerName: z.string().trim().max(100).optional().or(z.literal("")),
    referrerEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
    referralMessage: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((input, ctx) => {
    if (!input.isReferred) return;

    const requiredReferralFields: Array<[keyof typeof input, string]> = [
      ["referrerEmployeeId", "Enter the referrer's employee ID"],
      ["referrerName", "Enter the referrer's name"],
      ["referrerEmail", "Enter the referrer's email"],
      ["referralMessage", "Add the referral message"],
    ];

    for (const [field, message] of requiredReferralFields) {
      if (!String(input[field] || "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
      }
    }
  });

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  subject: z.string().trim().min(3).max(140),
  message: z.string().trim().min(20).max(3000),
});

const reviewFieldsSchema = z.object({
  rating: z.coerce.number().int().min(1, "Please select a rating").max(5),
  title: z.string().trim().min(4, "Review title is required").max(100),
  role: z.string().trim().min(2).max(120),
  body: z.string().trim().min(20, "Review content is required").max(1000),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
  workType: z.enum(["Remote", "On-site", "Hybrid"]).optional().or(z.literal("")),
  employmentDuration: z.string().trim().max(120).optional().or(z.literal("")),
  pros: z.string().trim().max(500).optional().or(z.literal("")),
  cons: z.string().trim().max(500).optional().or(z.literal("")),
  advice: z.string().trim().max(500).optional().or(z.literal("")),
  anonymous: z.boolean().default(false),
});

export const reviewSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const position = firstText(input.position);
  const department = firstText(input.department);
  return {
    ...input,
    role: firstText(input.role, position, department) || "Employee",
    body: firstText(input.body, input.content),
    anonymous: typeof input.anonymous === "boolean" ? input.anonymous : input.isAnonymous === true,
  };
}, reviewFieldsSchema);

export const reviewUpdateSchema = reviewFieldsSchema.partial();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().regex(phonePattern, "Use an Indian 10 digit mobile number or +91 format").optional().or(z.literal("")),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(128, "Password is too long")
    .regex(/[a-z]/, "Add a lowercase letter")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/\d/, "Add a number")
    .regex(/[^A-Za-z0-9]/, "Add a symbol"),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  otp: z.string().regex(/^\d{6}$/, "Enter the six-digit OTP"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  otp: z.string().regex(/^\d{6}$/, "Enter the six-digit OTP"),
  newPassword: registerSchema.shape.password,
});

export const jobEditorSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3).max(140),
  company: z.string().trim().min(2).max(140).default("ConnectSphere"),
  imageFileName: z.string().trim().max(240).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  department: z.string().trim().min(2).max(120),
  position: z.string().trim().min(2).max(140),
  description: z.string().trim().min(20).max(4000),
  location: z.string().trim().min(2).max(160),
  type: z.enum(["Full-time", "Part-time", "Contract", "Internship"]),
  workMode: z.enum(["Remote", "On-site", "Hybrid"]),
  salary: z.string().trim().min(2).max(120),
  reportingManager: z.string().trim().min(2).max(120),
  requirements: z.array(z.string().trim().min(2).max(240)).min(1),
  responsibilities: z.array(z.string().trim().min(2).max(240)).min(1),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  questions: z.array(
    z.object({
      id: z.string().min(1),
      questionText: z.string().trim().min(4).max(240),
      questionType: z.enum(["text", "multipleChoice", "checkbox", "file", "rating"]),
      required: z.boolean().default(false),
      options: z.array(z.string().trim().min(1).max(80)).optional(),
      allowFileUpload: z.boolean().optional(),
      maxRating: z.number().int().min(1).max(10).optional(),
      order: z.number().int().min(0),
    })
  ),
  hrContact: z
    .object({
      name: z.string().trim().max(100).optional().or(z.literal("")),
      email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
      phone: z.string().trim().max(30).optional().or(z.literal("")),
    })
    .optional(),
});

export const questionSchema = z.object({
  id: z.string().optional(),
  questionText: z.string().trim().min(4).max(240),
  questionType: z.enum(["text", "multipleChoice", "checkbox", "file", "rating"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(80)).optional(),
  allowFileUpload: z.boolean().optional(),
  maxRating: z.number().int().min(1).max(10).optional(),
  order: z.number().int().min(0).optional().default(0),
});

export const questionReorderSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1),
});

export const applicationStatusSchema = z.object({
  status: z.enum(["pending", "reviewing", "shortlisted", "offered", "hired", "rejected"]),
  candidateMessage: z.string().trim().max(500).optional(),
});

const answerValueSchema = z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]);

const questionAnswerSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  questionType: z.enum(["text", "multipleChoice", "checkbox", "file", "rating"]),
  answer: answerValueSchema,
  fileUrl: z.string().trim().optional(),
});

export const applicationAnswersSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return { questionAnswers: value };
  }

  if (value && typeof value === "object" && "answers" in value && !("questionAnswers" in value)) {
    const answers = (value as { answers?: unknown }).answers;
    if (answers && typeof answers === "object" && !Array.isArray(answers)) {
      return {
        questionAnswers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          questionText: questionId,
          questionType: Array.isArray(answer) ? "checkbox" : typeof answer === "number" ? "rating" : "text",
          answer,
        })),
      };
    }
  }

  return value;
}, z.object({
  questionAnswers: z.array(questionAnswerSchema),
}));

export const fileNameSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
});

export const recommendationSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  return {
    ...input,
    rationale: firstText(input.rationale, input.recommendationMessage),
  };
}, z.object({
  applicationId: z.string().trim().min(1, "Enter an application ID"),
  rationale: z.string().trim().min(20, "Add a useful recommendation note").max(500),
}));

export const recommendationStatusSchema = z.object({
  status: z.enum(["pending", "reviewed", "selected", "rejected"]),
  adminNotes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const reviewStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

const permissionSetSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    canGenerateCertificate: z.boolean().optional(),
    canGenerateOfferLetter: z.boolean().optional(),
    canCreateJob: z.boolean().optional(),
    canViewApplicants: z.boolean().optional(),
    canManageReviews: z.boolean().optional(),
    canManageEmployees: z.boolean().optional(),
    canManageRecommendations: z.boolean().optional(),
    canAccessDashboard: z.boolean().optional(),
  }).transform((permissions) => ({
    canGenerateCertificate: permissions.canGenerateCertificate ?? false,
    canGenerateOfferLetter: permissions.canGenerateOfferLetter ?? false,
    canCreateJob: permissions.canCreateJob ?? false,
    canViewApplicants: permissions.canViewApplicants ?? false,
    canManageReviews: permissions.canManageReviews ?? false,
    canManageEmployees: permissions.canManageEmployees ?? false,
    canManageRecommendations: permissions.canManageRecommendations ?? false,
    canAccessDashboard: permissions.canAccessDashboard ?? false,
  })),
);

export const userManagementSchema = z.object({
  status: z.enum(["active", "inactive", "former", "suspended"]).optional(),
  role: z.enum(["user", "employee", "admin", "super-admin"]).optional(),
  department: z.string().trim().min(2).max(120).optional(),
  position: z.string().trim().min(2).max(120).optional(),
  manager: z.string().trim().max(120).optional(),
  permissions: permissionSetSchema.optional(),
});

export const hrCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional(),
  department: z.string().trim().min(2).max(120).default("HR"),
  position: z.string().trim().min(2).max(120).default("People Operations"),
  manager: z.string().trim().max(120).optional(),
  permissions: permissionSetSchema,
});

const certificateIssueOutputSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  recipientEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  credential: z.string().trim().min(3).max(160),
  role: z.string().trim().min(2).max(140),
  fromDate: dateValueSchema,
  toDate: dateValueSchema,
});

export const certificateIssueSchema = z
  .object({
    recipientName: z.string().trim().min(2).max(120),
    recipientEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
    credential: z.string().trim().max(160).optional(),
    title: z.string().trim().max(160).optional(),
    type: z.string().trim().max(160).optional(),
    role: z.string().trim().max(140).optional(),
    position: z.string().trim().max(140).optional(),
    fromDate: dateValueSchema.optional(),
    startDate: dateValueSchema.optional(),
    toDate: dateValueSchema.optional(),
    endDate: dateValueSchema.optional(),
    validUntil: dateValueSchema.optional(),
  })
  .transform((input) => {
    const credential = firstText(input.credential, input.title, input.type) || "ConnectSphere credential";
    return {
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      credential,
      role: firstText(input.role, input.position, input.type) || credential,
      fromDate: input.fromDate || input.startDate || addDays(0),
      toDate: input.toDate || input.endDate || input.validUntil || addDays(365),
    };
  })
  .pipe(certificateIssueOutputSchema);

export const certificateStatusSchema = z.object({
  status: z.enum(["valid", "expired", "revoked"]),
});

const offerIssueOutputSchema = z.object({
  applicationId: z.string().trim().optional(),
  candidateName: z.string().trim().min(2).max(120).optional(),
  candidateEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  companyName: z.string().trim().max(120).optional(),
  position: z.string().trim().min(2).max(140),
  department: z.string().trim().min(2).max(120),
  salary: z.string().trim().min(2).max(120),
  startDate: dateValueSchema,
  validUntil: dateValueSchema,
  workType: z.enum(["Remote", "On-site", "Hybrid"]),
  offerType: z.string().trim().max(80).optional(),
  payoutFrequency: z.string().trim().max(80).optional(),
  joiningLocation: z.string().trim().max(160).optional(),
  reportingManager: z.string().trim().max(120).optional(),
  benefits: z.array(z.string().trim().min(1).max(120)).optional(),
});

export const offerIssueSchema = z
  .object({
    applicationId: z.string().trim().optional(),
    candidateName: z.string().trim().max(120).optional(),
    candidateEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
    companyName: z.string().trim().max(120).optional(),
    position: z.string().trim().max(140).optional(),
    role: z.string().trim().max(140).optional(),
    title: z.string().trim().max(140).optional(),
    department: z.string().trim().max(120).optional(),
    salary: z.string().trim().max(120).optional(),
    startDate: dateValueSchema.optional(),
    joiningDate: dateValueSchema.optional(),
    joinDate: dateValueSchema.optional(),
    validUntil: dateValueSchema.optional(),
    expiresAt: dateValueSchema.optional(),
    workType: z.enum(["Remote", "On-site", "Hybrid"]).optional(),
    workMode: z.enum(["Remote", "On-site", "Hybrid"]).optional(),
    offerType: z.string().trim().max(80).optional(),
    payoutFrequency: z.string().trim().max(80).optional(),
    joiningLocation: z.string().trim().max(160).optional(),
    reportingManager: z.string().trim().max(120).optional(),
    benefits: z.array(z.string().trim().min(1).max(120)).optional(),
  })
  .transform((input) => ({
    applicationId: input.applicationId,
    candidateName: firstText(input.candidateName),
    candidateEmail: input.candidateEmail,
    companyName: firstText(input.companyName),
    position: firstText(input.position, input.role, input.title) || "ConnectSphere role",
    department: firstText(input.department) || "People Operations",
    salary: firstText(input.salary) || "As discussed",
    startDate: input.startDate || input.joiningDate || input.joinDate || addDays(30),
    validUntil: input.validUntil || input.expiresAt || addDays(14),
    workType: input.workType || input.workMode || "Hybrid",
    offerType: firstText(input.offerType),
    payoutFrequency: firstText(input.payoutFrequency),
    joiningLocation: firstText(input.joiningLocation),
    reportingManager: firstText(input.reportingManager),
    benefits: input.benefits,
  }))
  .pipe(offerIssueOutputSchema);

export const offerStatusSchema = z.object({
  status: z.enum(["issued", "accepted", "rejected", "expired", "cancelled"]),
});

export const offerExtendSchema = z.object({
  validUntil: dateValueSchema,
});

const addressDetailsSchema = z.object({
  street: z.string().trim().max(220).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  zipCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(80).optional(),
});

const emergencyContactDetailsSchema = z.object({
  name: z.string().trim().max(120).optional(),
  relationship: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
});

const identificationDocumentsSchema = z.object({
  idType: z.string().trim().max(80).optional(),
  idNumber: z.string().trim().max(80).optional(),
});

const bankingInfoSchema = z.object({
  accountHolderName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(80).optional(),
  bankName: z.string().trim().max(120).optional(),
  ifscCode: z.string().trim().max(40).optional(),
  accountType: z.string().trim().max(40).optional(),
  branch: z.string().trim().max(120).optional(),
});

const agreementTermsSchema = z.object({
  termsAccepted: z.boolean().optional(),
  privacyPolicyAccepted: z.boolean().optional(),
  acceptedAt: z.string().trim().max(80).optional(),
  ipAddress: z.string().trim().max(80).optional(),
});

const onboardingSchema = z.object({
  phone: z.string().trim().max(40).optional(),
  dateOfBirth: dateValueSchema.optional(),
  nationality: z.string().trim().max(80).optional(),
  address: z.string().trim().max(500).optional(),
  addressDetails: addressDetailsSchema.optional(),
  emergencyContact: z.string().trim().max(220).optional(),
  emergencyContactDetails: emergencyContactDetailsSchema.optional(),
  governmentIdType: z.string().trim().max(80).optional(),
  governmentIdLast4: z.string().trim().max(4).optional(),
  identificationDocuments: identificationDocumentsSchema.optional(),
  bankName: z.string().trim().max(120).optional(),
  accountLast4: z.string().trim().max(4).optional(),
  bankingInfo: bankingInfoSchema.optional(),
  acceptanceComments: z.string().trim().max(1000).optional(),
  consentAccepted: z.boolean().optional(),
  agreementTerms: agreementTermsSchema.optional(),
});

export const offerDecisionSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  documentName: z.string().trim().max(180).optional(),
  rejectionReason: z.string().trim().max(800).optional(),
  onboarding: onboardingSchema.optional(),
});

export const contractSubmissionSchema = z.object({
  phone: z.string().trim().max(40).optional(),
  dateOfBirth: dateValueSchema.optional(),
  nationality: z.string().trim().max(80).optional(),
  address: z.string().trim().max(500).optional(),
  addressDetails: addressDetailsSchema.optional(),
  emergencyContact: z.string().trim().max(220).optional(),
  emergencyContactDetails: emergencyContactDetailsSchema.optional(),
  governmentIdType: z.string().trim().max(80).optional(),
  governmentIdLast4: z.string().trim().max(4).optional(),
  identificationDocuments: identificationDocumentsSchema.optional(),
  bankName: z.string().trim().max(120).optional(),
  accountLast4: z.string().trim().max(4).optional(),
  bankingInfo: bankingInfoSchema.optional(),
  acceptanceComments: z.string().trim().max(1000).optional(),
  consentAccepted: z.boolean().default(false),
  agreementTerms: agreementTermsSchema.optional(),
  documents: z
    .array(
      z.object({
        type: z.string().trim().min(1).max(80),
        fileName: z.string().trim().min(1).max(220),
      }),
    )
    .optional()
    .default([]),
});

export const contractStatusSchema = z.object({
  status: z.enum(["submitted", "under_review", "approved", "rejected", "requires_changes"]),
  reviewNote: z.string().trim().max(1000).optional(),
});

export const contractDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(80).default("supporting-document"),
  fileName: z.string().trim().min(1).max(220),
});

export type ApplicationFormInput = z.infer<typeof applicationFormSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type JobEditorInput = z.infer<typeof jobEditorSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type QuestionReorderInput = z.infer<typeof questionReorderSchema>;
export type ApplicationAnswersInput = z.infer<typeof applicationAnswersSchema>;
export type RecommendationInput = z.infer<typeof recommendationSchema>;
export type HrCreateInput = z.infer<typeof hrCreateSchema>;
export type CertificateIssueInput = z.infer<typeof certificateIssueSchema>;
export type OfferIssueInput = z.infer<typeof offerIssueSchema>;
export type OfferDecisionInput = z.infer<typeof offerDecisionSchema>;
export type ContractSubmissionInput = z.infer<typeof contractSubmissionSchema>;
export type ContractStatusInput = z.infer<typeof contractStatusSchema>;
export type ContractDocumentInput = z.infer<typeof contractDocumentSchema>;
