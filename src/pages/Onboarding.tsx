import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { HardDrive, Shield, Lock, FolderOpen } from '@/lib/icon-map';
import MigrationWizard from '@/components/MigrationWizard';
import {
  AppShell, TopBar, Wrap, PageHead, Panel, Pill, Spinner, btn, useDocTitle,
} from '@/components/custom/squid-app';

/* ═══════════════════════════════════════════════════════════════
   ONBOARDING — first run only
   Two honest states, nothing decorative: no vault yet → create or
   import; vault exists → continue. Logic is unchanged.
   Place at: src/pages/Onboarding.tsx
   ═══════════════════════════════════════════════════════════════ */

const ONB_CSS = `
.ob-steps { display: grid; gap: 0; }
.ob-step { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px; padding: 14px 16px; }
.ob-step + .ob-step { border-top: 1px solid var(--sa-line); }
.ob-step .n { font: 400 11px/1.9 var(--sa-mono); letter-spacing: 0.1em; color: var(--sa-mute); }
.ob-step p { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--sa-text-2); }
.ob-act { display: flex; gap: 8px; flex-wrap: wrap; padding: 16px; border-top: 1px solid var(--sa-line); }
.ob-act .sa-btn { flex: 1 1 200px; }
.ob-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; border: 1px solid var(--sa-line); border-radius: 5px; background: var(--sa-bg-2); overflow: hidden; }
.ob-fact { padding: 18px 16px; }
.ob-fact + .ob-fact { border-left: 1px solid var(--sa-line); }
.ob-fact svg { color: var(--sa-mute); margin-bottom: 14px; }
.ob-fact h3 { margin: 0; font: 500 13px/1.3 var(--sa-f); }
.ob-fact p { margin: 5px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--sa-mute); }
@media (max-width: 720px) { .ob-facts { grid-template-columns: 1fr; } .ob-fact + .ob-fact { border-left: 0; border-top: 1px solid var(--sa-line); } }
.ob-center { display: grid; place-items: center; min-height: calc(100vh / var(--sa-zoom, 1) - 48px); }
`;

const Onboarding = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [repoCount, setRepoCount] = useState(0);
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/auth');
          return;
        }

        setUserId(session.user.id);

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_complete, repo_count')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          setLoading(false);
          return;
        }

        // Only show onboarding for users that have onboarding_complete set to false
        if (profile && profile.onboarding_complete) {
          navigate('/dashboard');
        } else {
          setRepoCount(profile?.repo_count || 0);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error in onboarding check:", error);
        setLoading(false);
      }
    };

    checkOnboarding();
  }, [navigate]);

  const completeOnboarding = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      // Only update onboarding_complete to true
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('id', userId);

      if (error) {
        console.error("Error updating onboarding status:", error);
        setLoading(false);
        return;
      }

      navigate('/dashboard');
    } catch (error) {
      console.error("Error completing onboarding:", error);
      setLoading(false);
    }
  };

  const handleCreateVault = () => {
    navigate('/r/c/1');
  };

  const handleMigrationComplete = () => {
    setShowMigration(false);
    // Refresh repo count
    window.location.reload();
  };

  useDocTitle(showMigration ? 'Import files' : 'Welcome');

  if (loading) {
    return (
      <AppShell>
        <style>{ONB_CSS}</style>
        <TopBar home="/" crumbs={[{ label: 'Setup' }]} />
        <div className="ob-center">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--sa-mute)', fontSize: 13 }}>
            <Spinner size={16} /> Checking your account…
          </div>
        </div>
      </AppShell>
    );
  }

  if (showMigration) {
    return (
      <AppShell>
        <style>{ONB_CSS}</style>
        <TopBar home="/" crumbs={[{ label: 'Setup', to: '/onboarding' }, { label: 'Import files' }]} />
        <Wrap>
          <MigrationWizard
            onComplete={handleMigrationComplete}
            onCancel={() => setShowMigration(false)}
          />
        </Wrap>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <style>{ONB_CSS}</style>
      <TopBar home="/" crumbs={[{ label: 'Setup' }]}>
        <Link to="/help/docs" className={btn('ghost', 'sm')}>Docs</Link>
      </TopBar>

      <Wrap width="narrow">
        <PageHead
          eyebrow={repoCount === 0 ? 'Step 1 of 2' : 'Step 2 of 2'}
          title="Welcome to SquidCloud"
          desc={
            repoCount === 0
              ? "A vault is where your files live. Create one now, or bring your existing files in."
              : "Your vault is ready. Head to the dashboard whenever you are."
          }
        />

        {repoCount === 0 ? (
          <>
            <Panel
              title="Create your storage vault"
              desc="To get started with SquidCloud, you'll need to:"
              actions={<Pill>Required</Pill>}
              flush
            >
              <div className="ob-steps">
                <div className="ob-step"><span className="n">01</span><p>Create a secure storage vault (max 2 vaults per user)</p></div>
                <div className="ob-step"><span className="n">02</span><p>Your files will be protected with end-to-end encryption</p></div>
                <div className="ob-step"><span className="n">03</span><p>Access dashboard features after vault creation</p></div>
              </div>
              <div className="ob-act">
                <button type="button" className={btn('primary', 'lg')} onClick={handleCreateVault} autoFocus>
                  <HardDrive className="h-4 w-4" />
                  Create storage vault
                </button>
                <button type="button" className={btn('default', 'lg')} onClick={() => setShowMigration(true)}>
                  <FolderOpen className="h-4 w-4" />
                  Import files
                </button>
              </div>
            </Panel>

            <div className="ob-facts">
              <div className="ob-fact">
                <Shield className="h-5 w-5" />
                <h3>End-to-End Encryption</h3>
                <p>All files are securely encrypted</p>
              </div>
              <div className="ob-fact">
                <Lock className="h-5 w-5" />
                <h3>Private Storage</h3>
                <p>Only you can access your files</p>
              </div>
              <div className="ob-fact">
                <HardDrive className="h-5 w-5" />
                <h3>Multiple Vaults</h3>
                <p>Create up to 2 secure vaults</p>
              </div>
            </div>
          </>
        ) : (
          <Panel
            title="All set! Let's get started"
            desc={`You've already created ${repoCount} storage vault${repoCount > 1 ? 's' : ''}. You're ready to use SquidCloud!`}
            actions={<Pill tone="ok">Vault ready</Pill>}
            flush
          >
            <div className="ob-act" style={{ borderTop: 0 }}>
              <button type="button" className={btn('primary', 'lg')} onClick={completeOnboarding} autoFocus>
                Continue to dashboard
              </button>
              <button type="button" className={btn('default', 'lg')} onClick={() => setShowMigration(true)}>
                <FolderOpen className="h-4 w-4" />
                Import files
              </button>
            </div>
          </Panel>
        )}
      </Wrap>
    </AppShell>
  );
};

export default Onboarding;
