import React from 'react';
import { Globe, AlertTriangle } from 'lucide-react';

const DeliveryHealth = ({ deliveryHealth }) => {
  if (!deliveryHealth) return null;

  return (
    <div className="bg-card rounded-2xl p-5 border border-border/50">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Delivery Health</h2>
          <p className="text-xs text-muted-foreground">Real-time provider acceptance, queue backlog, and failure patterns</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">{deliveryHealth.deliveryRate ?? 0}%</div>
          <div className="text-xs text-muted-foreground">Confirmed delivery rate</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-border/60 p-3 bg-background/60">
          <div className="text-xs text-muted-foreground mb-1">Accepted</div>
          <div className="text-xl font-semibold text-foreground">{deliveryHealth.accepted ?? 0}</div>
        </div>
        <div className="rounded-xl border border-border/60 p-3 bg-background/60">
          <div className="text-xs text-muted-foreground mb-1">Retry Queue</div>
          <div className="text-xl font-semibold text-foreground">{deliveryHealth.queueStats?.waiting ?? 0}</div>
        </div>
        <div className="rounded-xl border border-border/60 p-3 bg-background/60">
          <div className="text-xs text-muted-foreground mb-1">Stuck Queued</div>
          <div className="text-xl font-semibold text-foreground">{deliveryHealth.stuckQueued ?? 0}</div>
        </div>
        <div className="rounded-xl border border-border/60 p-3 bg-background/60">
          <div className="text-xs text-muted-foreground mb-1">Failure Rate</div>
          <div className="text-xl font-semibold text-foreground">{deliveryHealth.failureRate ?? 0}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 p-4 bg-background/60">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Top Countries</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(deliveryHealth.byCountry || {}).slice(0, 4).map(([country, count]) => (
              <div key={country} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{country}</span>
                <span className="font-medium text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 p-4 bg-background/60">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Top Failure Pattern</h3>
          </div>
          {deliveryHealth.topFailures?.length > 0 ? (
            <div className="space-y-2">
              {deliveryHealth.topFailures.slice(0, 3).map((item) => (
                <div key={item.reason} className="rounded-lg bg-muted/50 px-3 py-2">
                  <div className="text-sm font-medium text-foreground truncate">{item.reason}</div>
                  <div className="text-xs text-muted-foreground">{item.count} failures in last 7 days</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No recent delivery failures detected.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryHealth;
