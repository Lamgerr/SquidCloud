import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Home, ArrowLeft } from '@/lib/icon-map';
import { PageFrame } from '@/components/layout/PageFrame';

const NF_CSS = `
.nf-body{max-width:400px;margin:0 auto;text-align:center}
.nf-mark{width:56px;height:56px;margin:0 auto 24px;display:grid;place-items:center;border:1px solid var(--sa-line,#1f2221);border-radius:16px;color:var(--sa-mute,#8d8f89)}
.nf-mark svg{width:24px;height:24px;stroke-width:1.6}
.nf-actions{display:grid;gap:8px}
.nf-help{margin-top:24px;font-size:12px;color:var(--sa-mute,#8d8f89)}
.nf-help a{color:var(--sa-text,#e8e7e1);text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--sa-line,#1f2221)}
`;

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const badPath = location.pathname.length > 48
    ? `…${location.pathname.slice(-47)}`
    : location.pathname;

  return (
    <PageFrame
      title="This page doesn't exist"
      subtitle={`Nothing lives at ${badPath}. Check the address or head somewhere useful.`}
    >
      <style>{NF_CSS}</style>
      <div className="nf-body">
        <div className="nf-mark"><MapPin className="h-6 w-6" /></div>
        <div className="nf-actions">
          <Button onClick={() => navigate('/dashboard')} className="w-full h-11">
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)} className="w-full h-11">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
        <p className="nf-help">
          Looking for help? <Link to="/help/docs">Browse the docs</Link>
        </p>
      </div>
    </PageFrame>
  );
};

export default NotFound;
