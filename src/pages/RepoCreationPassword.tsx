import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, AlertCircle, ArrowLeft } from '@/lib/icon-map';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageFrame } from '@/components/layout/PageFrame';

const RP_CSS = `
.rp-body{max-width:420px;margin:0 auto;text-align:left}
.rp-mark{width:48px;height:48px;margin:0 auto 20px;display:grid;place-items:center;border:1px solid var(--sa-line,#1f2221);border-radius:14px;color:var(--sa-mute,#8d8f89)}
.rp-mark svg{width:20px;height:20px;stroke-width:1.6}
.rp-back{display:flex;justify-content:center;margin-bottom:20px}
.rp-back button{display:inline-flex;align-items:center;gap:8px;background:transparent;border:0;padding:6px 2px;color:var(--sa-mute,#8d8f89);font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.rp-back button:hover{color:var(--sa-text,#e8e7e1)}
.rp-label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sa-text,#e8e7e1)}
.rp-label svg,.rp-shield{width:16px;height:16px;color:var(--sa-mute,#8d8f89)}
.rp-input{width:100%;height:44px;padding:0 14px;background:var(--sa-bg,#090b0a);border:1px solid var(--sa-line,#1f2221);border-radius:10px;color:var(--sa-text,#e8e7e1);font-size:14px}
.rp-input::placeholder{color:var(--sa-dim,#62655f)}
.rp-error{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--sa-text,#e8e7e1)}
.rp-actions{display:grid;gap:8px}
@media(max-width:720px){.rp-body{max-width:100%}}
`;

const RepoCreationPassword = () => {
  const { count } = useParams<{ count: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!password) {
      setError('Password is required');
      setIsLoading(false);
      return;
    }

    // Proceed to repo creation with the provided password
    navigate(`/r/c/${count}?password=${password}`);
  };

  return (
    <PageFrame title="Vault Setup" subtitle="Enter the access password to create secure vaults">
      <style>{RP_CSS}</style>
      <div className="rp-body">
        <div className="rp-mark"><Shield className="h-5 w-5" /></div>
        {isMobile && (
          <div className="rp-back">
            <button onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="rp-label">
              <Lock className="h-4 w-4" />
              Access Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Enter access password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rp-input"
            />

            {error && (
              <div className="rp-error">
                <AlertCircle className="h-4 w-4 mr-1" />
                {error}
              </div>
            )}
          </div>

          <div className="rp-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="w-full"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Continue'}
            </Button>
          </div>
        </form>
      </div>
    </PageFrame>
  );
};

export default RepoCreationPassword;
