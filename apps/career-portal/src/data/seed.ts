import type {
  Application,
  AuditLog,
  Certificate,
  Employee,
  Job,
  NotificationItem,
  OfferLetter,
  Recommendation,
  Review,
} from "@/types/career";

export const jobs: Job[] = [
  {
    id: "job_cs_product_engineer",
    slug: "whatsapp-automation-product-engineer",
    title: "WhatsApp Automation Product Engineer",
    company: "ConnectSphere",
    department: "Product Engineering",
    position: "Senior Frontend / Full-stack Engineer",
    description:
      "Build the campaign, inbox, automation, and commerce surfaces used by businesses to manage high-trust WhatsApp customer journeys.",
    requirements: [
      "4+ years building React or Next.js products with TypeScript",
      "Strong grasp of state management, API contracts, accessibility, and performance",
      "Experience translating ambiguous operational workflows into simple interfaces",
      "Comfort working with event-driven services and product analytics"
    ],
    responsibilities: [
      "Ship customer-facing automation builders, inbox workflows, and analytics surfaces",
      "Partner with backend engineers on API shape, validation, and realtime updates",
      "Own frontend quality gates, accessibility reviews, and design-system consistency",
      "Mentor engineers through pragmatic reviews and product-minded trade-offs"
    ],
    location: "Bengaluru / Remote India",
    type: "Full-time",
    workMode: "Hybrid",
    salary: "₹28L - ₹42L",
    reportingManager: "Head of Product Engineering",
    isActive: true,
    isFeatured: true,
    hrContact: {
      name: "Aparna Mehta",
      email: "careers@connectsphere.example",
      phone: "+919876543210"
    },
    questions: [
      {
        id: "q_fe_systems",
        questionText: "Describe a complex workflow UI you simplified. What changed for users?",
        questionType: "text",
        required: true,
        order: 0
      },
      {
        id: "q_stack_depth",
        questionText: "Which areas can you own independently?",
        questionType: "checkbox",
        required: true,
        options: ["Next.js App Router", "Node API design", "Realtime UX", "Design systems"],
        order: 1
      },
      {
        id: "q_confidence",
        questionText: "Rate your comfort debugging production frontend issues.",
        questionType: "rating",
        required: true,
        maxRating: 5,
        order: 2
      }
    ],
    createdAt: "2026-07-04T08:30:00.000Z",
    applicantCount: 38
  },
  {
    id: "job_customer_success",
    slug: "customer-success-manager",
    title: "Customer Success Manager",
    company: "ConnectSphere",
    department: "Customer Success",
    position: "Manager",
    description:
      "Help restaurants, retailers, and service businesses launch WhatsApp commerce, templates, automations, and support workflows with confidence.",
    requirements: [
      "3+ years in B2B SaaS customer success or implementation",
      "Excellent communication in English and Hindi; regional language is a plus",
      "Comfort with CRM, support tooling, and structured customer documentation",
      "Ability to identify expansion opportunities without losing trust"
    ],
    responsibilities: [
      "Own onboarding plans and adoption milestones for strategic customers",
      "Run template, campaign, and integration readiness reviews",
      "Track customer health signals, risks, and renewal actions with clear handoffs",
      "Bring customer feedback into product planning with clear evidence"
    ],
    location: "Delhi NCR",
    type: "Full-time",
    workMode: "On-site",
    salary: "₹12L - ₹18L",
    reportingManager: "Director, Customer Operations",
    isActive: true,
    isFeatured: true,
    hrContact: {
      name: "Ishaan Kapoor",
      email: "success-hiring@connectsphere.example"
    },
    questions: [
      {
        id: "q_customer_save",
        questionText: "Share an example where you recovered a risky customer relationship.",
        questionType: "text",
        required: true,
        order: 0
      },
      {
        id: "q_segments",
        questionText: "Which customer segments have you supported?",
        questionType: "multipleChoice",
        required: true,
        options: ["SMB", "Mid-market", "Enterprise", "Agency partners"],
        order: 1
      }
    ],
    createdAt: "2026-07-03T09:30:00.000Z",
    applicantCount: 64
  },
  {
    id: "job_growth_ads",
    slug: "meta-ads-growth-specialist",
    title: "Meta Ads Growth Specialist",
    company: "ConnectSphere",
    department: "Growth",
    position: "Performance Marketer",
    description:
      "Build click-to-WhatsApp growth experiments and help customers turn paid acquisition into measurable conversations and commerce.",
    requirements: [
      "2+ years running Meta ads for lead generation or commerce",
      "Working knowledge of pixels, catalogs, UTMs, landing pages, and funnel reporting",
      "Clear writing for campaign hypotheses, results, and customer recommendations",
      "Comfort collaborating with product and customer success teams"
    ],
    responsibilities: [
      "Design and operate campaign playbooks for high-intent WhatsApp conversations",
      "Analyse CAC, conversion, and message quality by customer segment",
      "Create enablement material for customer-facing teams",
      "Feed learnings into ConnectSphere's ads and commerce roadmap"
    ],
    location: "Mumbai / Remote India",
    type: "Full-time",
    workMode: "Remote",
    salary: "₹10L - ₹16L",
    reportingManager: "VP Growth",
    isActive: true,
    isFeatured: false,
    hrContact: {
      name: "Rhea Sood",
      email: "growth-hiring@connectsphere.example"
    },
    questions: [
      {
        id: "q_best_campaign",
        questionText: "What is the best campaign you ran, and what made it work?",
        questionType: "text",
        required: true,
        order: 0
      }
    ],
    createdAt: "2026-06-30T10:30:00.000Z",
    applicantCount: 29
  },
  {
    id: "job_ops_associate",
    slug: "people-operations-associate",
    title: "People Operations Associate",
    company: "ConnectSphere",
    department: "People Operations",
    position: "Associate",
    description:
      "Coordinate hiring operations, onboarding documents, employee letters, and people records with strong process hygiene.",
    requirements: [
      "1+ year in HR operations, recruiting coordination, or administration",
      "High attention to document accuracy, privacy, and follow-through",
      "Comfort with spreadsheets, ATS workflows, and email coordination",
      "Clear written communication with candidates and internal stakeholders"
    ],
    responsibilities: [
      "Maintain job postings, application records, and candidate communications",
      "Coordinate offer letters, onboarding checklists, and completion paperwork",
      "Prepare weekly hiring reports and clear change records",
      "Support referral, review, and employee profile workflows"
    ],
    location: "Hoshiarpur, Punjab",
    type: "Full-time",
    workMode: "On-site",
    salary: "₹4.8L - ₹7.2L",
    reportingManager: "People Operations Lead",
    isActive: true,
    isFeatured: false,
    hrContact: {
      name: "Mira Bedi",
      email: "people@connectsphere.example"
    },
    questions: [
      {
        id: "q_hr_tools",
        questionText: "Which HR or operations tools have you used?",
        questionType: "checkbox",
        required: false,
        options: ["ATS", "HRMS", "Google Workspace", "PDF/e-sign tools", "Payroll tools"],
        order: 0
      }
    ],
    createdAt: "2026-06-28T07:30:00.000Z",
    applicantCount: 47
  }
];

export const applications: Application[] = [
  {
    id: "app_asha",
    reference: "APP-20260704-A91C",
    jobId: "job_cs_product_engineer",
    jobSlug: "whatsapp-automation-product-engineer",
    jobTitle: "WhatsApp Automation Product Engineer",
    candidate: {
      id: "user_asha",
      name: "Asha Sharma",
      email: "asha.sharma@example.com",
      phone: "+919876543210",
      location: "Bengaluru",
      verified: true,
      role: "user"
    },
    resumeFileName: "asha-sharma-product-engineer.pdf",
    experience: "5 years building high-volume SaaS workflow products in React and Node.",
    education: "B.Tech Computer Science, UIET",
    skills: ["Next.js", "TypeScript", "Realtime UX", "Design systems"],
    coverLetter: "I like turning operational complexity into interfaces that customer-facing teams trust every day.",
    questionAnswers: [
      {
        questionId: "q_fe_systems",
        questionText: "Describe a complex workflow UI you simplified. What changed for users?",
        questionType: "text",
        answer: "Merged three disconnected approval screens into one workflow with visible handoffs and audit history."
      }
    ],
    status: "shortlisted",
    statusHistory: [
      {
        from: "created",
        to: "pending",
        actor: "system",
        at: "2026-07-04T10:30:00.000Z"
      },
      {
        from: "pending",
        to: "reviewing",
        actor: "Aparna Mehta",
        at: "2026-07-05T09:15:00.000Z",
        reasonCode: "PROFILE_COMPLETE"
      },
      {
        from: "reviewing",
        to: "shortlisted",
        actor: "Aparna Mehta",
        at: "2026-07-06T11:20:00.000Z",
        reasonCode: "MEETS_CORE_REQUIREMENTS"
      }
    ],
    reviewerNotes: "Strong workflow design instincts and production debugging experience.",
    score: 89,
    aiSummary: "Advisory match: high overlap with Next.js, workflow UX, and realtime debugging needs.",
    createdAt: "2026-07-04T10:30:00.000Z",
    updatedAt: "2026-07-06T11:20:00.000Z"
  },
  {
    id: "app_rohan",
    reference: "APP-20260703-4F8B",
    jobId: "job_customer_success",
    jobSlug: "customer-success-manager",
    jobTitle: "Customer Success Manager",
    candidate: {
      id: "user_rohan",
      name: "Rohan Malhotra",
      email: "rohan.m@example.com",
      phone: "+919998887776",
      location: "Gurugram",
      verified: true,
      role: "user"
    },
    resumeFileName: "rohan-malhotra-csm.docx",
    experience: "4 years managing SaaS onboarding for SMB and mid-market accounts.",
    education: "MBA Marketing",
    skills: ["Onboarding", "CRM", "QBRs", "Hindi", "Expansion"],
    coverLetter: "I enjoy building structured onboarding plans that reduce uncertainty for customers.",
    questionAnswers: [
      {
        questionId: "q_customer_save",
        questionText: "Share an example where you recovered a risky customer relationship.",
        questionType: "text",
        answer: "Created a 21-day adoption plan, reset executive expectations, and recovered renewal."
      }
    ],
    status: "offered",
    statusHistory: [
      {
        from: "created",
        to: "pending",
        actor: "system",
        at: "2026-07-03T12:00:00.000Z"
      },
      {
        from: "pending",
        to: "reviewing",
        actor: "Ishaan Kapoor",
        at: "2026-07-04T12:00:00.000Z"
      },
      {
        from: "reviewing",
        to: "shortlisted",
        actor: "Ishaan Kapoor",
        at: "2026-07-05T14:20:00.000Z"
      },
      {
        from: "shortlisted",
        to: "offered",
        actor: "Ishaan Kapoor",
        at: "2026-07-07T09:10:00.000Z",
        candidateMessage: "Your offer is ready for review."
      }
    ],
    reviewerNotes: "Excellent customer rescue story. Offer issued.",
    score: 82,
    aiSummary: "Advisory match: strong CS playbook experience; moderate product depth.",
    createdAt: "2026-07-03T12:00:00.000Z",
    updatedAt: "2026-07-07T09:10:00.000Z"
  },
  {
    id: "app_neha",
    reference: "APP-20260705-73AD",
    jobId: "job_growth_ads",
    jobSlug: "meta-ads-growth-specialist",
    jobTitle: "Meta Ads Growth Specialist",
    candidate: {
      id: "user_neha",
      name: "Neha Iyer",
      email: "neha.iyer@example.com",
      phone: "+918877665544",
      location: "Mumbai",
      verified: true,
      role: "user"
    },
    resumeFileName: "neha-iyer-growth.pdf",
    experience: "2.5 years running Meta campaigns for D2C commerce brands.",
    education: "BMS Marketing",
    skills: ["Meta Ads", "Catalogs", "UTM analysis", "Landing pages"],
    coverLetter: "I want to help brands turn conversations into measurable revenue.",
    questionAnswers: [],
    status: "reviewing",
    statusHistory: [
      {
        from: "created",
        to: "pending",
        actor: "system",
        at: "2026-07-05T08:00:00.000Z"
      },
      {
        from: "pending",
        to: "reviewing",
        actor: "Rhea Sood",
        at: "2026-07-06T08:20:00.000Z"
      }
    ],
    score: 74,
    aiSummary: "Advisory match: strong paid growth background, needs more WhatsApp commerce detail.",
    createdAt: "2026-07-05T08:00:00.000Z",
    updatedAt: "2026-07-06T08:20:00.000Z"
  }
];

export const offers: OfferLetter[] = [
  {
    id: "offer_rohan",
    publicId: "OFR-CSM-2026-018",
    applicationId: "app_rohan",
    candidateName: "Rohan Malhotra",
    position: "Customer Success Manager",
    department: "Customer Success",
    salary: "₹15L fixed + performance bonus",
    startDate: "2026-08-01T00:00:00.000Z",
    validUntil: "2026-07-18T18:29:59.000Z",
    workType: "On-site",
    status: "issued",
    issuedAt: "2026-07-07T09:10:00.000Z",
    issuer: "Ishaan Kapoor"
  }
];

export const certificates: Certificate[] = [
  {
    id: "cert_tara",
    publicId: "CRT-CS-2026-044",
    recipientName: "Tara Singh",
    credential: "Customer Success Internship Completion",
    role: "Customer Success Intern",
    issuer: "ConnectSphere People Operations",
    fromDate: "2026-01-05T00:00:00.000Z",
    toDate: "2026-06-30T00:00:00.000Z",
    issuedAt: "2026-07-01T10:30:00.000Z",
    status: "valid"
  }
];

export const reviews: Review[] = [
  {
    id: "review_1",
    reviewerType: "employee",
    name: "Current team member",
    role: "Product Engineering",
    rating: 5,
    title: "High ownership without chaos",
    body: "The strongest part of the culture is how directly engineers work with customer problems. Reviews are demanding, but decisions stay practical.",
    anonymous: true,
    status: "approved"
  },
  {
    id: "review_2",
    reviewerType: "employee",
    name: "Meera N.",
    role: "Customer Success",
    rating: 4,
    title: "Fast feedback loops",
    body: "Customer-facing teams get a genuine voice in product direction. The pace is high, so documentation discipline matters.",
    anonymous: false,
    status: "approved"
  },
  {
    id: "review_3",
    reviewerType: "offer-recipient",
    name: "Anonymous candidate",
    role: "Growth",
    rating: 4,
    title: "Respectful interview process",
    body: "The process was structured, and each stage had clear next steps. I appreciated getting written feedback quickly.",
    anonymous: true,
    status: "approved"
  }
];

export const recommendations: Recommendation[] = [
  {
    id: "rec_1",
    recommender: "Tara Singh",
    candidateName: "Priya Menon",
    jobTitle: "People Operations Associate",
    rationale: "Worked with Priya on campus hiring logistics; she is detail-oriented and calm under deadlines.",
    status: "pending",
    createdAt: "2026-07-08T10:00:00.000Z"
  }
];

export const employees: Employee[] = [
  {
    id: "emp_1",
    name: "Aparna Mehta",
    email: "aparna@connectsphere.example",
    department: "Product Engineering",
    position: "Head of Product Engineering",
    manager: "CEO",
    status: "active",
    permissions: ["canAccessDashboard", "canViewApplicants", "canGenerateOfferLetter"]
  },
  {
    id: "emp_2",
    name: "Mira Bedi",
    email: "mira@connectsphere.example",
    department: "People Operations",
    position: "People Operations Lead",
    manager: "COO",
    status: "active",
    permissions: [
      "canAccessDashboard",
      "canCreateJob",
      "canViewApplicants",
      "canGenerateCertificate",
      "canGenerateOfferLetter",
      "canManageEmployees",
      "canManageReviews",
      "canManageRecommendations"
    ]
  }
];

export const notifications: NotificationItem[] = [
  {
    id: "notif_offer",
    type: "application-status",
    title: "Offer ready for review",
    message: "Your Customer Success Manager offer is available. Please review it before 18 July 2026.",
    read: false,
    priority: "high",
    createdAt: "2026-07-07T09:12:00.000Z",
    recipientEmail: "rohan.m@example.com",
    relatedApplicationId: "app_rohan",
    actionUrl: "/applications/app_rohan"
  },
  {
    id: "notif_job_update",
    type: "job-update",
    title: "Application moved to shortlisted",
    message: "Your Product Engineer application is shortlisted. HR will contact you for the next round.",
    read: true,
    priority: "normal",
    createdAt: "2026-07-06T11:25:00.000Z",
    recipientEmail: "asha.sharma@example.com",
    relatedJobId: "job_cs_product_engineer",
    relatedJobSlug: "whatsapp-automation-product-engineer",
    relatedJobTitle: "WhatsApp Automation Product Engineer",
    relatedApplicationId: "app_asha",
    actionUrl: "/applications/app_asha"
  },
  {
    id: "notif_job_requirements",
    type: "job-update",
    title: "Product Engineer requirements updated",
    message: "We refreshed the product-engineering role with stronger accessibility and API-contract expectations.",
    read: false,
    priority: "high",
    createdAt: "2026-07-08T12:30:00.000Z",
    recipientEmail: "asha.sharma@example.com",
    relatedJobId: "job_cs_product_engineer",
    relatedJobSlug: "whatsapp-automation-product-engineer",
    relatedJobTitle: "WhatsApp Automation Product Engineer",
    relatedApplicationId: "app_asha",
    actionUrl: "/apply/whatsapp-automation-product-engineer",
    jobUpdateDetails: {
      updateType: "requirements",
      oldRequirements: [
        "4+ years building React or Next.js products with TypeScript",
        "Strong grasp of state management, API contracts, accessibility, and performance",
        "Comfort working with event-driven services and product analytics"
      ],
      newRequirements: [
        "4+ years building React or Next.js products with TypeScript",
        "Strong grasp of state management, API contracts, accessibility, and performance",
        "Experience translating ambiguous operational workflows into simple interfaces",
        "Comfort working with event-driven services and product analytics"
      ]
    }
  },
  {
    id: "notif_review_eligible",
    type: "system",
    title: "Employment review is eligible",
    message: "Your employee profile is eligible to submit a ConnectSphere employment review.",
    read: false,
    priority: "normal",
    createdAt: "2026-07-08T16:05:00.000Z",
    recipientEmail: "employee@connectsphere.example",
    actionUrl: "/employee/profile"
  }
];

export const auditLogs: AuditLog[] = [
  {
    id: "audit_1",
    actor: "Aparna Mehta",
    actorRole: "HR",
    action: "application.transition.shortlisted",
    resource: "APP-20260704-A91C",
    outcome: "allowed",
    at: "2026-07-06T11:20:00.000Z"
  },
  {
    id: "audit_2",
    actor: "Ishaan Kapoor",
    actorRole: "HR",
    action: "offer.issue",
    resource: "OFR-CSM-2026-018",
    outcome: "queued",
    at: "2026-07-07T09:10:00.000Z"
  },
  {
    id: "audit_3",
    actor: "anonymous verifier",
    actorRole: "public",
    action: "credential.verify",
    resource: "CRT-CS-2026-044",
    outcome: "allowed",
    at: "2026-07-09T13:30:00.000Z"
  }
];
