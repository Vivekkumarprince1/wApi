import React from 'react';
import { Send, UserPlus, CheckCircle, Rocket, MessageCircle, Zap, Star } from 'lucide-react';

const ActivityItem = ({ activity }) => {
  const iconMap = { send: Send, user: UserPlus, check: CheckCircle, rocket: Rocket, chat: MessageCircle };
  const colorMap = {
    emerald: 'from-emerald-400 to-emerald-600', blue: 'from-blue-400 to-blue-600',
    violet: 'from-violet-400 to-violet-600', amber: 'from-amber-400 to-amber-600'
  };
  const Icon = iconMap[activity.icon] || Zap;
  const gradient = colorMap[activity.color] || colorMap.blue;

  return (
    <div className="flex items-center gap-3 p-2.5 hover:bg-muted rounded-xl transition-colors cursor-pointer group">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform shrink-0`}>
        <Icon className="text-white h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
        <p className="text-xs text-muted-foreground">{activity.time}</p>
      </div>
    </div>
  );
};

const RightSidebar = ({ stats, recentActivity, showTrial }) => {
  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="bg-card rounded-2xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">Performance</h3>
          <span className="text-xs text-muted-foreground">This Week</span>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Active Campaigns', value: stats.activeCampaigns, pct: Math.min(stats.activeCampaigns * 20, 100), color: 'from-emerald-500 to-emerald-400' },
            { label: 'Templates', value: stats.totalTemplates, pct: Math.min(stats.totalTemplates * 10, 100), color: 'from-blue-500 to-blue-400' },
            { label: 'Response Rate', value: `${stats.responseRate}%`, pct: stats.responseRate, color: 'from-violet-500 to-violet-400' },
            { label: 'Conversions', value: stats.conversions, pct: Math.min(stats.conversions / 10, 100), color: 'from-amber-500 to-amber-400' },
          ].map(m => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <span className="text-sm font-bold text-foreground">{m.value}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${m.color} rounded-full transition-all duration-700`} style={{ width: `${m.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-2xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">Recent Activity</h3>
          <button className="text-xs text-primary hover:text-primary/80 font-semibold">View All</button>
        </div>
        <div className="space-y-0.5">
          {recentActivity.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      </div>

      {/* Upgrade Card */}
      {showTrial && (
        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-white shadow-premium">
          <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-yellow-300" />
              <span className="text-sm font-semibold text-white/90">Limited Time Offer</span>
            </div>
            <h3 className="text-lg font-bold mb-1.5">Upgrade to Pro</h3>
            <p className="text-sm text-white/80 mb-4">Unlimited campaigns, advanced analytics, priority support.</p>
            <button className="w-full bg-white dark:bg-primary-foreground text-primary py-2.5 rounded-xl font-bold hover:brightness-110 transition-colors shadow-lg">
              Upgrade Now - Save 50%
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;
