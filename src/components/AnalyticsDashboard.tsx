import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  HardDrive,
  Activity,
  Download,
  Upload,
  Eye,
  Share2,
  CheckCircle,
  RefreshCw,
  PieChart,
  LineChart,
  ArrowLeft,
  Gauge,
  Wifi
} from '@/lib/icon-map';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line
} from 'recharts';
import { analyticsService, StorageMetrics, ActivityMetrics, PerformanceMetrics } from '@/services/analytics-service';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/ui/Loader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/* Single-hue sequential palette: primary steps down, then muted.
   Slices encode magnitude, not categories — no rainbow. */
const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--primary) / 0.68)',
  'hsl(var(--primary) / 0.48)',
  'hsl(var(--primary) / 0.32)',
  'hsl(var(--muted-foreground) / 0.45)',
  'hsl(var(--muted-foreground) / 0.28)',
];

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon, className = '' }) => (
  <div className={`rounded-lg bg-card/50 border border-border p-5 ${className}`}>
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70">{title}</p>
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-bold text-foreground">{value}</h3>
          {change !== undefined && (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              change >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            )}>
              {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(change)}%
            </span>
          )}
        </div>
      </div>
      <div className="h-11 w-11 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
    </div>
  </div>
);

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [storage, activity, performance] = await Promise.all([
        analyticsService.getStorageMetrics(),
        analyticsService.getActivityMetrics(),
        analyticsService.getPerformanceMetrics()
      ]);

      setStorageMetrics(storage);
      setActivityMetrics(activity);
      setPerformanceMetrics(performance);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: "Failed to load analytics",
        description: "There was an error loading your analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
    toast({
      title: "Analytics refreshed",
      description: "Your analytics data has been updated"
    });
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === -1) return 'Unlimited';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === -1) return 'N/A'; // Unlimited storage
    return total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader />
      </div>
    );
  }

  const storageUsageData = storageMetrics ?
    storageMetrics.totalStorage === -1 ?
      [{ name: 'Used', value: storageMetrics.usedStorage, color: 'hsl(var(--primary))' }] : // For unlimited, only show used
      [
        { name: 'Used', value: storageMetrics.usedStorage, color: 'hsl(var(--primary))' },
        { name: 'Available', value: storageMetrics.availableStorage, color: 'hsl(var(--muted))' }
      ] : [];

  const fileTypeData = storageMetrics ? 
    Object.entries(storageMetrics.fileTypes).map(([type, count]) => ({
      name: type,
      value: count
    })) : [];

  const storageByTypeData = storageMetrics ?
    Object.entries(storageMetrics.storageByType).map(([type, size]) => ({
      name: type,
      value: size,
      displayValue: formatBytes(size)
    })) : [];

  // Mobile UI
  if (isMobile) {
    return (
      <div className="min-h-screen pb-24">
        {/* Mobile Header */}
        <div className="sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
          <div className="bg-card/80 border-b border-border/60">
            <div className="px-4 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl bg-muted/40 hover:bg-muted/70 text-foreground/80 hover:text-foreground"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
                </div>
                <p className="text-xs text-muted-foreground/70">Storage &amp; activity</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl bg-muted/40 hover:bg-muted/70 text-foreground/80 hover:text-foreground"
                onClick={refreshAnalytics}
                disabled={refreshing}
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 min-w-max">
                {[
                  { value: 'overview', label: 'Overview', icon: BarChart3 },
                  { value: 'storage', label: 'Storage', icon: HardDrive },
                  { value: 'activity', label: 'Activity', icon: Activity },
                  { value: 'performance', label: 'Performance', icon: Gauge },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isMobileTabActive = activeTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setActiveTab(tab.value)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95',
                        isMobileTabActive
                          ? 'bg-primary/15 text-primary border border-primary/25'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-transparent'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative overflow-hidden rounded-lg bg-card/60 border border-border/60 p-4">
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
                  <div className="relative z-10">
                    <BarChart3 className="h-5 w-5 text-primary mb-2" />
                    <div className="text-2xl font-bold text-foreground">{storageMetrics?.fileCount || 0}</div>
                    <div className="text-xs text-muted-foreground/70">Total Files</div>
                    {(activityMetrics?.filesGrowth || 0) !== 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {(activityMetrics?.filesGrowth || 0) >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
                        <span className={`text-xs ${(activityMetrics?.filesGrowth || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(activityMetrics?.filesGrowth || 0) >= 0 ? '+' : ''}{activityMetrics?.filesGrowth}% this week</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-lg bg-card/60 border border-border/60 p-4">
                  <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
                  <div className="relative z-10">
                    <HardDrive className="h-5 w-5 text-primary mb-2" />
                    <div className="text-xl font-bold text-foreground">{formatBytes(storageMetrics?.usedStorage || 0)}</div>
                    <div className="text-xs text-muted-foreground">Storage Used</div>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400">+{storageMetrics?.storageGrowth || 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-card/50 border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-primary" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Views</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{activityMetrics?.views || 0}</div>
                </div>
                <div className="rounded-lg bg-card/50 border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Download className="h-4 w-4 text-primary" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Downloads</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{activityMetrics?.downloads || 0}</div>
                </div>
              </div>

              <div className="rounded-lg bg-card/50 border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Activity Over Time
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={activityMetrics?.dailyActivity || []}>
                    <defs>
                      <linearGradient id="colorUploadsMob" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                    <Area type="monotone" dataKey="uploads" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorUploadsMob)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg bg-card/50 border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  Storage
                </h3>
                {storageMetrics?.totalStorage === -1 ? (
                  <div className="text-center py-4">
                    <div className="text-3xl font-bold text-foreground">{formatBytes(storageMetrics.usedStorage)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Used Storage</div>
                    <Badge className="mt-2 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Unlimited</Badge>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={150}>
                    <RechartsPieChart>
                      <Pie data={storageUsageData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                        {storageUsageData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <Tooltip formatter={(value) => formatBytes(value as number)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: 'Total', value: storageMetrics?.totalStorage === -1 ? '∞' : formatBytes(storageMetrics?.totalStorage || 0), color: 'text-foreground' },
                  { label: 'Used', value: formatBytes(storageMetrics?.usedStorage || 0), color: 'text-primary' },
                  { label: 'Free', value: storageMetrics?.availableStorage === -1 ? '∞' : formatBytes(storageMetrics?.availableStorage || 0), color: 'text-primary' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-lg bg-card/50 border border-border p-3.5 text-center">
                    <div className={cn('text-lg font-bold', stat.color)}>{stat.value}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-card/50 border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-4">File Types</h3>
                <div className="space-y-3">
                  {fileTypeData.slice(0, 5).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm text-foreground/80 capitalize">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-card/50 border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-4">Storage by Type</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={storageByTypeData}>
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 10 }} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatBytes(value)} tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 10 }} axisLine={false} />
                    <Tooltip formatter={(value) => formatBytes(value as number)} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Upload, label: 'Uploads', value: activityMetrics?.uploads || 0, border: 'border-border/60', iconColor: 'text-muted-foreground' },
                  { icon: Download, label: 'Downloads', value: activityMetrics?.downloads || 0, border: 'border-border/60', iconColor: 'text-muted-foreground' },
                  { icon: Share2, label: 'Shares', value: activityMetrics?.shares || 0, border: 'border-border/60', iconColor: 'text-muted-foreground' },
                  { icon: Eye, label: 'Views', value: activityMetrics?.views || 0, border: 'border-border/60', iconColor: 'text-muted-foreground' },
                ].map(stat => {
                  const StatIcon = stat.icon;
                  return (
                    <div key={stat.label} className={cn('relative overflow-hidden rounded-lg p-4 border', stat.border)}>
                      <div className="absolute -top-3 -right-3 w-16 h-16 bg-card/50 rounded-full blur-xl" />
                      <div className="relative z-10">
                        <StatIcon className={cn('h-5 w-5 mb-2', stat.iconColor)} />
                        <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">{stat.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg bg-card/50 border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-4">Popular Files</h3>
                <div className="space-y-2">
                  {activityMetrics?.popularFiles.slice(0, 5).map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border/60">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground/70">{file.views} views &bull; {file.downloads} downloads</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-card/50 px-2.5 py-0.5 text-xs text-muted-foreground">{file.views + file.downloads}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-card/50 border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-4">Access Patterns (24h)</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={activityMetrics?.accessPatterns || []}>
                    <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 10 }} axisLine={false} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 10 }} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                    <Bar dataKey="activity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Gauge, label: 'API Response', value: performanceMetrics && performanceMetrics.apiResponseMs >= 0 ? `${performanceMetrics.apiResponseMs} ms` : '—' },
                  { icon: Upload, label: 'Uploaded · 30d', value: formatBytes(performanceMetrics?.uploadBytes30d || 0) },
                  { icon: Download, label: 'Share Downloads', value: `${performanceMetrics?.shareDownloads || 0}` },
                  { icon: Share2, label: 'Active Shares', value: `${performanceMetrics?.activeShares || 0}` },
                ].map(stat => {
                  const StatIcon = stat.icon;
                  return (
                    <div key={stat.label} className="relative overflow-hidden rounded-lg p-4 border border-border/60">
                      <div className="relative z-10">
                        <StatIcon className="h-5 w-5 mb-2 text-primary" />
                        <div className="text-lg font-bold text-foreground">{stat.value}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">{stat.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg bg-card/50 border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" />
                  System Health
                </h3>
                <div className="space-y-2">
                  {[
                    ['Overall Status', performanceMetrics?.systemHealth || 'Unknown', true],
                    ['API Response', performanceMetrics && performanceMetrics.apiResponseMs >= 0 ? `${performanceMetrics.apiResponseMs}ms` : 'Unreachable', false],
                    ['Active Shares', `${performanceMetrics?.activeShares || 0}`, false],
                  ].map(([label, value, isHealth]) => (
                    <div key={label as string} className="flex items-center justify-between py-2 px-3 rounded-xl bg-card/50">
                      <span className="text-sm text-muted-foreground/80">{label as string}</span>
                      {isHealth ? (
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          value === 'excellent' ? 'bg-emerald-500/15 text-emerald-400' :
                          value === 'good' ? 'bg-primary/15 text-primary' :
                          value === 'fair' ? 'bg-yellow-500/15 text-yellow-400' :
                          'bg-red-500/15 text-red-400'
                        )}>{value as string}</span>
                      ) : (
                        <span className="text-sm font-medium text-foreground">{value as string}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            <div className="rounded-lg bg-card/50 border border-border p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Upload Volume · 14 days</h3>
              <ResponsiveContainer width="100%" height={150}>
                <RechartsLineChart data={performanceMetrics?.bandwidthUsage || []}>
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 10 }} axisLine={false} />
                  <Tooltip formatter={(value) => `${value} MB`} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Line type="monotone" dataKey="uploadMB" name="Uploaded" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
            </div>
          )}

          <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
            <div className="flex items-start gap-3">
              <HardDrive className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-foreground">Unlimited storage</h4>
                <p className="text-xs text-muted-foreground mt-1">Files stay encrypted end to end, with capacity that never runs out.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop UI
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-card border border-primary/20 p-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-x-1/4 translate-y-1/4" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground">
              <BarChart3 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-foreground">Analytics</h1>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">Monitor your storage and activity</p>
            </div>
          </div>
          <Button
            onClick={refreshAnalytics}
            disabled={refreshing}
            variant="outline"
            className="gap-2 rounded-md bg-card/50 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="inline-flex h-10 items-center gap-1 rounded-lg bg-card/50 border border-border p-1">
          <TabsTrigger value="overview" className="rounded-xl text-[13px] text-muted-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="storage" className="rounded-xl text-[13px] text-muted-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm">Storage</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl text-[13px] text-muted-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm">Activity</TabsTrigger>
          <TabsTrigger value="performance" className="rounded-xl text-[13px] text-muted-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="Total Files" value={storageMetrics?.fileCount || 0} change={activityMetrics?.filesGrowth ?? 0} icon={<BarChart3 className="h-5 w-5 text-primary" />} />
            <MetricCard title="Storage Used" value={formatBytes(storageMetrics?.usedStorage || 0)} change={storageMetrics?.storageGrowth || 0} icon={<HardDrive className="h-5 w-5 text-primary" />} />
            <MetricCard title="Total Views" value={activityMetrics?.views || 0} icon={<Eye className="h-5 w-5 text-primary" />} />
            <MetricCard title="Downloads" value={activityMetrics?.downloads || 0} icon={<Download className="h-5 w-5 text-primary" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg bg-card/50 border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Activity Over Time
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={activityMetrics?.dailyActivity || []}>
                  <defs>
                      <linearGradient id="colorUploadsD" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.6)" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="uploads" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="downloads" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="views" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg bg-card/50 border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" />
                Storage Distribution
              </h3>
              {storageMetrics?.totalStorage === -1 ? (
                <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-foreground">{formatBytes(storageMetrics.usedStorage)}</div>
                    <div className="text-sm text-muted-foreground mt-1">Used Storage</div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 px-3 py-1 text-xs font-medium mt-2">Unlimited</span>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie data={storageUsageData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">
                      {storageUsageData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value) => formatBytes(value as number)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="storage" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard title="Total Storage" value={storageMetrics?.totalStorage === -1 ? "Unlimited" : formatBytes(storageMetrics?.totalStorage || 0)} icon={<HardDrive className="h-5 w-5 text-primary" />} />
            <MetricCard title="Used Storage" value={formatBytes(storageMetrics?.usedStorage || 0)} change={storageMetrics?.storageGrowth || 0} icon={<BarChart3 className="h-5 w-5 text-primary" />} />
            <MetricCard title="Available Storage" value={storageMetrics?.availableStorage === -1 ? "Unlimited" : formatBytes(storageMetrics?.availableStorage || 0)} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg bg-card/50 border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">File Types Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie data={fileTypeData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} dataKey="value">
                    {fileTypeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg bg-card/50 border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Storage by File Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={storageByTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.6)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 11 }} axisLine={false} />
                  <YAxis tickFormatter={(value) => formatBytes(value)} tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 11 }} axisLine={false} />
                  <Tooltip formatter={(value) => formatBytes(value as number)} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <MetricCard title="Uploads" value={activityMetrics?.uploads || 0} change={activityMetrics?.filesGrowth ?? 0} icon={<Upload className="h-5 w-5 text-primary" />} />
            <MetricCard title="Downloads" value={activityMetrics?.downloads || 0} icon={<Download className="h-5 w-5 text-primary" />} />
            <MetricCard title="Shares" value={activityMetrics?.shares || 0} icon={<Share2 className="h-5 w-5 text-primary" />} />
            <MetricCard title="Views" value={activityMetrics?.views || 0} icon={<Eye className="h-5 w-5 text-primary" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg bg-card/50 border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Access Patterns (24h)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityMetrics?.accessPatterns || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.6)" />
                  <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 11 }} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Bar dataKey="activity" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg bg-card/50 border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Popular Files</h3>
              <div className="space-y-2">
                {activityMetrics?.popularFiles.slice(0, 5).map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border/60">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground/70">{file.views} views &bull; {file.downloads} downloads</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-card/50 px-2.5 py-0.5 text-xs text-muted-foreground">{file.views + file.downloads}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <MetricCard title="API Response" value={performanceMetrics && performanceMetrics.apiResponseMs >= 0 ? `${performanceMetrics.apiResponseMs} ms` : '—'} icon={<Gauge className="h-5 w-5 text-primary" />} />
            <MetricCard title="Uploaded · 30d" value={formatBytes(performanceMetrics?.uploadBytes30d || 0)} icon={<Upload className="h-5 w-5 text-primary" />} />
            <MetricCard title="Share Downloads" value={performanceMetrics?.shareDownloads || 0} icon={<Download className="h-5 w-5 text-primary" />} />
            <MetricCard title="Active Shares" value={performanceMetrics?.activeShares || 0} icon={<Share2 className="h-5 w-5 text-primary" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg bg-card/50 border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <Wifi className="h-4 w-4 text-emerald-400" />
                System Health
              </h3>
              <div className="space-y-3">
                {[
                  ['Overall Health', performanceMetrics?.systemHealth || 'Unknown', true],
                  ['API Response', performanceMetrics && performanceMetrics.apiResponseMs >= 0 ? `${performanceMetrics.apiResponseMs}ms` : 'Unreachable', false],
                  ['Active Shares', `${performanceMetrics?.activeShares || 0}`, false],
                  ['Share Downloads', `${performanceMetrics?.shareDownloads || 0}`, false],
                ].map(([label, value, isBadge]) => (
                  <div key={label as string} className="flex items-center justify-between py-2 px-3 rounded-xl bg-card/50">
                    <span className="text-sm text-muted-foreground/80">{label as string}</span>
                    {isBadge ? (
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        value === 'excellent' ? 'bg-emerald-500/15 text-emerald-400' :
                        value === 'good' ? 'bg-primary/15 text-primary' :
                        value === 'fair' ? 'bg-yellow-500/15 text-yellow-400' :
                        'bg-red-500/15 text-red-400'
                      )}>{value as string}</span>
                    ) : (
                      <span className="text-sm font-medium text-foreground">{value as string}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-card/50 border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Upload Volume · 14 days</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={performanceMetrics?.bandwidthUsage || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.6)" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 11 }} axisLine={false} />
                  <YAxis tickFormatter={(value) => `${value} MB`} tick={{ fill: 'hsl(var(--muted-foreground) / 0.55)', fontSize: 11 }} axisLine={false} />
                  <Tooltip formatter={(value) => `${value} MB`} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Line type="monotone" dataKey="uploadMB" name="Uploaded" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
        <div className="flex items-start gap-3">
          <HardDrive className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-foreground">Unlimited storage</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Every plan includes unlimited capacity. Your files stay encrypted end to end.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;