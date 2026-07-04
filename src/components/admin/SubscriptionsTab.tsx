import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, Search, Eye, User, Calendar, DollarSign, XCircle, Activity, AlertTriangle, CheckCircle, Shield } from '@/lib/icon-map';
import { toast } from 'sonner';

interface SubscribedUser {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  is_premium: boolean | null;
  tier: string | null;
  subscription_starts_at: string | null;
  subscription_expires_at: string | null;
  created_at: string | null;
  is_admin: boolean | null;
  is_restricted: boolean | null;
}

interface SubscriptionEvent {
  id: string;
  user_id: string;
  event_type: string;
  plan_type: string;
  billing_period: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface PaymentLog {
  id: string;
  user_id: string;
  plan: string;
  amount_usd: number | null;
  currency: string | null;
  tx_hash: string | null;
  network: string | null;
  token: string | null;
  session_id: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface BillingStats {
  totalSubscribed: number;
  supporterCount: number;
  supporterPlusCount: number;
  activeCount: number;
  monthlyRevenue: number;
  totalRevenue: number;
  totalPayments: number;
}

const PLAN_PRICES: Record<string, Record<string, number>> = {
  supporter: { weekly: 10, monthly: 4, annual: 40 },
  'supporter-plus': { weekly: 25, monthly: 10, annual: 100 },
};

function estimateMonthlyValue(tier: string, billingPeriod: string): number {
  const prices = PLAN_PRICES[tier];
  if (!prices) return 0;
  const price = prices[billingPeriod] || prices.monthly || 0;
  switch (billingPeriod) {
    case 'weekly': return price * 4.33;
    case 'annual': return price / 12;
    default: return price;
  }
}

function getPlanLabel(tier: string | null, isPremium: boolean | null): string {
  if (tier === 'supporter-plus') return 'Supporter+';
  if (tier === 'supporter') return 'Supporter';
  if (isPremium) return 'Premium';
  return 'Free';
}

function getPlanBadgeStyle(tier: string | null, isPremium: boolean | null): string {
  if (tier === 'supporter-plus') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  if (tier === 'supporter') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (isPremium) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

function getEventBadgeStyle(eventType: string): string {
  switch (eventType) {
    case 'purchased':
    case 'redeemed':
    case 'renewed':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'cancelled':
    case 'expired':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'payment_failed':
    case 'payment_expired':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'email_sent':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function getStatusBadge(isPremium: boolean | null, expiresAt: string | null): { label: string; style: string } {
  if (!isPremium) return { label: 'Free', style: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  if (!expiresAt) return { label: 'Active', style: 'bg-green-500/20 text-green-400 border-green-500/30' };
  const expired = new Date(expiresAt) < new Date();
  if (expired) return { label: 'Expired', style: 'bg-red-500/20 text-red-400 border-red-500/30' };
  return { label: 'Active', style: 'bg-green-500/20 text-green-400 border-green-500/30' };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2);
}

const SubscriptionsTab = () => {
  const [users, setUsers] = useState<SubscribedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userEvents, setUserEvents] = useState<SubscriptionEvent[]>([]);
  const [userPayments, setUserPayments] = useState<PaymentLog[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [stats, setStats] = useState<BillingStats>({
    totalSubscribed: 0,
    supporterCount: 0,
    supporterPlusCount: 0,
    activeCount: 0,
    monthlyRevenue: 0,
    totalRevenue: 0,
    totalPayments: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('admin-data-access', {
        body: { action: 'all_users' }
      });

      if (error) throw error;

      const allProfiles = (data?.users || []) as unknown as SubscribedUser[];
      const typedUsers = allProfiles.filter(u =>
        u.is_premium === true || (u.tier && u.tier !== 'free')
      );
      setUsers(typedUsers);

      const now = new Date();
      const activeCount = typedUsers.filter(u => {
        if (!u.is_premium) return false;
        if (!u.subscription_expires_at) return true;
        return new Date(u.subscription_expires_at) > now;
      }).length;

      const supporterCount = typedUsers.filter(u => u.tier === 'supporter').length;
      const supporterPlusCount = typedUsers.filter(u => u.tier === 'supporter-plus').length;

      // Batch-fetch latest billing_period for all users to estimate MRR
      const activeUsers = typedUsers.filter(u => u.is_premium && u.tier && u.tier !== 'free');
      const activeIds = activeUsers.map(u => u.id);
      let totalMrr = 0;

      if (activeIds.length > 0) {
        const { data: latestEvents } = await supabase
          .from('subscription_events')
          .select('user_id, billing_period')
          .in('user_id', activeIds)
          .order('created_at', { ascending: false });

        const periodByUser: Record<string, string> = {};
        const seen = new Set<string>();
        for (const ev of (latestEvents || []) as any[]) {
          if (ev.billing_period && !seen.has(ev.user_id)) {
            periodByUser[ev.user_id] = ev.billing_period;
            seen.add(ev.user_id);
          }
        }

        for (const user of activeUsers) {
          const billingPeriod = periodByUser[user.id] || 'monthly';
          totalMrr += estimateMonthlyValue(user.tier || 'supporter', billingPeriod);
        }
      }

      setStats({
        totalSubscribed: typedUsers.length,
        supporterCount,
        supporterPlusCount,
        activeCount,
        monthlyRevenue: totalMrr,
        totalRevenue: 0,
        totalPayments: 0,
      });
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
      toast.error('Failed to fetch subscription data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    setDetailsLoading(true);
    setSelectedUserId(userId);
    try {
      const { data: details, error: detailsError } = await supabase.functions.invoke('admin-data-access', {
        body: { action: 'user_details', userId }
      });

      if (detailsError) throw detailsError;

      const events = (details?.subscription_events || []) as unknown as SubscriptionEvent[];
      const payments = (details?.payment_logs || []) as unknown as PaymentLog[];

      setUserEvents(events);
      setUserPayments(payments);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      toast.error('Failed to fetch user details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const cancelSubscription = async (userId: string, userName: string) => {
    try {
      const { error: updateError } = await supabase
        .rpc('cancel_subscription', {
          p_user_id: userId,
          p_reason: null,
          p_cancelled_by: 'admin',
        });

      if (updateError) throw updateError;

      toast.success(`Subscription cancelled for ${userName}`);

      setUsers(prev => prev.filter(u => u.id !== userId));

      if (selectedUserId === userId) {
        setSelectedUserId(null);
      }

      await fetchData();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast.error('Failed to cancel subscription');
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.includes(searchTerm)
  );

  const selectedUser = users.find(u => u.id === selectedUserId);

  const eventTypeLabel = (type: string): string => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  if (loading) {
    return <div className="p-8 text-center">Loading subscription data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Subscribed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="text-3xl font-bold">{stats.totalSubscribed}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              <span className="text-3xl font-bold">{stats.activeCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Est. MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-3xl font-bold">{formatCurrency(stats.monthlyRevenue)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              <span className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Crown className="h-8 w-8 text-amber-500" />
          <div>
            <div className="text-2xl font-bold">{stats.supporterCount}</div>
            <div className="text-sm text-muted-foreground">Supporter</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Crown className="h-8 w-8 text-purple-500" />
          <div>
            <div className="text-2xl font-bold">{stats.supporterPlusCount}</div>
            <div className="text-sm text-muted-foreground">Supporter+</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <DollarSign className="h-8 w-8 text-blue-500" />
          <div>
            <div className="text-2xl font-bold">{stats.totalPayments}</div>
            <div className="text-sm text-muted-foreground">Total Payments</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle className="h-8 w-8 text-green-500" />
          <div>
            <div className="text-2xl font-bold">{stats.activeCount}/{stats.totalSubscribed}</div>
            <div className="text-sm text-muted-foreground">Active / Total</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Subscribed Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, username or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Crown className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No users match your search.' : 'No subscribed users yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => {
            const status = getStatusBadge(user.is_premium, user.subscription_expires_at);
            return (
              <Card key={user.id} className="hover:bg-accent/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback>
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">
                            {user.full_name || user.username || 'Unknown'}
                          </span>
                          {user.is_admin && <Badge variant="destructive" className="h-5 text-[10px]">Admin</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {user.email || user.username || user.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-3 text-sm">
                      <Badge className={getPlanBadgeStyle(user.tier, user.is_premium)}>
                        {getPlanLabel(user.tier, user.is_premium)}
                      </Badge>
                      <Badge className={status.style}>{status.label}</Badge>
                    </div>

                    <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(user.subscription_starts_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{formatDate(user.subscription_expires_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchUserDetails(user.id)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Details
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately cancel the subscription for{' '}
                              <strong>{user.full_name || user.username || 'this user'}</strong>.
                              Their plan will be downgraded to free tier.
                              <br /><br />
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => cancelSubscription(user.id, user.full_name || user.username || user.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Cancel Subscription
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={selectedUser?.avatar_url || ''} />
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              {selectedUser?.full_name || selectedUser?.username || 'User'} — Subscription Details
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="p-8 text-center">Loading user details...</div>
          ) : selectedUser ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Plan Info</TabsTrigger>
                <TabsTrigger value="events">Events ({userEvents.length})</TabsTrigger>
                <TabsTrigger value="payments">Payments ({userPayments.length})</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5" />
                      Subscription Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Plan Tier</span>
                        <div className="mt-1">
                          <Badge className={getPlanBadgeStyle(selectedUser.tier, selectedUser.is_premium)}>
                            {getPlanLabel(selectedUser.tier, selectedUser.is_premium)}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Status</span>
                        <div className="mt-1">
                          <Badge className={getStatusBadge(selectedUser.is_premium, selectedUser.subscription_expires_at).style}>
                            {getStatusBadge(selectedUser.is_premium, selectedUser.subscription_expires_at).label}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Premium</span>
                        <div className="mt-1">
                          <Badge className={selectedUser.is_premium ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                            {selectedUser.is_premium ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Subscribed On</span>
                        <p className="font-medium">{formatDate(selectedUser.subscription_starts_at)}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Expires On</span>
                        <p className="font-medium">{formatDate(selectedUser.subscription_expires_at)}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Joined</span>
                        <p className="font-medium">{formatDate(selectedUser.created_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      User Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">User ID</span>
                        <p className="font-mono text-sm">{selectedUser.id}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Email</span>
                        <p>{selectedUser.email || '—'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Username</span>
                        <p>{selectedUser.username || '—'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Full Name</span>
                        <p>{selectedUser.full_name || '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cancel Subscription */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel {selectedUser.full_name || selectedUser.username || 'this user'}'s Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will immediately cancel the subscription for{' '}
                        <strong>{selectedUser.full_name || selectedUser.username || 'this user'}</strong>.
                        Their plan will be downgraded to free tier.
                        <br /><br />
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelSubscription(selectedUser.id, selectedUser.full_name || selectedUser.username || selectedUser.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Cancel Subscription
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TabsContent>

              {/* Events Tab */}
              <TabsContent value="events" className="space-y-4">
                {userEvents.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Activity className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No subscription events found.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {userEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className={getEventBadgeStyle(event.event_type)}>
                            {eventTypeLabel(event.event_type)}
                          </Badge>
                          <div>
                            <div className="font-medium">
                              {getPlanLabel(event.plan_type)}
                              {event.billing_period ? ` — ${event.billing_period}` : ''}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {event.metadata?.code && `Code: ${event.metadata.code} • `}
                              {event.metadata?.tx_hash && `Tx: ${event.metadata.tx_hash.slice(0, 16)}... • `}
                              {event.metadata?.discount_percent && `${event.metadata.discount_percent}% off • `}
                              {event.metadata?.cancelled_by && 'Cancelled by admin • '}
                              {new Date(event.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="space-y-4">
                {userPayments.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <DollarSign className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No payment logs found.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {userPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className={
                            payment.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : payment.status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-orange-500/20 text-orange-400'
                          }>
                            {payment.status}
                          </Badge>
                          <div>
                            <div className="font-medium">
                              {payment.amount_usd ? formatCurrency(payment.amount_usd) : '—'}
                              {payment.currency ? ` ${payment.currency}` : ''}
                              {payment.plan ? ` — ${getPlanLabel(payment.plan)}` : ''}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {payment.tx_hash && `Tx: ${payment.tx_hash.slice(0, 16)}...`}
                              {payment.network && ` • ${payment.network}`}
                              {payment.token && ` • ${payment.token}`}
                              {payment.session_id && ` • Session: ${payment.session_id.slice(0, 8)}...`}
                              {` • ${new Date(payment.created_at).toLocaleString()}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionsTab;
