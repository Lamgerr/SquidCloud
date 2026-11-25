import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Layers, Globe, Shield, Zap, Check, ArrowRight, Sparkles, HardDrive
} from '@/lib/icon-map';

const BT_CSS = `
.bt-root{min-height:100vh;background:var(--sa-bg,#090b0a);color:var(--sa-text,#e8e7e1)}
.bt-head{position:sticky;top:0;z-index:10;border-bottom:1px solid var(--sa-line,#1f2221);
  background:var(--sa-bg,#090b0a)}
.bt-head-in{display:flex;align-items:center;justify-content:space-between;
  max-width:880px;height:56px;margin:0 auto;padding:0 20px}
.bt-brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--sa-text,#e8e7e1)}
.bt-mark{display:grid;place-items:center;width:24px;height:24px;border:1px solid var(--sa-line,#1f2221);
  border-radius:7px;font-size:11px;font-weight:400}
.bt-brand-name{font-size:11px;font-weight:400;letter-spacing:.2em;text-transform:uppercase}
.bt-tag{padding:2px 7px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;
  font-size:10px;letter-spacing:.12em;color:var(--sa-mute,#8d8f89)}
.bt-dash{font-size:12px;text-decoration:none;color:var(--sa-mute,#8d8f89)}
.bt-dash:hover{color:var(--sa-text,#e8e7e1)}
.bt-wrap{max-width:880px;margin:0 auto;padding:0 20px}
.bt-hero{padding:72px 0 48px;text-align:center}
.bt-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;
  border:1px solid var(--sa-line,#1f2221);border-radius:999px;
  font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--sa-mute,#8d8f89)}
.bt-eyebrow i{display:block;width:6px;height:6px;border-radius:50%;background:var(--sa-text,#e8e7e1);font-style:normal}
.bt-hero h1{margin:24px 0 0;font-size:clamp(34px,6vw,56px);font-weight:300;
  line-height:1.06;letter-spacing:-.04em;color:var(--sa-text,#e8e7e1)}
.bt-hero h1 span{color:var(--sa-text,#e8e7e1)}
.bt-hero p{max-width:560px;margin:20px auto 0;font-size:13px;line-height:1.7;color:var(--sa-mute,#8d8f89)}
.bt-hero p strong{font-weight:400;color:var(--sa-text,#e8e7e1)}
.bt-actions{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:32px}
.bt-enroll{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 24px;
  border:1px solid var(--sa-line,#1f2221);border-radius:9px;
  background:var(--sa-bg-3,#141816);color:var(--sa-text,#e8e7e1);
  font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.bt-enroll:hover{background:var(--sa-bg-4,#1b201d)}
.bt-enroll:disabled{opacity:.5}
.bt-enroll svg{width:14px;height:14px}
.bt-done{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 24px;
  border:1px solid var(--sa-line,#1f2221);border-radius:9px;
  font-size:12px;color:var(--sa-text,#e8e7e1)}
.bt-done svg{width:14px;height:14px}
.bt-quiet{display:inline-flex;align-items:center;height:42px;padding:0 18px;
  border:1px solid var(--sa-line,#1f2221);border-radius:9px;font-size:11px;color:var(--sa-mute,#8d8f89)}
.bt-fine{margin:12px 0 0;font-size:11px;color:var(--sa-dim,#62655f)}
.bt-caption{margin:0 0 12px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--sa-dim,#62655f)}
.bt-rows{border-top:1px solid var(--sa-line,#1f2221)}
.bt-row{display:grid;grid-template-columns:20px 1fr;gap:12px;padding:18px 2px;
  border-bottom:1px solid var(--sa-line,#1f2221)}
.bt-row>svg{width:18px;height:18px;color:var(--sa-mute,#8d8f89);margin-top:2px}
.bt-row h3{margin:0 0 4px;font-size:13px;font-weight:400;color:var(--sa-text,#e8e7e1)}
.bt-row p{margin:0;font-size:12px;line-height:1.7;color:var(--sa-mute,#8d8f89)}
.bt-section{padding:24px 0}
.bt-note{display:flex;align-items:flex-start;gap:12px;padding:20px 0;text-align:left;
  border-top:1px solid var(--sa-line,#1f2221);border-bottom:1px solid var(--sa-line,#1f2221)}
.bt-note>svg{width:18px;height:18px;flex:none;color:var(--sa-mute,#8d8f89)}
.bt-note p{margin:0;font-size:12px;line-height:1.7;color:var(--sa-mute,#8d8f89)}
.bt-foot{border-top:1px solid var(--sa-line,#1f2221);padding:24px 20px 32px;text-align:center;
  font-size:11px;color:var(--sa-dim,#62655f)}
.bt-foot a{color:var(--sa-mute,#8d8f89)}
`;

const FEATURE = 'substrate-agnostic';

export default function BetaSubstrate() {
  const { user } = useAuth();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('beta_enrollments').select('id').eq('user_id', user.id).eq('feature', FEATURE).maybeSingle()
      .then(({ data }) => { setEnrolled(!!data); setLoading(false); });
  }, [user]);

  const enroll = async () => {
    if (!user) { toast({ title: 'Sign in to enroll', variant: 'destructive' }); return; }
    setSubmitting(true);
    const { error } = await supabase.from('beta_enrollments').upsert(
      { user_id: user.id, email: user.email!, feature: FEATURE },
      { onConflict: 'user_id,feature' }
    );
    setSubmitting(false);
    if (error) toast({ title: 'Enrollment failed', description: error.message, variant: 'destructive' });
    else { setEnrolled(true); toast({ title: 'You’re in', description: 'We’ll email you the moment the beta goes live.' }); }
  };

  return (
    <div className="bt-root">
      <style>{BT_CSS}</style>
      <header className="bt-head">
        <div className="bt-head-in">
          <Link to="/" className="bt-brand">
            <span className="bt-mark">S</span>
            <span className="bt-brand-name">SquidCloud</span>
            <span className="bt-tag">BETA</span>
          </Link>
          <Link to="/dashboard" className="bt-dash">Dashboard →</Link>
        </div>
      </header>

      <div className="bt-wrap">
        <section className="bt-hero">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="bt-eyebrow">
              <i /> Private Beta — Limited Seats
            </span>
            <h1>
              Storage that
              <br /><span>lives everywhere.</span>
            </h1>
            <p>
              SquidCloud is building a <strong>substrate-agnostic</strong> layer.
              No buckets to configure. No S3 keys to paste. Your encrypted chunks find a home
              on the deepest, setup-free surfaces of the internet — running <em>alongside</em> your existing B2/S3 storage.
            </p>
            <div className="bt-actions">
              {loading ? (
                <span className="bt-quiet">Checking…</span>
              ) : enrolled ? (
                <span className="bt-done">
                  <Check /> You’re enrolled — we’ll email you at {user?.email}
                </span>
              ) : (
                <button onClick={enroll} disabled={submitting} className="bt-enroll">
                  {submitting ? 'Enrolling…' : 'Enroll in Beta'} <ArrowRight />
                </button>
              )}
              <span className="bt-quiet">No setup required · Encrypted by default</span>
            </div>
            <p className="bt-fine">You’ll be auto-enrolled and notified by email when live. One click.</p>
          </motion.div>
        </section>

        <section className="bt-section">
          <p className="bt-caption">The substrate</p>
          <div className="bt-rows">
            {[
              { icon: Globe, t: 'Any surface, one API', d: 'DHT puts, gossip retention, swarm pins — the router picks what fits the chunk, not what you configured.' },
              { icon: Layers, t: 'Runs in parallel', d: 'Your B2/S3 buckets keep working exactly as today. Deep copies are *additional* redundancy.' },
              { icon: HardDrive, t: 'No bucket to create.', d: 'Zero setup. If you can reach the internet, you can store. The network *is* the filesystem.' },
            ].map(c => (
              <div key={c.t} className="bt-row">
                <c.icon />
                <div>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="bt-caption" style={{ marginTop: 32 }}>Under the hood</p>
          <div className="bt-rows">
            {[
              { icon: Shield, t: 'Still zero-knowledge', d: 'Nothing changes about encryption — chunks stay self-encrypted with HKDF-derived keys, manifests stay encrypted too.' },
              { icon: HardDrive, t: 'Manifest recursion', d: 'Even the file that *lists* where chunks live is itself chunked, encrypted, and scattered. No privileged location.' },
              { icon: Zap, t: 'Risk-aware routing', d: 'Stable vs Swarm vs Archival backends, replication policies, always at least one Stable copy.' },
            ].map(c => (
              <div key={c.t} className="bt-row">
                <c.icon />
                <div>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bt-note">
            <Sparkles />
            <p>This is a design preview. No code has shipped for this layer yet — your enrollment helps us prioritize which deep primitive we prove first (Kademlia DHT is the current candidate).</p>
          </div>
        </section>
      </div>

      <footer className="bt-foot">
        SquidCloud — substrate-agnostic storage · <Link to="/">Home</Link>
      </footer>
    </div>
  );
}
