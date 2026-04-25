import React from 'react';
import { Users, Send, CheckCircle, Eye, TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ title, value, change, changeType, icon: Icon, color, subtitle }) => (
  <div className="group relative bg-card rounded-2xl p-5 border border-border/50 hover:shadow-premium transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
    <div className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-br ${color} opacity-[0.07] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`} />
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="text-white h-5 w-5" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-semibold ${changeType === 'up' ? 'text-emerald-500' : 'text-destructive'}`}>
            {changeType === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            <span>{change}%</span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-2xl font-bold text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  </div>
);

const StatsGrid = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8 -mt-6 relative z-10">
      <StatCard title="Total Contacts" value={stats.totalContacts} change={12} changeType="up" icon={Users} color="from-blue-500 to-blue-600" subtitle="Growing steadily" />
      <StatCard title="Messages Sent" value={stats.messagesSent} change={8} changeType="up" icon={Send} color="from-emerald-500 to-emerald-600" subtitle="This month" />
      <StatCard title="Delivery Rate" value={`${stats.deliveryRate}%`} change={2} changeType="up" icon={CheckCircle} color="from-violet-500 to-violet-600" subtitle="Industry avg: 89%" />
      <StatCard title="Open Rate" value={`${stats.openRate}%`} change={5} changeType="up" icon={Eye} color="from-amber-500 to-amber-600" subtitle="Above average!" />
    </div>
  );
};

export default StatsGrid;
