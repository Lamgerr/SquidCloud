import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Home, ArrowLeft } from '@/lib/icon-map';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const badPath = location.pathname.length > 48
    ? `…${location.pathname.slice(-47)}`
    : location.pathname;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border">
          <MapPin className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground/70 uppercase">Error 404</p>        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          This page doesn't exist
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing lives at <code className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-foreground/90">{badPath}</code>. Check the address or head somewhere useful.
        </p>
        <div className="mt-6 grid gap-2">
          <Button onClick={() => navigate('/dashboard')} className="w-full h-11 rounded-xl active:scale-[0.99] transition-all">
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)} className="w-full h-11 rounded-xl active:scale-[0.99] transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground/60">
          Looking for help? <Link to="/help/docs" className="text-foreground/80 underline underline-offset-4 decoration-border hover:text-foreground hover:decoration-foreground transition-colors">Browse the docs</Link>
        </p>
      </div>
    </div>
  );
};

export default NotFound;