import * as Icons from "lucide-react";

export interface FeatureMetadata {
  name: string;
  description: string;
  icon: any;
  requiredPlan: string;
  benefits: string[];
}

export const FEATURE_CONFIG: Record<string, FeatureMetadata> = {
  analytics: {
    name: "Advanced Analytics",
    description: "Get deep insights into your campaign performance, delivery rates, and user engagement.",
    icon: Icons.BarChart3,
    requiredPlan: "Pro",
    benefits: [
      "Real-time delivery tracking",
      "User engagement heatmaps",
      "ROI calculation tools",
      "Custom reporting dashboards"
    ]
  },
  crm: {
    name: "Sales CRM",
    description: "Manage your leads, track conversations, and close deals directly within WhatsApp.",
    icon: Icons.Users,
    requiredPlan: "Growth",
    benefits: [
      "Pipeline management",
      "Lead scoring & qualification",
      "Custom contact fields",
      "Team assignment rules"
    ]
  },
  automation: {
    name: "Business Automation",
    description: "Automate your workflows, set up keyword triggers, and build complex message flows.",
    icon: Icons.Zap,
    requiredPlan: "Enterprise",
    benefits: [
      "No-code flow builder",
      "Keyword-based auto-replies",
      "Webhooks & API integrations",
      "Condition-based branching"
    ]
  },
  commerce: {
    name: "WhatsApp Commerce",
    description: "Sell products, manage orders, and accept payments directly through WhatsApp catalogs.",
    icon: Icons.ShoppingBag,
    requiredPlan: "Growth",
    benefits: [
      "Catalog management",
      "Order tracking system",
      "Payment gateway integration",
      "Abandoned cart recovery"
    ]
  },
  inbox: {
    name: "Shared Inbox",
    description: "A collaborative workspace for your team to manage all WhatsApp conversations in one place.",
    icon: Icons.Inbox,
    requiredPlan: "Starter",
    benefits: [
      "Multi-agent support",
      "Private internal notes",
      "Quick response templates",
      "Chat history & search"
    ]
  },
  campaigns: {
    name: "Bulk Campaigns",
    description: "Send personalized messages to thousands of customers at scale with high delivery rates.",
    icon: Icons.Send,
    requiredPlan: "Growth",
    benefits: [
      "Variable personalization",
      "Scheduled broadcasting",
      "A/B testing tools",
      "Opt-out management"
    ]
  },
  templates: {
    name: "Message Templates",
    description: "Create and manage Meta-approved interactive message templates with buttons and media.",
    icon: Icons.FileText,
    requiredPlan: "Starter",
    benefits: [
      "Interactive button support",
      "Dynamic media variables",
      "Direct Meta API sync",
      "Multi-language support"
    ]
  },
  team: {
    name: "Team Management",
    description: "Invite team members, assign roles, and manage permissions for your workspace.",
    icon: Icons.Users2,
    requiredPlan: "Growth",
    benefits: [
      "Role-based access control",
      "Activity logs & auditing",
      "Team performance stats",
      "Priority agent support"
    ]
  }
};

export const getFeatureMetadata = (feature: string): FeatureMetadata => {
  const key = feature.toLowerCase();
  return FEATURE_CONFIG[key] || {
    name: feature.charAt(0).toUpperCase() + feature.slice(1),
    description: "Upgrade your plan to unlock this feature.",
    icon: Icons.ShieldCheck,
    requiredPlan: "Pro",
    benefits: ["Advanced tools", "Priority support", "Higher limits"]
  };
};
