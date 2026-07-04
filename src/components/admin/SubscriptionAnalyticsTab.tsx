import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Activity, AlertTriangle, TrendingUp, TrendingDown, Mail, Bell, Users, DollarSign, RefreshCw, Target } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

interface StageData {
  sent: number;
  clicked: number;
  dismissed: number;
}

interface AnalyticsData {
  totalActive: number;
  supporterCount: number;
  supporterPlusCount: number;
  expiringSoon7: number;
  expiringSoon14: number;
  expiringSoon30: number;
  recentlyExpired: number;
  mrrAtRisk7: number;
  mrrAtRisk14: number;
  mrrAtRisk30: number;
  stageBreakdown: Record<string, StageData>;
  upsellShown: number;
  upsellAccepted: number;
  upsellConversionRate: number;
  winbackUsers: number;
  renewedAfterWinback: number;
  winbackRate: number;
  churned: number;
}

const MetricCard = ({ icon: Icon, label, value, subvalue, trend, color }: {
  icon: any; label: string; value: string | number; subvalue?: string; trend?: 'up' | 'down' | 'neutral'; color?: string;
}) => (
  <div className="rounded-xl border border-border/20 bg-card p-4">
    <div className="flex items-center gap-2 mb-2">
      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', color ? `bg-${color}-500/10` : 'bg-primary/10')}>
        <Icon className={cn('h-3.5 w-3.5', color ? `text-${color}-400` : 'text-primary')} />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    {subvalue && (
      <div className="flex items-center gap-1 mt-1">
        {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-400" />}
        {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
        <span className="text-xs text-muted-foreground">{subvalue}</span>
      </div>
    )}
  </div>
);

const StageBar = ({ label, sent, clicked, dismissed, total }: { label: string; sent: number; clicked: number; dismissed: number; total: number }) => {
  const maxVal = Math.max(sent, 1);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="text-foreground">{sent} sent</span>
      </div>
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden flex">
        <div
          className="h-full bg-blue-500/60 transition-all"
          style={{ width: `${(clicked / maxVal) * 100}%` }}
          title={`Clicked: ${clicked}`}
        />
        <div
          className="h-full bg-amber-500/40 transition-all"
          style={{ width: `${(dismissed / maxVal) * 100}%` }}
          title={`Dismissed: ${dismissed}`}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500/60" /> {Math.round((clicked / maxVal) * 100)}% clicked</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500/40" /> {Math.round((dismissed / maxVal) * 100)}% dismissed</span>
      </div>
    </div>
  );
};

const SubscriptionAnalyticsTab: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) return;

        const res = await fetch(
          'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/admin-data-access',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'subscription_analytics' }),
          }
        );
        const result = await res.json();
        setData(result);
      } catch (e) {
        console.error('Failed to fetch subscription analytics:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-sm text-muted-foreground">
        Failed to load subscription analytics
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Crown} label="Active Subscriptions" value={data.totalActive} color="amber" />
        <MetricCard icon={Users} label="Supporter" value={data.supporterCount} subvalue={`${data.supporterPlusCount} Supporter+`} />
        <MetricCard icon={DollarSign} label="MRR at Risk (30d)" value={`$${data.mrrAtRisk30.toFixed(0)}`} subvalue={`$${data.mrrAtRisk7} next 7 days`} trend="down" color="red" />
        <MetricCard icon={TrendingDown} label="Churned (30d)" value={data.churned} subvalue={`${data.recentlyExpired} recently expired`} trend="down" color="red" />
      </div>

      {/* Expiry Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Expiry Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-red-500/5 border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">{data.expiringSoon7}</p>
              <p className="text-xs text-muted-foreground mt-1">Expiring in 7 days</p>
              <p className="text-[10px] text-red-400/60">${data.mrrAtRisk7.toFixed(0)} MRR at risk</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-2xl font-bold text-amber-400">{data.expiringSoon14}</p>
              <p className="text-xs text-muted-foreground mt-1">Expiring in 14 days</p>
              <p className="text-[10px] text-amber-400/60">${data.mrrAtRisk14.toFixed(0)} MRR at risk</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <p className="text-2xl font-bold text-blue-400">{data.expiringSoon30}</p>
              <p className="text-xs text-muted-foreground mt-1">Expiring in 30 days</p>
              <p className="text-[10px] text-blue-400/60">${data.mrrAtRisk30.toFixed(0)} MRR at risk</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              Upsell Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{data.upsellConversionRate}%</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{data.upsellAccepted} accepted</span>
              <span className="text-muted-foreground/30">/</span>
              <span>{data.upsellShown} shown</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                style={{ width: `${data.upsellConversionRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              Win-back Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{data.winbackRate}%</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{data.renewedAfterWinback} renewed</span>
              <span className="text-muted-foreground/30">/</span>
              <span>{data.winbackUsers} contacted</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all"
                style={{ width: `${data.winbackRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Stage Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{Object.keys(data.stageBreakdown).length}</p>
            <p className="text-xs text-muted-foreground mt-1">Notification stages active</p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-primary" />
            Notification Performance by Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(data.stageBreakdown).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No notification data yet. Notifications will appear here once the cron job runs.</p>
          ) : (
            Object.entries(data.stageBreakdown).sort().map(([key, stage]) => (
              <StageBar
                key={key}
                label={key.replace('_', ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                sent={stage.sent}
                clicked={stage.clicked}
                dismissed={stage.dismissed}
                total={stage.sent}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionAnalyticsTab;
