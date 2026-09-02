import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Layers, Globe, Shield,
  Zap, Check, ArrowRight, Sparkles, Lock, HardDrive
} from '@/lib/icon-map';

const FEATURE = 'substrate-agnostic';

export default function BetaSubstrate() {
  const { user } = useAuth();
  const { toast } = useToast();
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
    else { setEnrolled(true); toast({ title: 'You’re in 🎉', description: 'We’ll email you the moment the beta goes live.' }); }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(88,166,255,0.07), transparent 62%)' }} />
      <header className="sticky top-0 z-10 border-b border-[#30363d]/60 bg-[#0d1117]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-white text-[12px] font-bold text-black">S</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">SquidCloud</span>
            <span className="rounded-full border border-[#30363d] px-2 py-0.5 text-[10px] tracking-widest">BETA</span>
          </Link>
          <Link to="/dashboard" className="text-[13px] text-[#7d8590] hover:text-white">Dashboard →</Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pt-16 pb-10 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#30363d] bg-[#161b22] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#7d8590]">
            <span className="h-2 w-2 rounded-full bg-[#58a6ff] animate-pulse" /> Private Beta — Limited Seats
          </span>
          <h1 className="mt-6 text-balance text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[1.02] tracking-tight">
            Storage that
            <br /><span className="text-[#58a6ff]">lives everywhere.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-[#7d8590]">
            SquidCloud is building a <span className="text-white font-medium">substrate-agnostic</span> layer.
            No buckets to configure. No S3 keys to paste. Your encrypted chunks find a home
            on the deepest, setup-free surfaces of the internet — running <em>alongside</em> your existing B2/S3 storage.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {loading ? (
              <span className="h-11 px-8 text-sm text-[#7d8590]">Checking…</span>
            ) : enrolled ? (
              <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#238636] px-8 text-sm font-medium text-white">
                <Check className="h-4 w-4" /> You’re enrolled — we’ll email you at {user?.email}
              </span>
            ) : (
              <button onClick={enroll} disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-8 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50">
                {submitting ? 'Enrolling…' : 'Enroll in Beta'} <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <span className="inline-flex h-11 items-center rounded-lg border border-[#30363d] px-5 text-sm text-[#7d8590]">No setup required · Encrypted by default</span>
          </div>
          <p className="mt-3 text-xs text-[#6e7681]">You’ll be auto-enrolled and notified by email when live. One click.</p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Globe, t: 'Any surface, one API', d: 'DHT puts, gossip retention, swarm pins — the router picks what fits the chunk, not what you configured.' },
            { icon: Layers, t: 'Runs in parallel', d: 'Your B2/S3 buckets keep working exactly as today. Deep copies are *additional* redundancy.' },
            { icon: HardDrive, t: 'No bucket to create.', d: 'Zero setup. If you can reach the internet, you can store. The network *is* the filesystem.' },
          ].map(c => (
            <div key={c.t} className="rounded-xl border border-[#30363d]/60 bg-[#161b22]/60 p-6">
              <c.icon className="h-5 w-5 text-[#58a6ff]" />
              <h3 className="mt-3 font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#7d8590]">{c.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Shield, t: 'Still zero-knowledge', d: 'Nothing changes about encryption — chunks stay self-encrypted with HKDF-derived keys, manifests stay encrypted too.' },
            { icon: HardDrive, t: 'Manifest recursion', d: 'Even the file that *lists* where chunks live is itself chunked, encrypted, and scattered. No privileged location.' },
            { icon: Zap, t: 'Risk-aware routing', d: 'Stable vs Swarm vs Archival backends, replication policies, always at least one Stable copy.' },
          ].map(c => (
            <div key={c.t} className="rounded-xl border border-[#30363d]/60 bg-[#161b22]/40 p-6">
              <c.icon className="h-5 w-5 text-[#8b949e]" />
              <h3 className="mt-3 font-semibold text-sm">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#7d8590]">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8 text-center">
        <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-6">
          <Sparkles className="mx-auto h-5 w-5 text-[#7d8590]" />
          <p className="mt-3 text-sm text-[#7d8590]">This is a design preview. No code has shipped for this layer yet — your enrollment helps us prioritize which deep primitive we prove first (Kademlia DHT is the current candidate).</p>
        </div>
      </section>

      <footer className="border-t border-[#30363d]/60 py-10 text-center text-xs text-[#6e7681]">
        SquidCloud — substrate-agnostic storage · <Link to="/" className="underline">Home</Link>
      </footer>
    </div>
  );
}
