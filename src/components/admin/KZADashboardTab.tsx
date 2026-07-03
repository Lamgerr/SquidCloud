import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, Eye, Shield, ShieldAlert, ShieldCheck, Globe, MapPin,
  Activity, Users, Ban, Fingerprint, Network, Terminal, Lock, Unlock,
  XCircle, CheckCircle2, Loader2, Search, Filter, SlidersHorizontal,
  Plus, Trash2, Server, Wifi, WifiOff, Bug, History, Clock,
  UserX, UserCheck, Zap, ArrowUpRight, ArrowDownRight, RefreshCw,
  MoreHorizontal, Download, Upload, Info, Crown,
} from '@/lib/icon-map';

type KzaIncident = {
  id?: string;
  threat_tier?: string;
  incident_title?: string;
  attacker_profile?: Record<string, unknown>;
  attack_timeline?: Array<{ timestamp: string; action: string; endpoint: string; result: string }>;
  what_was_targeted?: string;
  potential_harm?: string;
  techniques_used?: string[];
  actions_taken?: string[];
  linked_accounts?: unknown;
  network_intel?: Record<string, unknown>;
  status?: string;
  created_at?: string;
  threat_event_id?: string;
};

type KzaThreatEvent = {
  id: string;
  threat_tier?: string;
  threat_type?: string;
  endpoint_hit?: string;
  ip_address?: string;
  created_at?: string;
  payload_snapshot?: Record<string, any>;
  user_id?: string;
};

type KzaBan = {
  id: string;
  user_id?: string;
  ip_address?: string;
  ban_type?: string;
  ban_reason?: string;
  ban_tier?: string;
  attack_summary?: string;
  banned_until?: string;
  created_at?: string;
  is_active?: boolean;
  banned_by?: string;
};

type KzaUserProfile = {
  user_id: string;
  threat_score?: number;
  is_watchlisted?: boolean;
  typical_endpoints?: string[];
  typical_countries?: string[];
  typical_devices?: unknown;
  typical_active_hours?: number[];
  total_requests?: number;
  last_seen_at?: string;
};

type GeoEvent = {
  id: string;
  user_id?: string;
  ip_address?: string;
  country_code?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  occurred_at?: string;
  session_id?: string;
};

type SecurityEvent = {
  id: string;
  user_id?: string;
  event_type?: string;
  ip_address?: string;
  risk_level?: string;
  status?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
};

type GeoFence = {
  id: string;
  country_code: string;
  action: 'allow' | 'block';
  reason?: string;
  created_at?: string;
};

const tierStyles: Record<string, string> = {
  YELLOW: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  ORANGE: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  RED: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  BLACK: 'bg-neutral-900/80 text-white border-neutral-700',
};

const countryCoordinates: Record<string, [number, number]> = {
  US: [37, -95], IN: [21, 78], GB: [54, -2], DE: [51, 10],
  SG: [1, 103], AU: [-25, 133], BR: [-14, -51], JP: [36, 138],
  CA: [56, -106], FR: [46, 2], RU: [61, 105], CN: [35, 105],
  KR: [35, 127], NG: [8, 8], ZA: [-30, 26], EG: [26, 30],
  AR: [-38, -63], MX: [23, -102], IT: [41, 12], ES: [40, -4],
  NL: [52, 4], SE: [60, 18], NO: [60, 10], FI: [61, 25],
  DK: [56, 9], PL: [52, 19], TR: [38, 35], TH: [15, 100],
  VN: [14, 108], PH: [12, 121], MY: [2, 112], ID: [-5, 120],
  NZ: [-41, 174], PT: [39, -8], BE: [50, 4], CH: [46, 8],
  AT: [47, 13], IE: [53, -8], IL: [31, 34], AE: [23, 53],
};

const IP_GEOLOCATION_API = 'https://ipapi.co';

const hashCoordinate = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  const lon = hash - 180;
  const lat = ((hash * 7) % 180) - 90;
  return [lat, lon] as [number, number];
};

const toMapPoint = (event: { id: string; country_code?: string; ip_address?: string; latitude?: number; longitude?: number; threat_tier?: string; user_id?: string; city?: string; occurred_at?: string }) => {
  const country = event.country_code || event.ip_address?.split('.').slice(0, 2).join('.') || 'unknown';
  let lat: number, lon: number;
  if (event.latitude && event.longitude) {
    lat = event.latitude;
    lon = event.longitude;
  } else {
    const coords = countryCoordinates[country] ?? hashCoordinate(event.ip_address || country);
    lat = coords[0];
    lon = coords[1];
  }
  return { id: event.id, lat, lon, tier: event.threat_tier || 'YELLOW', user_id: event.user_id, ip: event.ip_address, city: event.city, country, time: event.occurred_at };
};

const pulseAnimation = `
@keyframes ping-slow {
  0% { transform: scale(1); opacity: 1; }
  75% { transform: scale(2.5); opacity: 0; }
  100% { transform: scale(3); opacity: 0; }
}
.pulse-dot { animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
`;

const KZADashboardTab = () => {
  const [incidents, setIncidents] = useState<KzaIncident[]>([]);
  const [threatEvents, setThreatEvents] = useState<KzaThreatEvent[]>([]);
  const [bans, setBans] = useState<KzaBan[]>([]);
  const [watchlist, setWatchlist] = useState<KzaUserProfile[]>([]);
  const [honeypotHits, setHoneypotHits] = useState<KzaThreatEvent[]>([]);
  const [geoEvents, setGeoEvents] = useState<GeoEvent[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [geoFences, setGeoFences] = useState<GeoFence[]>([]);
  const [allProfiles, setAllProfiles] = useState<KzaUserProfile[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<KzaIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: any } | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const mapRef = useRef<HTMLDivElement>(null);

  // Geo-fence state
  const [showGeoFenceDialog, setShowGeoFenceDialog] = useState(false);
  const [geoFenceCountry, setGeoFenceCountry] = useState('');
  const [geoFenceAction, setGeoFenceAction] = useState<'allow' | 'block'>('allow');
  const [geoFenceReason, setGeoFenceReason] = useState('');

  // IP Block state
  const [showBlockIPDialog, setShowBlockIPDialog] = useState(false);
  const [blockIP, setBlockIP] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockTier, setBlockTier] = useState('RED');

  // IP Reputation state
  const [ipReputations, setIpReputations] = useState<any[]>([]);
  const [testIpInput, setTestIpInput] = useState('');
  const [testIpResult, setTestIpResult] = useState<any>(null);
  const [testIpLoading, setTestIpLoading] = useState(false);
  const [reputationLoading, setReputationLoading] = useState(false);

  const fetchTable = useCallback(async (tableName: string, pageSize = 500) => {
    const { data, error } = await supabase.functions.invoke('admin-data-access', {
      body: { action: 'table_explorer', tableName, page: 1, pageSize },
    });
    if (error) throw error;
    return (data?.rows ?? []) as any[];
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [incidentRows, threatRows, banRows, profileRows, honeypotRows, geoRows, secRows] = await Promise.all([
        fetchTable('kza_admin_incidents', 100),
        fetchTable('kza_threat_events', 500),
        fetchTable('kza_banned_entities', 200),
        fetchTable('kza_user_profiles', 200),
        fetchTable('kza_honeypot_hits', 200),
        fetchTable('kza_geo_events', 500),
        fetchTable('security_events', 500),
      ]);

      setIncidents(incidentRows);
      setThreatEvents(threatRows);
      setBans(banRows.filter((ban: KzaBan) => ban.is_active));
      setAllProfiles(profileRows);
      setWatchlist(profileRows.filter((p: KzaUserProfile) => p.is_watchlisted));
      setHoneypotHits(honeypotRows);
        setGeoEvents(geoRows);
        setSecurityEvents(secRows);

        const { data: fenceData } = await supabase.from('kza_geo_fence').select('*').limit(200);

        const { data: repData } = await supabase.from('kza_ip_reputation').select('*').order('checked_at', { ascending: false }).limit(100);
        if (repData) setIpReputations(repData);
      if (fenceData) setGeoFences(fenceData);
    } catch (error) {
      console.error('Failed to load KZA data', error);
      toast.error('Unable to load KZA data.');
    } finally {
      setLoading(false);
    }
  }, [fetchTable]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('kza-incidents')
      .on('broadcast', { event: 'incident' }, ({ payload }) => {
        setIncidents((prev) => [payload as KzaIncident, ...prev].slice(0, 100));
      })
      .subscribe();

    const interval = window.setInterval(() => { loadData(); }, 30000);
    return () => { supabase.removeChannel(channel); window.clearInterval(interval); };
  }, [loadData]);

  const stats = useMemo(() => {
    const now = Date.now();
    const last24h = threatEvents.filter(e => e.created_at && now - new Date(e.created_at).getTime() < 86400000);
    const last7d = threatEvents.filter(e => e.created_at && now - new Date(e.created_at).getTime() < 604800000);
    const last30d = threatEvents.filter(e => e.created_at && now - new Date(e.created_at).getTime() < 2592000000);
    const tiers = threatEvents.reduce<Record<string, number>>((acc, e) => { const t = e.threat_tier ?? 'YELLOW'; acc[t] = (acc[t] || 0) + 1; return acc; }, {});
    const endpointCounts = threatEvents.reduce<Record<string, number>>((acc, e) => { if (e.endpoint_hit) acc[e.endpoint_hit] = (acc[e.endpoint_hit] || 0) + 1; return acc; }, {});
    const topEndpoints = Object.entries(endpointCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const ipCounts = threatEvents.reduce<Record<string, number>>((acc, e) => { if (e.ip_address) acc[e.ip_address] = (acc[e.ip_address] || 0) + 1; return acc; }, {});
    const topIps = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const countryCounts = geoEvents.reduce<Record<string, number>>((acc, e) => { if (e.country_code) acc[e.country_code] = (acc[e.country_code] || 0) + 1; return acc; }, {});
    const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const activeUsers5m = new Set(threatEvents.filter(e => e.created_at && now - new Date(e.created_at).getTime() < 300000).map(e => e.user_id).filter(Boolean));
    const secEvents24h = securityEvents.filter(e => e.timestamp && now - new Date(e.timestamp).getTime() < 86400000);
    const uploadEvents = threatEvents.filter(e => e.threat_type?.toLowerCase().includes('upload'));
    const downloadEvents = threatEvents.filter(e => e.threat_type?.toLowerCase().includes('download'));
    const blockedEvents = threatEvents.filter(e => e.threat_tier === 'BLACK' || e.threat_tier === 'RED');
    const avgThreatScore = allProfiles.length ? Math.round(allProfiles.reduce((s, p) => s + (p.threat_score || 0), 0) / allProfiles.length) : 0;
    return {
      last24h: last24h.length, last7d: last7d.length, last30d: last30d.length,
      tiers, topEndpoints, topIps, topCountries, activeUsers: activeUsers5m.size,
      secEvents24h: secEvents24h.length, uploadEvents: uploadEvents.length,
      downloadEvents: downloadEvents.length, blockedEvents: blockedEvents.length,
      avgThreatScore, totalProfiles: allProfiles.length, totalRequests: allProfiles.reduce((s, p) => s + (p.total_requests || 0), 0),
    };
  }, [threatEvents, geoEvents, securityEvents, allProfiles]);

  const mapPoints = useMemo(() => {
    const fromGeo = geoEvents.slice(0, 200).map(e => toMapPoint(e));
    const fromThreat = threatEvents.slice(0, 100).map(e => toMapPoint({
      id: e.id, ip_address: e.ip_address, country_code: e.payload_snapshot?.country,
      threat_tier: e.threat_tier, user_id: e.user_id, occurred_at: e.created_at,
    }));
    return [...fromGeo, ...fromThreat].slice(0, 300);
  }, [geoEvents, threatEvents]);

  const pendingCritical = incidents.filter(i => i.status === 'PENDING' && ['RED', 'BLACK'].includes(i.threat_tier ?? ''));

  // Security Operations
  const handleBanAction = async (action: string, payload: Record<string, unknown>) => {
    const { error } = await supabase.functions.invoke('admin-data-access', { body: { action, ...payload } });
    if (error) toast.error('Unable to update ban');
    else { toast.success('Ban updated'); loadData(); }
  };

  const handleIncidentStatus = async (incidentId: string, status: string) => {
    if (!incidentId) { toast.error('Incident not available yet'); return; }
    const { error } = await supabase.functions.invoke('admin-data-access', { body: { action: 'kza_update_incident_status', incidentId, status } });
    if (error) toast.error('Unable to update incident');
    else { toast.success('Incident updated'); loadData(); }
  };

  const handleBlockIP = async () => {
    if (!blockIP) return;
    const { error } = await supabase.functions.invoke('admin-data-access', {
      body: { action: 'kza_permanent_ban', ip_address: blockIP, ban_reason: blockReason || 'Blocked by admin', ban_tier: blockTier },
    });
    if (error) toast.error('Failed to block IP');
    else { toast.success(`IP ${blockIP} blocked`); setShowBlockIPDialog(false); setBlockIP(''); setBlockReason(''); loadData(); }
  };

  const handleRemoveBan = async (banId: string) => {
    await handleBanAction('kza_unban', { banId });
  };

  const handleAddGeoFence = async () => {
    if (!geoFenceCountry) return;
    const { error } = await supabase.from('kza_geo_fence').upsert(
      { country_code: geoFenceCountry.toUpperCase(), action: geoFenceAction, reason: geoFenceReason },
      { onConflict: 'country_code' }
    );
    if (error) toast.error('Failed to update geo-fence');
    else { toast.success(`Geo-fence ${geoFenceAction} for ${geoFenceCountry}`); setShowGeoFenceDialog(false); setGeoFenceCountry(''); setGeoFenceReason(''); loadData(); }
  };

  const handleRemoveGeoFence = async (id: string) => {
    const { error } = await supabase.from('kza_geo_fence').delete().eq('id', id);
    if (error) toast.error('Failed to remove geo-fence');
    else { toast.success('Geo-fence removed'); loadData(); }
  };

  const handleTestIpReputation = async () => {
    if (!testIpInput) return;
    setTestIpLoading(true);
    setTestIpResult(null);
    try {
      const resp = await fetch(`https://ipapi.co/${testIpInput}/json/`);
      if (!resp.ok) { toast.error('Failed to fetch IP data'); return; }
      const data = await resp.json();
      const orgLower = (data.org || '').toLowerCase();
      const vpnOrgs = ['nordvpn','expressvpn','private internet access','pia','cyberghost','surfshark','vyprvpn','hotspot shield','anchorfree','windscribe','protonvpn','mullvad','tor guard','ivpn','perfect privacy','airvpn','wevpn','tunnelbear','hidemyass','ipvanish','purevpn','zenmate'];
      const dcOrgs = ['amazon','aws','ec2','google cloud','gcp','microsoft azure','azure','digitalocean','linode','vultr','hetzner','ovh','scaleway','online.net','contabo','netcup','ionos','akamai','cloudflare','oracle cloud','ibm cloud','alibaba cloud','tencent cloud','upcloud','civo','dreamhost'];
      const isVpn = vpnOrgs.some(p => orgLower.includes(p));
      const isDc = dcOrgs.some(p => orgLower.includes(p));
      let score = 0;
      if (isVpn) score = 80;
      else if (isDc) score = 60;
      const wouldBlock = score >= 60;
      setTestIpResult({ ...data, isVpn, isDc, score, wouldBlock });
    } catch { toast.error('Failed to check IP'); }
    finally { setTestIpLoading(false); }
  };

  const handleClearReputationCache = async () => {
    setReputationLoading(true);
    try {
      const { error } = await supabase.from('kza_ip_reputation').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast.success('IP reputation cache cleared');
      loadData();
    } catch { toast.error('Failed to clear cache'); }
    finally { setReputationLoading(false); }
  };

  const handleRestrictUser = async (userId: string, restricted: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_restricted: restricted }).eq('id', userId);
    if (error) toast.error('Failed to update user restriction');
    else { toast.success(restricted ? 'User restricted' : 'User unrestricted'); loadData(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading KZA telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{pulseAnimation}</style>

      {/* Critical Alert Banner */}
      {pendingCritical.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent p-4">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.1),transparent_70%)]" />
          <div className="relative flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-400">{pendingCritical.length} unacknowledged critical incident{pendingCritical.length > 1 ? 's' : ''}</p>
              <p className="text-xs text-red-400/70 mt-0.5">Immediate action required — RED/BLACK tier threats active</p>
            </div>
            <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => setActiveTab('incidents')}>
              <Eye className="mr-2 h-3 w-3" /> Review
            </Button>
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { label: '24h Threats', value: stats.last24h, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Active Users', value: stats.activeUsers, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Active Bans', value: bans.length, icon: Ban, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Honeypot Hits', value: honeypotHits.length, icon: Bug, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Sec Events (24h)', value: stats.secEvents24h, icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Avg Threat Score', value: stats.avgThreatScore, icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: 'Uploads Flagged', value: stats.uploadEvents, icon: Upload, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Blocked Attempts', value: stats.blockedEvents, icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10' },
        ].map(stat => (
          <Card key={stat.label} className="border-border/30 bg-card/40 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2"><Globe className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="incidents" className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Incidents</TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2"><Shield className="h-4 w-4" /> Security Ops</TabsTrigger>
          <TabsTrigger value="monitor" className="flex items-center gap-2"><Activity className="h-4 w-4" /> Monitor</TabsTrigger>
          <TabsTrigger value="bans" className="flex items-center gap-2"><Ban className="h-4 w-4" /> Bans</TabsTrigger>
          <TabsTrigger value="geo" className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Geo-Fence</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Global Map */}
          <Card className="border-border/30 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4 text-primary" />
                    Global Activity Map
                  </CardTitle>
                  <CardDescription>Real-time user access locations from KZA telemetry</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">{mapPoints.length} active signals</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={mapRef} className="relative h-[400px] w-full overflow-hidden rounded-xl border border-border/30 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
                {/* SVG World Map */}
                <svg viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full opacity-[0.12]" preserveAspectRatio="xMidYMid meet">
                  <g fill="currentColor" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.4">
                    <path d="M140,95 L155,90 L175,92 L195,88 L210,92 L225,90 L240,95 L250,100 L255,110 L250,120 L240,128 L225,135 L210,140 L195,142 L180,145 L165,150 L150,155 L140,160 L130,165 L120,168 L110,170 L105,168 L108,158 L112,148 L115,140 L118,130 L122,120 L125,112 L130,105 L135,98 Z" fillOpacity="0.3" />
                    <path d="M120,172 L135,168 L148,165 L160,162 L170,165 L178,170 L185,178 L188,188 L185,198 L178,208 L165,215 L150,218 L138,215 L128,210 L120,200 L115,190 L114,180 Z" fillOpacity="0.25" />
                    <path d="M185,200 L205,195 L225,200 L240,210 L248,225 L250,240 L245,258 L235,270 L220,280 L205,285 L190,282 L178,275 L168,262 L162,248 L160,232 L163,218 L170,208 Z" fillOpacity="0.3" />
                    <path d="M440,88 L460,84 L480,86 L500,90 L515,98 L520,108 L515,118 L505,125 L490,130 L475,132 L458,130 L442,126 L432,118 L428,108 L430,98 Z" fillOpacity="0.35" />
                    <path d="M490,100 L510,95 L530,98 L548,105 L560,115 L565,128 L558,140 L545,148 L528,152 L510,150 L495,145 L482,138 L475,128 L472,118 L478,108 Z" fillOpacity="0.35" />
                    <path d="M555,140 L575,135 L595,140 L612,150 L622,162 L625,175 L618,188 L605,195 L588,198 L570,195 L555,188 L542,178 L535,165 L538,152 Z" fillOpacity="0.35" />
                    <path d="M618,185 L640,180 L660,185 L678,195 L688,208 L690,222 L682,235 L668,242 L650,245 L632,242 L618,232 L608,220 L605,208 L608,196 Z" fillOpacity="0.35" />
                    <path d="M690,210 L710,205 L730,210 L745,220 L752,232 L750,245 L740,255 L725,258 L710,255 L698,248 L690,238 L686,226 Z" fillOpacity="0.3" />
                    <path d="M755,230 L770,225 L785,230 L795,240 L798,252 L792,262 L780,268 L765,265 L755,258 L748,248 Z" fillOpacity="0.25" />
                    <path d="M340,168 L360,162 L380,165 L400,172 L415,182 L425,195 L430,210 L428,225 L420,238 L408,248 L392,252 L375,250 L358,245 L345,235 L335,222 L330,208 L332,192 L335,178 Z" fillOpacity="0.3" />
                    <path d="M390,260 L410,255 L430,260 L445,270 L455,285 L458,300 L452,318 L442,332 L428,340 L412,342 L398,338 L385,328 L375,315 L370,300 L372,282 L378,268 Z" fillOpacity="0.3" />
                    <path d="M428,348 L442,342 L458,345 L470,352 L475,365 L470,378 L458,385 L442,388 L430,385 L420,378 L415,365 L418,355 Z" fillOpacity="0.25" />
                    <path d="M520,260 L540,255 L560,258 L578,268 L588,282 L590,298 L582,312 L568,322 L550,325 L532,322 L518,312 L510,298 L508,282 L512,270 Z" fillOpacity="0.35" />
                    <path d="M568,325 L585,320 L602,325 L615,335 L620,350 L615,365 L602,372 L585,375 L570,372 L558,365 L552,350 L555,335 Z" fillOpacity="0.35" />
                    <path d="M620,375 L640,370 L658,375 L672,385 L678,400 L672,415 L658,422 L640,425 L625,422 L612,412 L608,400 L610,388 Z" fillOpacity="0.3" />
                    <path d="M800,215 L820,210 L840,215 L855,225 L862,240 L860,255 L850,265 L835,270 L818,268 L805,260 L795,248 L792,235 L795,225 Z" fillOpacity="0.25" />
                    <path d="M835,275 L850,270 L865,275 L875,285 L878,300 L872,312 L860,318 L845,320 L832,315 L822,305 L818,292 L822,280 Z" fillOpacity="0.22" />
                  </g>
                </svg>

                {/* Map points */}
                {mapPoints.map((point) => {
                  const x = ((point.lon + 180) / 360) * 100;
                  const y = ((90 - point.lat) / 180) * 100;
                  const color = point.tier === 'BLACK' ? '#111827' : point.tier === 'RED' ? '#ef4444'
                    : point.tier === 'ORANGE' ? '#f97316' : point.tier === 'YELLOW' ? '#facc15' : '#22c55e';
                  return (
                    <div key={point.id} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                      <div
                        className="relative cursor-pointer group"
                        onMouseEnter={(e) => {
                          const rect = mapRef.current?.getBoundingClientRect();
                          if (rect) setHoveredPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top, data: point });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <div className="h-3 w-3 rounded-full shadow-lg transition-transform duration-200 hover:scale-150" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                        <div className="absolute inset-0 h-3 w-3 rounded-full pulse-dot" style={{ background: color, opacity: 0.4 }} />
                      </div>
                    </div>
                  );
                })}

                {/* Tooltip */}
                {hoveredPoint && (
                  <div className="absolute z-50 rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl p-3 shadow-2xl text-xs pointer-events-none"
                    style={{ left: Math.min(hoveredPoint.x + 12, 600), top: Math.max(hoveredPoint.y - 100, 0) }}>
                    <div className="space-y-1.5 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-primary" />
                        <span className="font-medium">{hoveredPoint.data.country}</span>
                      </div>
                      {hoveredPoint.data.city && <p className="text-muted-foreground">{hoveredPoint.data.city}</p>}
                      {hoveredPoint.data.ip && <p className="font-mono text-[10px] text-muted-foreground">IP: {hoveredPoint.data.ip}</p>}
                      {hoveredPoint.data.user_id && <p className="font-mono text-[10px] text-muted-foreground">User: {hoveredPoint.data.user_id.slice(0, 8)}...</p>}
                      {hoveredPoint.data.time && <p className="text-muted-foreground">{new Date(hoveredPoint.data.time).toLocaleString()}</p>}
                      <Badge className={tierStyles[hoveredPoint.data.tier] || ''}>{hoveredPoint.data.tier}</Badge>
                    </div>
                  </div>
                )}

                {/* Map overlay stats */}
                <div className="absolute bottom-3 left-3 flex gap-2">
                  <div className="rounded-full bg-background/80 backdrop-blur-sm px-3 py-1 text-xs text-muted-foreground border border-border/30">
                    {stats.activeUsers} active users
                  </div>
                  <div className="rounded-full bg-background/80 backdrop-blur-sm px-3 py-1 text-xs text-muted-foreground border border-border/30">
                    {stats.last24h} events (24h)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deep Stats */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Country Distribution */}
            <Card className="border-border/30 lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-primary" /> Top Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topCountries.map(([country, count]) => {
                    const maxVal = stats.topCountries[0]?.[1] || 1;
                    return (
                      <div key={country} className="flex items-center gap-2">
                        <span className="w-6 text-xs font-mono text-muted-foreground">{country}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${(count / maxVal) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                  {stats.topCountries.length === 0 && <p className="text-xs text-muted-foreground">No geo data available</p>}
                </div>
              </CardContent>
            </Card>

            {/* Tier Distribution */}
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-primary" /> Threat Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.tiers).map(([tier, count]) => {
                    const total = Object.values(stats.tiers).reduce((a, b) => a + b, 0) || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={tier} className="flex items-center gap-3">
                        <Badge className={`${tierStyles[tier] || ''} w-16 justify-center text-xs`}>{tier}</Badge>
                        <div className="flex-1 h-3 rounded-full bg-muted/30 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${
                            tier === 'BLACK' ? 'bg-neutral-700' : tier === 'RED' ? 'bg-red-500' : tier === 'ORANGE' ? 'bg-orange-500' : 'bg-yellow-500'
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Top Endpoints */}
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Terminal className="h-4 w-4 text-primary" /> Top Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topEndpoints.map(([endpoint, count]) => (
                    <div key={endpoint} className="flex items-center justify-between rounded-lg border border-border/20 bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                        <span className="text-xs font-mono truncate max-w-[180px]">{endpoint}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                  {stats.topEndpoints.length === 0 && <p className="text-xs text-muted-foreground">No endpoint data</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top IPs & Threat Timeline */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Network className="h-4 w-4 text-primary" /> Top Attacker IPs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {stats.topIps.map(([ip, count]) => (
                    <div key={ip} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/20">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-3 w-3 text-red-400" />
                        <span className="text-xs font-mono">{ip}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full bg-red-500/60" style={{ width: `${Math.min((count / (stats.topIps[0]?.[1] || 1)) * 100, 100)}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                  {stats.topIps.length === 0 && <p className="text-xs text-muted-foreground">No IP data available</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4 text-primary" /> Rolling Windows</CardTitle>
                <CardDescription>Threat event volume over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '24 Hours', value: stats.last24h, change: stats.last24h > stats.last7d / 7 ? 'up' : 'down', color: stats.last24h > stats.last7d / 7 ? 'text-red-400' : 'text-emerald-400' },
                    { label: '7 Days', value: stats.last7d, change: stats.last7d > stats.last30d / 4 ? 'up' : 'down', color: stats.last7d > stats.last30d / 4 ? 'text-orange-400' : 'text-emerald-400' },
                    { label: '30 Days', value: stats.last30d, change: 'neutral', color: 'text-blue-400' },
                  ].map(w => (
                    <div key={w.label} className="rounded-xl border border-border/20 bg-muted/10 p-4 text-center">
                      <p className="text-2xl font-bold tabular-nums">{w.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{w.label}</p>
                      {w.change !== 'neutral' && (
                        <div className={`flex items-center justify-center gap-1 mt-1 ${w.color}`}>
                          {w.change === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          <span className="text-[10px]">{w.change === 'up' ? 'Increasing' : 'Decreasing'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/20 bg-muted/10 p-3">
                    <p className="text-xs text-muted-foreground">Total Requests Tracked</p>
                    <p className="text-lg font-bold tabular-nums">{stats.totalRequests.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-border/20 bg-muted/10 p-3">
                    <p className="text-xs text-muted-foreground">User Profiles</p>
                    <p className="text-lg font-bold tabular-nums">{stats.totalProfiles}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== INCIDENTS TAB ===== */}
        <TabsContent value="incidents" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Live Incident Feed</h3>
              <p className="text-xs text-muted-foreground">{incidents.length} total incidents • {pendingCritical.length} critical</p>
            </div>
            <Button size="sm" variant="outline" onClick={loadData}><RefreshCw className="mr-2 h-3 w-3" /> Refresh</Button>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {incidents.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No incidents detected. System nominal.</p>}
            {incidents.map((incident) => (
              <div key={incident.id ?? incident.threat_event_id} className="rounded-xl border border-border/30 bg-card/40 p-4 hover:bg-card/60 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge className={tierStyles[incident.threat_tier ?? 'YELLOW']}>{incident.threat_tier ?? 'UNKNOWN'}</Badge>
                      {incident.status === 'PENDING' && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                    </div>
                    <p className="text-sm font-semibold">{incident.incident_title ?? 'KZA Incident'}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Network className="h-3 w-3" /> {incident.network_intel?.ip ?? 'Unknown IP'}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Now'}</span>
                      {incident.what_was_targeted && <span className="flex items-center gap-1"><Terminal className="h-3 w-3" /> {incident.what_was_targeted}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleBanAction('kza_permanent_ban', { incident })}><Ban className="mr-1 h-3 w-3" /> Ban</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                      onClick={() => handleBanAction('kza_extend_ban', { incident })}><Lock className="mr-1 h-3 w-3" /> Extend</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => handleIncidentStatus(incident.id ?? incident.threat_event_id ?? '', 'FALSE_POSITIVE')}><XCircle className="mr-1 h-3 w-3" /> False Pos</Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => setSelectedIncident(incident)}><Eye className="mr-1 h-3 w-3" /> View</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ===== SECURITY OPS TAB ===== */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Block IP */}
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Ban className="h-4 w-4 text-red-400" /> Block IP</CardTitle>
                <CardDescription>Permanently block a malicious IP address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">IP Address</Label>
                  <Input placeholder="192.168.1.1" value={blockIP} onChange={e => setBlockIP(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Reason</Label>
                  <Input placeholder="Malicious activity" value={blockReason} onChange={e => setBlockReason(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Tier</Label>
                  <Select value={blockTier} onValueChange={setBlockTier}>
                    <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YELLOW">Yellow - Watch</SelectItem>
                      <SelectItem value="ORANGE">Orange - Rate Limit</SelectItem>
                      <SelectItem value="RED">Red - 24h Ban</SelectItem>
                      <SelectItem value="BLACK">Black - Permanent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full h-9 text-xs" disabled={!blockIP} onClick={handleBlockIP}>
                  <Ban className="mr-2 h-3 w-3" /> Block IP
                </Button>
              </CardContent>
            </Card>

            {/* Geo-Fence Quick */}
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-blue-400" /> Geo-Fence</CardTitle>
                <CardDescription>Block or allow countries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {geoFences.slice(0, 8).map(f => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-border/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium">{f.country_code}</span>
                        <Badge className={f.action === 'allow' ? 'bg-emerald-500/15 text-emerald-400 text-[10px]' : 'bg-red-500/15 text-red-400 text-[10px]'}>{f.action}</Badge>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                        onClick={() => handleRemoveGeoFence(f.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  {geoFences.length === 0 && <p className="text-xs text-muted-foreground">No geo-fence rules configured</p>}
                </div>
                <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setShowGeoFenceDialog(true)}>
                  <Plus className="mr-2 h-3 w-3" /> Add Rule
                </Button>
              </CardContent>
            </Card>

            {/* User Restrictions */}
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-purple-400" /> User Restrictions</CardTitle>
                <CardDescription>Restrict or unrestrict user accounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[260px] overflow-y-auto">
                {allProfiles.filter(p => p.threat_score && p.threat_score > 50).slice(0, 8).map(profile => (
                  <div key={profile.user_id} className="flex items-center justify-between rounded-lg border border-border/20 px-3 py-2">
                    <div>
                      <p className="text-xs font-mono">{profile.user_id.slice(0, 12)}...</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">Score: {profile.threat_score}</Badge>
                        {profile.typical_countries?.slice(0, 2).map(c => <span key={c} className="text-[10px] text-muted-foreground">{c}</span>)}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300"
                      onClick={() => handleRestrictUser(profile.user_id, true)}><UserX className="h-3 w-3" /></Button>
                  </div>
                ))}
                {allProfiles.filter(p => p.threat_score && p.threat_score > 50).length === 0 &&
                  <p className="text-xs text-muted-foreground">No high-risk users detected</p>}
              </CardContent>
            </Card>
          </div>

          {/* Recent Security Events */}
          <Card className="border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4 text-primary" /> Recent Security Events</CardTitle>
              <CardDescription>Latest {securityEvents.length} events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {securityEvents.slice(0, 50).map(event => (
                  <div key={event.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/20 text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        event.risk_level === 'critical' ? 'bg-red-500' : event.risk_level === 'high' ? 'bg-orange-500'
                          : event.risk_level === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <span className="font-mono text-[10px] text-muted-foreground w-20 truncate">{event.event_type}</span>
                      <span className="text-muted-foreground">{event.ip_address || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${
                        event.risk_level === 'critical' ? 'text-red-400 border-red-500/30' : event.risk_level === 'high' ? 'text-orange-400 border-orange-500/30'
                          : event.risk_level === 'medium' ? 'text-yellow-400 border-yellow-500/30' : 'text-blue-400 border-blue-500/30'
                      }`}>{event.risk_level}</Badge>
                      <span className="text-muted-foreground">{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MONITOR TAB ===== */}
        <TabsContent value="monitor" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Active Users */}
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-emerald-400" /> Active Sessions</CardTitle>
                <CardDescription>Users active in the last 5 minutes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {threatEvents.filter(e => e.created_at && Date.now() - new Date(e.created_at).getTime() < 300000).slice(0, 20).map(event => (
                    <div key={event.id} className="flex items-center justify-between rounded-lg border border-border/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-mono">{event.user_id?.slice(0, 12)}...</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{event.ip_address}</span>
                        <Badge className={tierStyles[event.threat_tier ?? 'YELLOW'] || ''}>{event.threat_tier}</Badge>
                      </div>
                    </div>
                  ))}
                  {threatEvents.filter(e => e.created_at && Date.now() - new Date(e.created_at).getTime() < 300000).length === 0 &&
                    <p className="text-xs text-muted-foreground">No active sessions</p>}
                </div>
              </CardContent>
            </Card>

            {/* Watchlist */}
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Fingerprint className="h-4 w-4 text-orange-400" /> Watchlist</CardTitle>
                <CardDescription>{watchlist.length} accounts under surveillance</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">User ID</TableHead>
                      <TableHead className="text-xs">Threat Score</TableHead>
                      <TableHead className="text-xs">Countries</TableHead>
                      <TableHead className="text-xs">Endpoints</TableHead>
                      <TableHead className="text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {watchlist.map(profile => (
                      <TableRow key={profile.user_id}>
                        <TableCell className="font-mono text-xs">{profile.user_id.slice(0, 12)}...</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{profile.threat_score ?? 0}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(profile.typical_countries ?? []).slice(0, 3).join(', ')}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(profile.typical_endpoints ?? []).slice(0, 2).join(', ')}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400"
                            onClick={() => handleRestrictUser(profile.user_id, true)}><UserX className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {watchlist.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No watchlisted accounts</p>}
              </CardContent>
            </Card>
          </div>

          {/* Honeypot Hits */}
          <Card className="border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Bug className="h-4 w-4 text-purple-400" /> Honeypot Activity</CardTitle>
              <CardDescription>{honeypotHits.length} total trap triggers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {honeypotHits.slice(0, 30).map(hit => (
                  <div key={hit.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/20 text-xs">
                    <div className="flex items-center gap-3">
                      <Zap className="h-3 w-3 text-purple-400" />
                      <span className="font-mono text-muted-foreground">{hit.ip_address || 'N/A'}</span>
                      <span className="text-muted-foreground">{hit.endpoint_hit}</span>
                    </div>
                    <span className="text-muted-foreground">{hit.created_at ? new Date(hit.created_at).toLocaleString() : ''}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== BANS TAB ===== */}
        <TabsContent value="bans" className="space-y-4">
          <Card className="border-border/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm"><Ban className="h-4 w-4 text-orange-400" /> Banned Entities</CardTitle>
                  <CardDescription>{bans.length} active bans</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowBlockIPDialog(true)} className="h-8 text-xs">
                  <Plus className="mr-2 h-3 w-3" /> New Ban
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Entity</TableHead>
                    <TableHead className="text-xs">Tier</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Reason</TableHead>
                    <TableHead className="text-xs">Expires</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bans.map(ban => (
                    <TableRow key={ban.id}>
                      <TableCell className="font-mono text-xs">{ban.user_id?.slice(0, 12) || ban.ip_address || '...'}</TableCell>
                      <TableCell><Badge className={tierStyles[ban.ban_tier ?? 'RED'] || ''}>{ban.ban_tier ?? 'RED'}</Badge></TableCell>
                      <TableCell className="text-xs">{ban.ban_type ?? 'MANUAL'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{ban.attack_summary ?? ban.ban_reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ban.banned_until ? new Date(ban.banned_until).toLocaleDateString() : 'Permanent'}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:text-emerald-300"
                          onClick={() => handleRemoveBan(ban.id)}><Unlock className="mr-1 h-3 w-3" /> Unban</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {bans.length === 0 && <p className="text-xs text-muted-foreground py-8 text-center">No active bans</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== GEO-FENCE TAB ===== */}
        <TabsContent value="geo" className="space-y-4">
          {/* Geo-Fence Rules */}
          <Card className="border-border/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-blue-400" /> Geo-Fence Rules</CardTitle>
                  <CardDescription>Country-level access control</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowGeoFenceDialog(true)} className="h-8 text-xs">
                  <Plus className="mr-2 h-3 w-3" /> Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {geoFences.map(f => (
                  <div key={f.id} className={`rounded-xl border p-4 ${
                    f.action === 'allow' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{f.country_code}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                        onClick={() => handleRemoveGeoFence(f.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                    <Badge className={`mt-2 text-xs ${f.action === 'allow' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {f.action === 'allow' ? 'Allowed' : 'Blocked'}
                    </Badge>
                    {f.reason && <p className="text-xs text-muted-foreground mt-2">{f.reason}</p>}
                  </div>
                ))}
              </div>
              {geoFences.length === 0 && <p className="text-xs text-muted-foreground py-8 text-center">No geo-fence rules configured</p>}
            </CardContent>
          </Card>

          {/* IP Reputation Cache */}
          <Card className="border-border/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4 text-orange-400" /> IP Reputation Cache</CardTitle>
                  <CardDescription>{ipReputations.length} checked IPs</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs text-red-400 hover:text-red-300" onClick={handleClearReputationCache} disabled={reputationLoading}>
                  <Trash2 className="mr-2 h-3 w-3" /> Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {ipReputations.map(r => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/20 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-muted-foreground">{r.ip_address}</span>
                      {r.is_vpn && <Badge className="bg-red-500/15 text-red-400 text-[10px] border-0">VPN</Badge>}
                      {r.is_datacenter && <Badge className="bg-orange-500/15 text-orange-400 text-[10px] border-0">DC</Badge>}
                      {r.is_proxy && <Badge className="bg-yellow-500/15 text-yellow-400 text-[10px] border-0">Proxy</Badge>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono text-[10px] ${
                        r.score >= 80 ? 'text-red-400' : r.score >= 60 ? 'text-orange-400' : r.score >= 30 ? 'text-yellow-400' : 'text-emerald-400'
                      }`}>{r.score}</span>
                      <span className="text-muted-foreground">{r.country_code || ''}</span>
                      <span className="text-muted-foreground">{r.checked_at ? new Date(r.checked_at).toLocaleTimeString() : ''}</span>
                    </div>
                  </div>
                ))}
                {ipReputations.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No IP reputation data cached</p>}
              </div>
            </CardContent>
          </Card>

          {/* Test IP Tool */}
          <Card className="border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Search className="h-4 w-4 text-cyan-400" /> Test IP Against Rules</CardTitle>
              <CardDescription>Check how an IP would be classified by the geo-fence + reputation system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="8.8.8.8" value={testIpInput} onChange={e => setTestIpInput(e.target.value)} className="h-9 text-xs flex-1" />
                <Button size="sm" className="h-9 text-xs" onClick={handleTestIpReputation} disabled={testIpLoading || !testIpInput}>
                  {testIpLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Search className="h-3 w-3 mr-2" />}
                  Check
                </Button>
              </div>
              {testIpResult && (
                <div className="mt-3 rounded-xl border border-border/30 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className={`h-4 w-4 ${testIpResult.wouldBlock ? 'text-red-400' : 'text-emerald-400'}`} />
                      <span className="font-semibold">{testIpResult.ip}</span>
                    </div>
                    <Badge className={`${testIpResult.wouldBlock ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                      {testIpResult.wouldBlock ? 'Blocked' : 'Allowed'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Score:</span> <span className="font-mono">{testIpResult.score}/100</span></div>
                    <div><span className="text-muted-foreground">Country:</span> {testIpResult.country_code || testIpResult.country || 'N/A'}</div>
                    <div><span className="text-muted-foreground">Org:</span> {testIpResult.org || 'N/A'}</div>
                    <div><span className="text-muted-foreground">ISP:</span> {testIpResult.isp || 'N/A'}</div>
                    <div><span className="text-muted-foreground">VPN:</span> {testIpResult.isVpn ? 'Yes' : 'No'}</div>
                    <div><span className="text-muted-foreground">Datacenter:</span> {testIpResult.isDc ? 'Yes' : 'No'}</div>
                  </div>
                  {testIpResult.wouldBlock && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                      <Lock className="h-3 w-3 text-red-400" />
                      <span className="text-red-400 text-[11px]">This IP would be blocked at the edge</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== INCIDENT DETAIL DIALOG ===== */}
      <Dialog open={Boolean(selectedIncident)} onOpenChange={(open) => !open && setSelectedIncident(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              Incident Report
            </DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge className={tierStyles[selectedIncident.threat_tier ?? 'YELLOW']}>{selectedIncident.threat_tier}</Badge>
                <span className="font-semibold">{selectedIncident.incident_title}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="border-border/30"><CardHeader className="pb-2"><CardTitle className="text-xs">Attacker Profile</CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground"><pre className="whitespace-pre-wrap">{JSON.stringify(selectedIncident.attacker_profile, null, 2)}</pre></CardContent></Card>
                <Card className="border-border/30"><CardHeader className="pb-2"><CardTitle className="text-xs">Network Intel</CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground"><pre className="whitespace-pre-wrap">{JSON.stringify(selectedIncident.network_intel, null, 2)}</pre></CardContent></Card>
              </div>
              <Card className="border-border/30"><CardHeader className="pb-2"><CardTitle className="text-xs">Attack Timeline</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {(selectedIncident.attack_timeline ?? []).map((step, idx) => (
                    <div key={`${step.timestamp}-${idx}`} className="flex items-start gap-2">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      <div><p className="font-medium text-foreground">{step.action}</p><p>{step.endpoint} • {step.result} • {step.timestamp}</p></div>
                    </div>
                  ))}
                </CardContent></Card>
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="border-border/30"><CardHeader className="pb-2"><CardTitle className="text-xs">Targeted</CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground">{selectedIncident.what_was_targeted}</CardContent></Card>
                <Card className="border-border/30"><CardHeader className="pb-2"><CardTitle className="text-xs">Potential Harm</CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground">{selectedIncident.potential_harm}</CardContent></Card>
              </div>
              <div className="flex flex-wrap gap-2">{(selectedIncident.techniques_used ?? []).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleIncidentStatus(selectedIncident.id ?? selectedIncident.threat_event_id ?? '', 'ACKNOWLEDGED')}>
                  <ShieldCheck className="mr-2 h-3 w-3" /> Acknowledge
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleIncidentStatus(selectedIncident.id ?? selectedIncident.threat_event_id ?? '', 'RESOLVED')}>
                  <Shield className="mr-2 h-3 w-3" /> Resolve
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleIncidentStatus(selectedIncident.id ?? selectedIncident.threat_event_id ?? '', 'FALSE_POSITIVE')}>
                  <XCircle className="mr-2 h-3 w-3" /> False Positive
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== GEO-FENCE DIALOG ===== */}
      <Dialog open={showGeoFenceDialog} onOpenChange={setShowGeoFenceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Geo-Fence Rule</DialogTitle><DialogDescription>Block or allow a country code</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Country Code</Label>
              <Input placeholder="US, CN, RU, ..." value={geoFenceCountry} onChange={e => setGeoFenceCountry(e.target.value.toUpperCase())} className="h-9 text-xs mt-1" maxLength={2} /></div>
            <div><Label className="text-xs">Action</Label>
              <Select value={geoFenceAction} onValueChange={(v: 'allow' | 'block') => setGeoFenceAction(v)}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="block">Block</SelectItem>
                </SelectContent>
              </Select></div>
            <div><Label className="text-xs">Reason (optional)</Label>
              <Input placeholder="Why?" value={geoFenceReason} onChange={e => setGeoFenceReason(e.target.value)} className="h-9 text-xs mt-1" /></div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowGeoFenceDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddGeoFence} disabled={!geoFenceCountry}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BLOCK IP DIALOG ===== */}
      <Dialog open={showBlockIPDialog} onOpenChange={setShowBlockIPDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Block IP Address</DialogTitle><DialogDescription>Add a new ban entry</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">IP Address</Label>
              <Input placeholder="192.168.1.1" value={blockIP} onChange={e => setBlockIP(e.target.value)} className="h-9 text-xs mt-1" /></div>
            <div><Label className="text-xs">Reason</Label>
              <Input placeholder="Why?" value={blockReason} onChange={e => setBlockReason(e.target.value)} className="h-9 text-xs mt-1" /></div>
            <div><Label className="text-xs">Tier</Label>
              <Select value={blockTier} onValueChange={setBlockTier}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YELLOW">Yellow - Watch</SelectItem>
                  <SelectItem value="ORANGE">Orange - Rate Limit</SelectItem>
                  <SelectItem value="RED">Red - 24h Ban</SelectItem>
                  <SelectItem value="BLACK">Black - Permanent</SelectItem>
                </SelectContent>
              </Select></div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowBlockIPDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleBlockIP} disabled={!blockIP}>Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KZADashboardTab;
