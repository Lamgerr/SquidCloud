import React, { useState, useEffect } from 'react';
import { PageFrame } from '@/components/layout/PageFrame';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle, XCircle, Clock } from '@/lib/icon-map';

const AP_CSS = `
.ap-refresh{display:flex;justify-content:center;margin-bottom:20px}
.ap-refresh button{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;
  border:1px solid var(--sa-line,#1f2221);border-radius:8px;
  background:var(--sa-bg-2,#0e1110);color:var(--sa-text,#e8e7e1);
  font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.ap-refresh button:hover{background:var(--sa-bg-3,#141816)}
.ap-refresh button:disabled{opacity:.5}
.ap-refresh svg{width:14px;height:14px}
.ap-spin{animation:ap-rotate 1s linear infinite}
@keyframes ap-rotate{to{transform:rotate(360deg)}}
.ap-panel{border:1px solid var(--sa-line,#1f2221);border-radius:14px;padding:20px}
.ap-overall{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.ap-overall-left{display:flex;align-items:center;gap:12px}
.ap-overall-left>svg{width:20px;height:20px;color:var(--sa-text,#e8e7e1)}
.ap-overall h2{margin:0;font-size:16px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.ap-overall p{margin:3px 0 0;font-size:11px;color:var(--sa-mute,#8d8f89)}
.ap-uptime{text-align:right}
.ap-uptime strong{display:block;font-size:20px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.ap-uptime span{font-size:11px;color:var(--sa-mute,#8d8f89)}
.ap-list{display:grid;gap:8px;margin-top:12px}
.ap-service{border:1px solid var(--sa-line,#1f2221);border-radius:12px;padding:16px}
.ap-service-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ap-service-head h3{margin:0;font-size:13px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.ap-badge{border:1px solid var(--sa-line,#1f2221)!important;
  background:var(--sa-bg-2,#0e1110)!important;color:var(--sa-mute,#8d8f89)!important;
  font:400 10px/1.4 var(--sa-f,-apple-system,sans-serif)!important;
  border-radius:6px!important;padding:2px 8px!important;text-transform:none!important}
.ap-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}
@media(max-width:720px){.ap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ap-cell>span:first-child{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--sa-mute,#8d8f89)}
.ap-cell>span:first-child svg{width:14px;height:14px}
.ap-cell-value{margin-top:5px;font-size:15px;color:var(--sa-text,#e8e7e1)}
.ap-endpoint{font:400 11px/1.4 var(--sa-mono,monospace);color:var(--sa-mute,#8d8f89);
  padding:2px 6px;border-radius:5px;background:var(--sa-bg-2,#0e1110);overflow-wrap:anywhere}
.ap-cell-note{margin-top:5px;font-size:10px;color:var(--sa-dim,#62655f)}
.ap-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}
@media(max-width:720px){.ap-metrics{grid-template-columns:1fr}}
.ap-metric h3{margin:0 0 8px;font-size:11px;font-weight:400;color:var(--sa-mute,#8d8f89)}
.ap-metric strong{font-size:20px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.ap-metric p{margin:3px 0 0;font-size:10px;color:var(--sa-dim,#62655f)}
.ap-ok{color:var(--sa-text,#e8e7e1)}
.ap-warn,.ap-bad{color:var(--sa-mute,#8d8f89)}
.ap-idle{color:var(--sa-dim,#62655f)}
@media(prefers-reduced-motion:reduce){.ap-spin{animation:none}}
`;

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  uptime: number;
  responseTime: number;
  lastChecked: string;
  endpoint: string;
}

const APIStatus = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'File Upload API',
      status: 'operational',
      uptime: 99.9,
      responseTime: 245,
      lastChecked: new Date().toISOString(),
      endpoint: '/cc/ap/iops/v6/upload'
    },
    {
      name: 'File Download API',
      status: 'operational',
      uptime: 99.8,
      responseTime: 180,
      lastChecked: new Date().toISOString(),
      endpoint: '/cc/ap/iops/v6/download'
    },
    {
      name: 'File Delete API',
      status: 'operational',
      uptime: 99.9,
      responseTime: 120,
      lastChecked: new Date().toISOString(),
      endpoint: '/cc/ap/iops/v6/delete'
    },
    {
      name: 'File Info API',
      status: 'operational',
      uptime: 99.7,
      responseTime: 95,
      lastChecked: new Date().toISOString(),
      endpoint: '/cc/ap/iops/v6/info'
    },
    {
      name: 'Authentication API',
      status: 'operational',
      uptime: 99.9,
      responseTime: 150,
      lastChecked: new Date().toISOString(),
      endpoint: '/cc/ap/iops/v6/auth'
    },
    {
      name: 'Storage API',
      status: 'operational',
      uptime: 99.8,
      responseTime: 200,
      lastChecked: new Date().toISOString(),
      endpoint: '/cc/ap/iops/v6/storage'
    }
  ]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const refreshStatus = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update services with random variations for demo
    setServices(prev => prev.map(service => ({
      ...service,
      responseTime: service.responseTime + Math.floor(Math.random() * 50 - 25),
      uptime: Math.max(95, service.uptime + (Math.random() * 0.2 - 0.1)),
      lastChecked: new Date().toISOString()
    })));

    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="ap-ok" />;
      case 'degraded':
        return <AlertCircle className="ap-warn" />;
      case 'down':
        return <XCircle className="ap-bad" />;
      case 'maintenance':
        return <Clock className="ap-idle" />;
      default:
        return <AlertCircle className="ap-idle" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      operational: 'default',
      degraded: 'secondary',
      down: 'destructive',
      maintenance: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'} className="ap-badge">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const overallStatus = services.every(s => s.status === 'operational')
    ? 'All Systems Operational'
    : services.some(s => s.status === 'down')
    ? 'Major Outage'
    : 'Partial Outage';

  const averageUptime = services.reduce((acc, s) => acc + s.uptime, 0) / services.length;
  const averageResponseTime = services.reduce((acc, s) => acc + s.responseTime, 0) / services.length;

  useEffect(() => {
    const interval = setInterval(refreshStatus, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <PageFrame
      title="SquidCloud API Status"
      subtitle="Real-time status of all SquidCloud API services"
      wide
    >
      <style>{AP_CSS}</style>
      <div className="ap-refresh">
        <button
          onClick={refreshStatus}
          disabled={isRefreshing}
        >
          <RefreshCw className={isRefreshing ? 'ap-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="ap-panel">
        <div className="ap-overall">
          <div className="ap-overall-left">
            {getStatusIcon('operational')}
            <div>
              <h2>{overallStatus}</h2>
              <p>Last updated: {lastUpdate.toLocaleString()}</p>
            </div>
          </div>
          <div className="ap-uptime">
            <strong>{averageUptime.toFixed(1)}%</strong>
            <span>Average Uptime</span>
          </div>
        </div>
      </div>

      <div className="ap-list">
        {services.map((service, index) => (
          <div key={index} className="ap-service">
            <div className="ap-service-head">
              <h3>{service.name}</h3>
              {getStatusBadge(service.status)}
            </div>
            <div className="ap-grid">
              <div className="ap-cell">
                <span>{getStatusIcon(service.status)} Status</span>
                <div className="ap-cell-value">{service.status.charAt(0).toUpperCase() + service.status.slice(1)}</div>
              </div>

              <div className="ap-cell">
                <span>Uptime (30d)</span>
                <div className="ap-cell-value">{service.uptime.toFixed(1)}%</div>
              </div>

              <div className="ap-cell">
                <span>Avg Response</span>
                <div className="ap-cell-value">{service.responseTime}ms</div>
              </div>

              <div className="ap-cell">
                <span>Endpoint</span>
                <div className="ap-endpoint">{service.endpoint}</div>
                <div className="ap-cell-note">
                  Updated: {new Date(service.lastChecked).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="ap-metrics">
        <div className="ap-panel ap-metric">
          <h3>Response Time</h3>
          <strong>{Math.round(averageResponseTime)}ms</strong>
          <p>Average across all services</p>
        </div>

        <div className="ap-panel ap-metric">
          <h3>Incident Reports</h3>
          <strong>0</strong>
          <p>Active incidents</p>
        </div>

        <div className="ap-panel ap-metric">
          <h3>Scheduled Maintenance</h3>
          <strong>None</strong>
          <p>Upcoming maintenance windows</p>
        </div>
      </div>
    </PageFrame>
  );
};

export default APIStatus;
