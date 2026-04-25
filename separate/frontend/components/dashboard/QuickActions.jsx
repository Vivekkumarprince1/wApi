import React from 'react';
import { useRouter } from 'next/navigation';
import { Send, UserPlus, Star, MessageCircle, AlertTriangle, Zap } from 'lucide-react';

const QuickAction = ({ title, description, icon: Icon, color, onClick, badge, canUseMessaging, router }) => {
  const isLockedAction = !canUseMessaging && ['Send Campaign', 'Create Template', 'View Inbox'].includes(title);
  
  return (
    <button
      onClick={isLockedAction ? () => router.push('/dashboard?connectWhatsApp=1') : onClick}
      disabled={isLockedAction}
      className={`group relative flex flex-col items-start p-4 bg-card rounded-2xl border border-border/50 hover:shadow-premium transition-all duration-300 hover:-translate-y-0.5 text-left w-full overflow-hidden ${isLockedAction ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className={`absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr ${color} opacity-[0.07] rounded-full translate-y-1/2 -translate-x-1/2 group-hover:scale-150 transition-transform duration-500`} />
      {badge && (
        <span className="absolute top-2.5 right-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">{badge}</span>
      )}
      {isLockedAction && (
        <span className="absolute top-2.5 right-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
          <AlertTriangle className="h-2.5 w-2.5" /> Locked
        </span>
      )}
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md mb-2.5 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="text-white h-4 w-4" />
      </div>
      <h3 className="text-sm font-bold text-foreground mb-0.5">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
};

const QuickActions = ({ canUseMessaging, onAddContacts }) => {
  const router = useRouter();

  return (
    <div className="bg-card rounded-2xl p-5 border border-border/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md">
          <Zap className="text-white h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Quick Actions</h2>
          <p className="text-xs text-muted-foreground">Get started in seconds</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction canUseMessaging={canUseMessaging} router={router} title="Send Campaign" description="Reach thousands" icon={Send} color="from-emerald-500 to-emerald-600" onClick={() => router.push('/dashboard/campaign')} />
        <QuickAction canUseMessaging={canUseMessaging} router={router} title="Add Contacts" description="Import or create" icon={UserPlus} color="from-blue-500 to-blue-600" onClick={onAddContacts} />
        <QuickAction canUseMessaging={canUseMessaging} router={router} title="Create Template" description="Design messages" icon={Star} color="from-violet-500 to-violet-600" onClick={() => router.push('/dashboard/templates')} badge="New" />
        <QuickAction canUseMessaging={canUseMessaging} router={router} title="View Inbox" description="Check responses" icon={MessageCircle} color="from-amber-500 to-amber-600" onClick={() => router.push('/dashboard/inbox')} />
      </div>
    </div>
  );
};

export default QuickActions;
