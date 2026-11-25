import React from 'react';
import { PageFrame } from '@/components/layout/PageFrame';
import { useAuth } from '@/contexts/AuthContext';

const PROFILE_CSS = `
.pr-body{max-width:520px;margin:0 auto}
.pr-row{display:grid;gap:6px;padding:16px 2px;border-bottom:1px solid var(--sa-line,#1f2221)}
.pr-row:last-child{border-bottom:0}
.pr-k{font:400 11px/1.4 var(--sa-f,-apple-system,sans-serif);letter-spacing:.12em;text-transform:uppercase;color:var(--sa-mute,#8d8f89)}
.pr-v{font-size:14px;color:var(--sa-text,#e8e7e1);overflow-wrap:anywhere}
.pr-mono{font-family:var(--sa-mono,ui-monospace,monospace)}
`;

const Profile = () => {
  const { user } = useAuth();

  return (
    <PageFrame title="Profile" subtitle="Your SquidCloud account details.">
      <style>{PROFILE_CSS}</style>
      <div className="pr-body">
        <div className="pr-row">
          <span className="pr-k">Email</span>
          <span className="pr-v">{user?.email || 'Not available'}</span>
        </div>
        <div className="pr-row">
          <span className="pr-k">User ID</span>
          <span className="pr-v pr-mono">{user?.id || 'Not available'}</span>
        </div>
      </div>
    </PageFrame>
  );
};

export default Profile;
