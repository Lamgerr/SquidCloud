import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { PageFrame } from '@/components/layout/PageFrame';

const WI_CSS = `
.wi-body{max-width:460px;margin:0 auto;text-align:center}
.wi-msg{margin:0 auto 24px;font-size:14px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.wi-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.wi-id{margin-top:20px;font:400 11px/1.5 var(--sa-mono,ui-monospace,monospace);color:var(--sa-dim,#62655f);overflow-wrap:anywhere}
`;

const WorkspaceInvite: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { token: tokenParam } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => {
    if (tokenParam) return tokenParam;
    const fromParams = searchParams.get('token');
    if (fromParams) return fromParams;
    const fromLocation = new URLSearchParams(window.location.search).get('token');
    return fromLocation || '';
  }, [tokenParam, searchParams]);
  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>(() => (
    token ? 'idle' : 'error'
  ));
  const [message, setMessage] = useState<string>('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      if (!acceptedRef.current) {
        setStatus('error');
        setMessage('Invite token is missing or invalid.');
      }
      return;
    }

    if (acceptedRef.current) return;
    if (authLoading) return;

    if (!user) return;

    const acceptInvite = async () => {
      if (acceptedRef.current) return;
      setStatus('accepting');
      try {
        const { data, error } = await supabase.rpc('accept_workspace_invite', {
          p_token: token,
        });

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Invite could not be accepted.');
        }

        acceptedRef.current = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem('squid_active_workspace_id', data);
        }

        setWorkspaceId(data);
        setStatus('success');
        setMessage('Workspace invite accepted.');
        toast({
          title: 'Welcome to the workspace',
          description: 'Invite accepted successfully.',
        });
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'Failed to accept invite.');
      }
    };

    void acceptInvite();
  }, [token, user, authLoading, toast]);

  const handleSignIn = () => {
    const next = `/workspace/invite/${encodeURIComponent(token)}`;
    navigate(`/auth?next=${encodeURIComponent(next)}`);
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <PageFrame title="Workspace Invite" subtitle="Review and accept your invitation.">
      <style>{WI_CSS}</style>
      <div className="wi-body">
        <p className="wi-msg">
          {authLoading && 'Loading...'}
          {!authLoading && status === 'idle' && !user && 'Sign in to accept this workspace invite.'}
          {status === 'accepting' && 'Accepting your invite...'}
          {status === 'success' && message}
          {status === 'error' && (message || 'Unable to accept this invite.')}
        </p>

        <div className="wi-actions">
          {!authLoading && !user && token && (
            <Button onClick={handleSignIn}>Sign in to accept</Button>
          )}
          {status === 'success' && (
            <Button onClick={handleGoToDashboard}>Go to dashboard</Button>
          )}
          {status === 'error' && (
            <Button variant="outline" onClick={handleGoToDashboard}>Back to dashboard</Button>
          )}
        </div>

        {workspaceId && (
          <p className="wi-id">Workspace ID: {workspaceId}</p>
        )}
      </div>
    </PageFrame>
  );
};

export default WorkspaceInvite;
