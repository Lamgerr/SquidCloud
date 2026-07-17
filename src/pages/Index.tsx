import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Cloud, Copy, Check, Terminal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import SquidLogo from '@/components/ui/SquidLogo';

/* * UI Strategy: Apple-Minimalist Dark Mode
 * - Pure black background, matte gray elevated cards.
 * - Subtle, controlled background blur (only on nav).
 * - High contrast, tightly tracked typography.
 * - Smooth, linear motion (no bouncy physics).
 */

const EASE = [0.25, 0.1, 0.25, 1]; // Apple-like smooth ease curve
const SPRING = { duration: 0.6, ease: EASE };

const features = [
  {
    icon: Lock,
    title: 'Dual-Layer Encryption.',
    desc: 'Every file encrypted twice. Kernel zero-access architecture keeps raw keys off our infrastructure entirely.',
  },
  {
    icon: Cloud,
    title: 'Secure Workspaces.',
    desc: 'Role-based encrypted workspaces with file-level permissions. Your team, your rules, your data.',
  },
  {
    icon: Terminal,
    title: 'Developer Surface.',
    desc: 'API Keys v2.1 with granular permissions and webhooks. Manage everything seamlessly from the CLI.',
  },
];

const Index = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] font-sans selection:bg-white selection:text-black">
      
      {/* ═══ Apple-Style Frosted Nav ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.08] bg-black/70 backdrop-blur-md supports-[backdrop-filter]:bg-black/40">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group transition-opacity hover:opacity-80">
            <SquidLogo size={20} className="text-white" />
            <span className="font-semibold text-sm tracking-tight text-white">SquidCloud</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            {['Capabilities', 'Architecture'].map((label) => (
              <a key={label} href={`#${label.toLowerCase()}`} className="text-xs font-medium text-[#86868b] hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/auth" className="hidden sm:block text-xs font-medium text-[#86868b] hover:text-white transition-colors">
              Sign In
            </Link>
            <Button asChild size="sm" className="h-7 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-semibold px-4 transition-transform active:scale-95">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24">
        {/* ═══ Hero Section ═══ */}
        <section className="px-6 flex flex-col items-center text-center max-w-4xl mx-auto mt-16 md:mt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">v12 Now Available</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.1 }}
            className="text-[3.5rem] md:text-[5.5rem] font-bold tracking-tighter leading-[1.05] text-white"
          >
            Your files. <br className="hidden md:block" />
            <span className="text-zinc-500">Zero compromises.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.2 }}
            className="text-lg md:text-xl text-[#86868b] mt-8 max-w-2xl font-medium tracking-tight"
          >
            Zero-knowledge architecture. Dual-layer encryption. Keys that never leave your device. The cloud storage platform built for absolute privacy.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 mt-12 w-full sm:w-auto"
          >
            <Button
              asChild size="lg"
              className="h-12 px-8 rounded-full bg-white text-black hover:bg-zinc-200 text-sm font-semibold transition-transform active:scale-95"
            >
              <Link to={user ? '/dashboard' : '/auth'}>
                {user ? 'Open Dashboard' : 'Get Started Free'}
              </Link>
            </Button>
          </motion.div>

          {/* Minimalist CLI Install Block */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...SPRING, delay: 0.5 }}
            className="mt-16 flex items-center justify-between gap-6 px-5 py-3 rounded-2xl bg-[#1c1c1e] border border-white/[0.05] w-full max-w-md mx-auto"
          >
            <code className="text-sm font-mono text-zinc-300 flex items-center gap-3">
              <span className="text-zinc-500">$</span> npm install -g squidcloudctl
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText('npm install -g squidcloudctl');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-zinc-500 hover:text-white transition-colors p-1"
              aria-label="Copy install command"
            >
              {copied ? <Check size={16} className="text-white" /> : <Copy size={16} />}
            </button>
          </motion.div>
        </section>

        {/* ═══ Features (Bento Style) ═══ */}
        <section id="capabilities" className="px-6 py-32 max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
              Designed for privacy. <br/> Engineered for trust.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ ...SPRING, delay: i * 0.1 }}
                className="bg-[#1c1c1e] rounded-3xl p-8 flex flex-col items-start border border-white/[0.02]"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-8">
                  <f.icon size={20} className="text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white tracking-tight mb-3">{f.title}</h3>
                <p className="text-[#86868b] text-sm leading-relaxed font-medium">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══ Architecture Section ═══ */}
        <section id="architecture" className="px-6 py-24 max-w-4xl mx-auto border-t border-white/[0.08]">
          <div className="flex flex-col md:flex-row gap-16 md:gap-8 justify-between">
            <div className="md:w-1/3">
              <h2 className="text-3xl font-bold tracking-tight text-white">
                Built from <br/> the ground up.
              </h2>
            </div>
            
            <div className="md:w-2/3 space-y-12">
              {[
                { step: '01', title: 'Client-Side Encryption', desc: 'Your files are encrypted with XChaCha20 before they ever leave your machine. We never see the plaintext.' },
                { step: '02', title: 'Zero-Access Architecture', desc: 'System-level protocols ensure raw keys never touch our infrastructure. Bring Your Own Key (BYOK) supported natively.' },
                { step: '03', title: 'Encrypted Storage', desc: 'Dual-layer AES-256-GCM encryption at rest. Your data remains completely opaque to our servers.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-6">
                  <span className="text-sm font-mono text-zinc-500 pt-1">{s.step}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white tracking-tight mb-2">{s.title}</h3>
                    <p className="text-[#86868b] text-sm leading-relaxed font-medium">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ═══ Minimalist Footer ═══ */}
      <footer className="px-6 py-12 border-t border-white/[0.08] bg-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SquidLogo size={20} className="text-white" />
              <span className="font-semibold text-sm tracking-tight text-white">SquidCloud</span>
            </div>
            <p className="text-xs text-zinc-500 max-w-xs">
              Secure, private cloud storage built for teams and developers who care about absolute data isolation.
            </p>
          </div>

          <div className="flex gap-16">
            {[
              { title: 'Product', links: ['Features', 'Developer API', 'CLI', 'Patch Notes'] },
              { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Security Audits'] },
            ].map((section) => (
              <div key={section.title} className="flex flex-col gap-3">
                <span className="text-xs font-semibold text-white tracking-tight">{section.title}</span>
                {section.links.map((link) => (
                  <a key={link} href="#" className="text-xs text-zinc-500 hover:text-white transition-colors">
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>

        </div>
        
        <div className="max-w-6xl mx-auto mt-16 pt-8 border-t border-white/[0.05] flex justify-between items-center text-xs text-zinc-600">
          <span>&copy; {new Date().getFullYear()} SquidCloud Inc. All rights reserved.</span>
          <span>Zero-Knowledge Systems</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
