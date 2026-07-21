import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Edit3,
  Globe,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sliders,
  UserCog,
  XCircle,
} from '@/lib/icon-map';
import { toast } from 'sonner';

interface ApiConfig {
  key: string;
  value: string;
  updated_at: string;
}

interface ApiOperationCost {
  id: string;
  operation: string;
  base_cost: number;
  per_byte_cost: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

interface UserApiCredits {
  id: string;
  user_id: string;
  credits_remaining: number;
  credits_used_today: number;
  daily_limit: number;
  last_reset_date: string;
  created_at: string;
}

interface UsageStats {
  total_requests: number;
  total_credits_deducted: number;
  top_operations: { operation: string; count: number; credits: number }[];
}

const APIControlTab = () => {
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [creditMultiplier, setCreditMultiplier] = useState(1.0);
  const [operationCosts, setOperationCosts] = useState<ApiOperationCost[]>([]);
  const [editingCosts, setEditingCosts] = useState<Record<string, { base_cost: number; per_byte_cost: number }>>({});
  const [savingCostRows, setSavingCostRows] = useState<Record<string, boolean>>({});

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userCredits, setUserCredits] = useState<UserApiCredits | null>(null);
  const [userCreditsLoading, setUserCreditsLoading] = useState(false);
  const [userNewDailyLimit, setUserNewDailyLimit] = useState<number>(0);

  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [savingMultiplier, setSavingMultiplier] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadConfigs(),
        loadOperationCosts(),
      ]);
    } catch (error: any) {
      console.error('Error loading API control data:', error);
      toast.error('Failed to load API control data');
    } finally {
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    const { data, error } = await supabase
      .from('api_admin_config')
      .select('*');

    if (error) throw error;

    const configs = (data || []) as ApiConfig[];
    const getValue = (key: string, fallback: string = '') =>
      configs.find((c) => c.key === key)?.value ?? fallback;

    setGlobalEnabled(getValue('api_globally_enabled', 'false') === 'true');
    setMaintenanceMessage(getValue('maintenance_message', ''));
    setCreditMultiplier(parseFloat(getValue('global_daily_credit_multiplier', '1.0')));
  };

  const loadOperationCosts = async () => {
    const { data, error } = await supabase
      .from('api_operation_costs')
      .select('*')
      .order('operation');

    if (error) throw error;

    const costs = (data || []) as ApiOperationCost[];
    setOperationCosts(costs);

    const editMap: Record<string, { base_cost: number; per_byte_cost: number }> = {};
    costs.forEach((c) => {
      editMap[c.id] = { base_cost: c.base_cost, per_byte_cost: c.per_byte_cost };
    });
    setEditingCosts(editMap);
  };

  const handleToggleGlobal = async (enabled: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('api_admin_config')
        .upsert({ key: 'api_globally_enabled', value: String(enabled) }, { onConflict: 'key' });

      if (error) throw error;

      setGlobalEnabled(enabled);
      toast.success(
        enabled ? 'API system enabled globally' : 'API system disabled globally'
      );
    } catch (error: any) {
      console.error('Error toggling API:', error);
      toast.error('Failed to update API status');
    } finally {
      setToggling(false);
    }
  };

  const handleSaveMaintenanceMessage = async () => {
    setSavingMessage(true);
    try {
      const { error } = await supabase
        .from('api_admin_config')
        .upsert({ key: 'maintenance_message', value: maintenanceMessage }, { onConflict: 'key' });

      if (error) throw error;

      toast.success('Maintenance message updated');
    } catch (error: any) {
      console.error('Error saving maintenance message:', error);
      toast.error('Failed to update maintenance message');
    } finally {
      setSavingMessage(false);
    }
  };

  const handleSaveMultiplier = async () => {
    setSavingMultiplier(true);
    try {
      const { error } = await supabase
        .from('api_admin_config')
        .upsert(
          { key: 'global_daily_credit_multiplier', value: String(creditMultiplier) },
          { onConflict: 'key' }
        );

      if (error) throw error;

      toast.success('Credit multiplier updated');
    } catch (error: any) {
      console.error('Error saving multiplier:', error);
      toast.error('Failed to update credit multiplier');
    } finally {
      setSavingMultiplier(false);
    }
  };

  const handleSaveOperationCost = async (cost: ApiOperationCost) => {
    const edits = editingCosts[cost.id];
    if (!edits) return;

    setSavingCostRows((prev) => ({ ...prev, [cost.id]: true }));

    try {
      const { error } = await supabase
        .from('api_operation_costs')
        .update({ base_cost: edits.base_cost, per_byte_cost: edits.per_byte_cost })
        .eq('id', cost.id);

      if (error) throw error;

      setOperationCosts((prev) =>
        prev.map((c) =>
          c.id === cost.id
            ? { ...c, base_cost: edits.base_cost, per_byte_cost: edits.per_byte_cost }
            : c
        )
      );

      toast.success(`Costs updated for "${cost.operation}"`);
    } catch (error: any) {
      console.error('Error saving operation cost:', error);
      toast.error(`Failed to update costs for "${cost.operation}"`);
    } finally {
      setSavingCostRows((prev) => ({ ...prev, [cost.id]: false }));
    }
  };

  const handleSearchUser = async () => {
    const query = userSearchQuery.trim();
    if (!query) {
      toast.error('Please enter a user ID or email');
      return;
    }

    setUserCreditsLoading(true);
    setUserCredits(null);

    try {
      const { data, error } = await supabase
        .from('api_credits')
        .select('*')
        .eq('user_id', query)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('No credits record found for this user');
        return;
      }

      setUserCredits(data as UserApiCredits);
      setUserNewDailyLimit((data as UserApiCredits).daily_limit);
    } catch (error: any) {
      console.error('Error searching user credits:', error);
      toast.error('Failed to search user credits');
    } finally {
      setUserCreditsLoading(false);
    }
  };

  const handleUpdateDailyLimit = async () => {
    if (!userCredits) return;

    try {
      const { error } = await supabase
        .from('api_credits')
        .update({ daily_limit: userNewDailyLimit })
        .eq('id', userCredits.id);

      if (error) throw error;

      setUserCredits((prev) => prev ? { ...prev, daily_limit: userNewDailyLimit } : null);
      toast.success('Daily limit updated');
    } catch (error: any) {
      console.error('Error updating daily limit:', error);
      toast.error('Failed to update daily limit');
    }
  };

  const handleResetUserCredits = async () => {
    if (!userCredits) return;

    try {
      const { error } = await supabase
        .from('api_credits')
        .update({
          credits_remaining: userCredits.daily_limit,
          credits_used_today: 0,
          last_reset_date: new Date().toISOString(),
        })
        .eq('id', userCredits.id);

      if (error) throw error;

      setUserCredits((prev) =>
        prev
          ? {
              ...prev,
              credits_remaining: prev.daily_limit,
              credits_used_today: 0,
              last_reset_date: new Date().toISOString(),
            }
          : null
      );

      toast.success('User credits reset');
    } catch (error: any) {
      console.error('Error resetting credits:', error);
      toast.error('Failed to reset credits');
    }
  };

  const handleLoadUsageStats = async () => {
    setRefreshingStats(true);
    try {
      const { data, error } = await supabase.rpc('get_credit_usage_stats', { days_param: 30 });

      if (error) throw error;

      const stats = data as unknown as UsageStats;
      setUsageStats(stats);
    } catch (error: any) {
      console.error('Error loading usage stats:', error);
      toast.error('Failed to load usage statistics');
    } finally {
      setRefreshingStats(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">API Control Center</h2>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card className="bg-card/50 border-border/50 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global API Toggle
          </CardTitle>
          <CardDescription>
            Enable or disable the entire SquidCloud API system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant={globalEnabled ? 'default' : 'destructive'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {globalEnabled
                ? 'API system is enabled — all endpoints are active'
                : 'API system is disabled — all endpoints return maintenance responses'}
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {globalEnabled ? (
                  <Power className="h-5 w-5 text-green-500" />
                ) : (
                  <PowerOff className="h-5 w-5 text-destructive" />
                )}
                <Label htmlFor="api-toggle" className="text-base font-semibold">
                  {globalEnabled ? 'API System Active' : 'API System Disabled'}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Toggle to enable or disable all API endpoints globally
              </p>
            </div>
            <Switch
              id="api-toggle"
              checked={globalEnabled}
              onCheckedChange={handleToggleGlobal}
              disabled={toggling}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/50 border-border/50 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Maintenance Message
            </CardTitle>
            <CardDescription>
              Message shown to API consumers when the system is disabled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="e.g. API is under scheduled maintenance..."
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveMaintenanceMessage}
                disabled={savingMessage}
              >
                {savingMessage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5" />
              Credit Multiplier
            </CardTitle>
            <CardDescription>
              Global daily credit multiplier (default: 1.0)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold">{creditMultiplier.toFixed(2)}x</div>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={creditMultiplier}
                onChange={(e) => setCreditMultiplier(parseFloat(e.target.value) || 0)}
                className="w-32"
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveMultiplier}
                disabled={savingMultiplier}
              >
                {savingMultiplier ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Update
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 border-border/50 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Operation Costs
          </CardTitle>
          <CardDescription>
            Base cost and per-byte cost for each API operation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead>Base Cost</TableHead>
                <TableHead>Per-Byte Cost</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operationCosts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No operation costs found
                  </TableCell>
                </TableRow>
              )}
              {operationCosts.map((cost) => {
                const edits = editingCosts[cost.id];
                const hasChanges =
                  edits &&
                  (edits.base_cost !== cost.base_cost ||
                    edits.per_byte_cost !== cost.per_byte_cost);
                const isSaving = savingCostRows[cost.id];

                return (
                  <TableRow key={cost.id}>
                    <TableCell className="font-medium">{cost.operation}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step={0.01}
                        min={0}
                        value={edits?.base_cost ?? cost.base_cost}
                        onChange={(e) =>
                          setEditingCosts((prev) => ({
                            ...prev,
                            [cost.id]: {
                              ...prev[cost.id],
                              base_cost: parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step={0.0001}
                        min={0}
                        value={edits?.per_byte_cost ?? cost.per_byte_cost}
                        onChange={(e) =>
                          setEditingCosts((prev) => ({
                            ...prev,
                            [cost.id]: {
                              ...prev[cost.id],
                              per_byte_cost: parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                        className="h-8 w-28"
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {cost.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          cost.is_active
                            ? 'border-green-500/40 bg-green-500/10 text-green-600'
                            : 'border-red-500/40 bg-red-500/10 text-red-600'
                        }
                      >
                        {cost.is_active ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {cost.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveOperationCost(cost)}
                        disabled={!hasChanges || isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            User Credit Overview
          </CardTitle>
          <CardDescription>
            Look up and manage individual user API credits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="User ID or email..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
              className="max-w-sm"
            />
            <Button
              size="sm"
              onClick={handleSearchUser}
              disabled={userCreditsLoading}
            >
              {userCreditsLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          {userCredits && (
            <div className="rounded-lg border p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Credits Remaining</p>
                  <p className="text-xl font-semibold">{userCredits.credits_remaining}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credits Used Today</p>
                  <p className="text-xl font-semibold">{userCredits.credits_used_today}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Daily Limit</p>
                  <p className="text-xl font-semibold">{userCredits.daily_limit}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Reset</p>
                  <p className="text-sm font-semibold">
                    {userCredits.last_reset_date
                      ? new Date(userCredits.last_reset_date).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="daily-limit" className="text-sm">
                    New Daily Limit:
                  </Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    min={0}
                    value={userNewDailyLimit}
                    onChange={(e) => setUserNewDailyLimit(parseInt(e.target.value) || 0)}
                    className="h-8 w-24"
                  />
                  <Button size="sm" variant="outline" onClick={handleUpdateDailyLimit}>
                    <Save className="mr-2 h-4 w-4" />
                    Update
                  </Button>
                </div>
                <Button size="sm" variant="destructive" onClick={handleResetUserCredits}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset Credits
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50 rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                API Usage Stats (30 days)
              </CardTitle>
              <CardDescription>
                Aggregated usage statistics across the API system
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleLoadUsageStats}
              disabled={refreshingStats}
            >
              {refreshingStats ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Activity className="mr-2 h-4 w-4" />
              )}
              Load Stats
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!usageStats ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Click "Load Stats" to fetch the latest usage data
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold">{usageStats.total_requests.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total Credits Deducted</p>
                    <p className="text-2xl font-bold">
                      <DollarSign className="mr-1 inline h-5 w-5 text-muted-foreground" />
                      {usageStats.total_credits_deducted.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {usageStats.top_operations && usageStats.top_operations.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-medium">Top Operations</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operation</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageStats.top_operations.map((op, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{op.operation}</TableCell>
                          <TableCell className="text-right">{op.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{op.credits.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default APIControlTab;
