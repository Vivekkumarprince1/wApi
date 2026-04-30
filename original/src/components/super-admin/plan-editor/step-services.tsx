import React from 'react';
import { StepProps } from './types';

const FEATURES_SECTIONS = [
  {
    group: "Core Messaging",
    items: [
      { id: 'INBOX', label: 'Inbox', desc: 'Unified multi-channel message hub' },
      { id: 'BILLING', label: 'Billing', desc: 'Wallet, recharge and invoice management' },
      { id: 'CAMPAIGNS', label: 'Campaigns', desc: 'Broadcast marketing and messaging flows' },
      { id: 'CONTACTS', label: 'Contacts', desc: 'Centralized customer directory & metadata' },
      { id: 'ADS', label: 'Ads', desc: 'Click-to-WhatsApp ad monitoring' },
      { id: 'TEMPLATES_LIBRARY', label: 'Templates & Library', desc: 'Meta-approved shared template vault' },
    ]
  },
  {
    group: "Automation Hub",
    items: [
      { id: 'FLOW_HUB', label: 'Flow Hub', desc: 'Visual builder for customer journeys' },
      { id: 'WORKFLOWS', label: 'Workflows', desc: 'Advanced logic and trigger sequences' },
      { id: 'AUTO_REPLIES', label: 'Auto Replies', desc: 'Keyword and intent based response' },
      { id: 'INSTAGRAM_QUICKFLOWS', label: 'Instagram QuickFlows', desc: 'Rapid DM automation for IG' },
      { id: 'WA_FORMS', label: 'WhatsApp Forms', desc: 'Structured data collection in chat' },
      { id: 'ANSWERBOT', label: 'AnswerBot Training', desc: 'AI agent knowledge base & training' },
      { id: 'AI_INTENT', label: 'AI Intent Match', desc: 'Natural language intent classification' },
      { id: 'INTERAKTIVE_LIST', label: 'Interaktive List', desc: 'Interactive message menu controls' },
    ]
  },
  {
    group: "CRM & CRM Analysis",
    items: [
      { id: 'PIPELINE', label: 'Pipeline', desc: 'Visual sales funnel and stage tracking' },
      { id: 'TASKS', label: 'Tasks', desc: 'Agent follow-ups and CRM to-do list' },
      { id: 'REPORTS', label: 'Reports', desc: 'CRM performance and conversion data' },
      { id: 'ANALYTICS', label: 'Chat Analytics', desc: 'In-depth message & response auditing' },
      { id: 'CHAT_ASSIGNMENT', label: 'Chat Assignment', desc: 'Automated agent routing protocols' },
      { id: 'TEAM_MGMT', label: 'Team Management', desc: 'RBAC and agent performance monitoring' },
    ]
  },
  {
    group: "Commerce & Tools",
    items: [
      { id: 'CATALOG', label: 'Catalog', desc: 'Meta product catalog integration' },
      { id: 'ORDERS', label: 'Order Panel', desc: 'Order tracking and transaction hub' },
      { id: 'CHECKOUT_BOT', label: 'Checkout Bot', desc: 'Self-serve checkout flow logic' },
      { id: 'COMMERCE_SETTINGS', label: 'Settings', desc: 'Storefront and payment configuration' },
      { id: 'INTEGRATIONS', label: 'Integrations', desc: 'External app and API connectivity' },
      { id: 'WIDGET_CONFIG', label: 'Widget', desc: 'On-site chat widget customization' },
      { id: 'MACROS', label: 'Macros', desc: 'Templated quick-responses for agents' },
    ]
  }
];

export const StepServices: React.FC<StepProps> = ({ watch, setValue }) => {
  const planFeatures = watch('features') || [];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {FEATURES_SECTIONS.map((section) => (
        <div key={section.group} className="space-y-6">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 border-l-4 border-indigo-600 pl-4 mb-2">{section.group}</p>
          <div className="grid grid-cols-2 gap-4">
            {section.items.map((feature) => {
              const isChecked = planFeatures.includes(feature.id);
              return (
                <label 
                  key={feature.id} 
                  className={`flex items-start gap-4 p-6 rounded-[32px] border transition-all cursor-pointer select-none group ${isChecked ? 'bg-indigo-600/5 border-indigo-600 shadow-lg shadow-indigo-600/5' : 'bg-muted/20 border-border/50 opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
                >
                  <input 
                    type="checkbox" 
                    className="mt-1 h-5 w-5 rounded-lg border-2 border-border/50 checked:bg-indigo-600 checked:border-indigo-600 transition-all cursor-pointer accent-indigo-600"
                    checked={isChecked}
                    onChange={(e) => {
                      const current = watch('features') || [];
                      if (e.target.checked) setValue('features', [...current, feature.id]);
                      else setValue('features', current.filter((f: any) => f !== feature.id));
                    }}
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-tight">{feature.label}</p>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight">{feature.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
