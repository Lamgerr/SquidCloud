import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Shield, Users, Lock,
  ArrowRight, Cloud, Eye, Key, HardDrive,
  Copy, Check,
} from '@/lib/icon-map';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import SquidLogo from '@/components/ui/SquidLogo';

const headlines = [
  'better security.',
  'complete privacy.',
  'total control.',
  'seamless sync.',
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
};

const stagger = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
};

const Index = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((p) => (p + 1) % headlines.length);
        setVisible(true);
      }, 500);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const handleCta = useCallback(() => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  if (isMobile) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background selection:bg-brand/30">

      {/* ═══ Header ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-2xl border-b border-border/60 flex items-center px-5 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 group"
          aria-label="SquidCloud Home"
        >
          <SquidLogo className="group-hover:shadow-brand/30 transition-shadow duration-300" />
          <span className="font-semibold text-[15px] tracking-[-0.01em] text-foreground hidden sm:inline-block">
            SquidCloud
          </span>
        </Link>

        <div className="flex-1" />

        <nav className="flex items-center gap-4">
          {user ? (
            <Button asChild variant="default" size="sm" className="rounded-lg">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Link
                to="/auth"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                Sign In
              </Link>
              <Button asChild variant="default" size="sm" className="rounded-lg">
                <Link to="/auth">Get Started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      {/* ═══ Hero ═══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-14 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            onClick={handleCta}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCta(); }}
            className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-brand/[0.04] border border-brand/10 mb-6 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand/50" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand/80" />
            </span>
            <span className="text-[10px] font-semibold text-brand/60 uppercase tracking-[0.12em] group-hover:text-brand/80 transition-colors duration-300 select-none">
              v12 · Octolus
            </span>
          </motion.div>

          <h1 className="text-5xl md:text-[5rem] font-bold tracking-[-0.04em] leading-[1.06] text-foreground">
            Your files deserve
            <br />
            <span className="relative inline-block">
              <AnimatePresence mode="wait">
                {visible && (
                  <motion.span
                    key={index}
                    className="text-brand inline-block"
                    initial={{ opacity: 0, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(10px)' }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {headlines[index]}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
            KZA security, dual encryption, BYOK support.
            Cloud storage that puts you in control.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
            <Button
              asChild
              size="lg"
              className="h-12 px-9 text-sm font-semibold rounded-xl shadow-lg shadow-brand/15 transition-all duration-200 hover:shadow-xl hover:shadow-brand/25 active:scale-[0.97]"
            >
              <Link to="/auth" className="flex items-center gap-2.5">
                Start Free — No Card Required
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleCta}
              className="h-12 px-9 text-sm font-medium rounded-xl border-border/60 text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-all duration-200 active:scale-[0.97]"
            >
              See Features
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="mt-10 flex flex-col items-center gap-3"
          >
            <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.14em] select-none">
              Install the CLI
            </span>
            <div className="flex items-stretch bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm shadow-black/5 hover:shadow-md hover:shadow-black/10 transition-shadow duration-300">
              <code className="flex items-center gap-2 px-4 py-2.5 text-sm leading-relaxed select-all">
                <span className="text-brand/60 font-semibold select-none">$</span>
                <span className="font-mono text-foreground/85">npm install -g squidcloudctl</span>
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('npm install -g squidcloudctl');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center justify-center w-10 border-l border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60 transition-all duration-200"
                aria-label="Copy install command"
              >
                {copied
                  ? <Check className="w-[15px] h-[15px] text-emerald-400" />
                  : <Copy className="w-[15px] h-[15px]" />
                }
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/40 font-medium tracking-wide select-none">
              Requires Node.js 20+
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ Stats ═══ */}
      <motion.section {...fadeUp} className="py-24 px-4 border-y border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
            {[
              { value: '100K+', label: 'Files Secured' },
              { value: '2-Layer', label: 'Encryption' },
              { value: '99.99%', label: 'Uptime SLA' },
              { value: '<120ms', label: 'Avg Response' },
            ].map(({ value, label }) => (
              <div key={label} className="space-y-2">
                <div className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{value}</div>
                <div className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══ Features ═══ */}
      <motion.section id="features" {...fadeUp} className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <motion.div {...stagger}>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.025em] mb-3 text-foreground">
                Five new features
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-[15px]">
                From kernel-level security to better API management.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                icon: Key,
                title: 'API Keys v2.1',
                desc: 'Manage access with fine-grained permissions and webhook events for file changes and key rotation. Monitor usage through an integrated analytics dashboard.',
                tags: ['Granular Permissions', 'Webhook Events', 'Usage Analytics', 'Auto Rotation', 'Audit Log'],
              },
              {
                icon: Shield,
                title: 'Dual-Layer Encryption',
                desc: 'Every file is encrypted twice — once for speed and once for resilience — using industry-standard algorithms. Hardware-accelerated and built for the future.',
                tags: ['XChaCha20', 'AES-256-GCM', 'Hardware Accelerated', 'Post-Quantum Ready'],
              },
              {
                icon: Lock,
                title: 'BYOK — Bring Your Own Key',
                desc: 'Enterprise accounts can generate and store encryption keys on their own infrastructure. SquidCloud never has access to your raw keys at any point. Full audit trail with automatic key rotation policies included.',
                tags: ['HSM Support', 'On-Premises Keys', 'Audit Trail', 'Key Rotation', 'Zero-Knowledge'],
                full: true,
                enterprise: true,
              },
              {
                icon: Users,
                title: 'Collaborative Workspaces',
                desc: 'Invite team members to shared, encrypted workspaces with role-based access. Activity feeds, comments, and file-level permission controls included.',
                tags: ['Role-Based Access', 'Activity Feeds', 'Comments', 'Permission Controls'],
              },
              {
                icon: HardDrive,
                title: 'KZA Security System',
                desc: 'Kernel-level zero-access architecture with hardware-backed isolation. Memory encryption and secure processing ensure your data stays protected at every level.',
                tags: ['Hardware Isolation', 'Secure Enclave', 'Memory Encryption', 'Audit Logging'],
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className={`group flex flex-col h-full p-8 rounded-2xl bg-card border border-border/70 hover:border-brand/25 transition-all duration-300 ${card.full ? 'md:col-span-2' : ''}`}
              >
                <div className={card.full ? 'flex flex-col md:flex-row items-start gap-6' : ''}>
                  <div className={`flex items-center gap-3 ${card.full ? '' : 'mb-3'}`}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-brand/10 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand/15">
                      <card.icon className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                      {card.enterprise && (
                        <span className="text-[9px] uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded font-semibold ml-2 align-middle">Enterprise</span>
                      )}
                    </div>
                  </div>
                  <div className={card.full ? 'flex-1 min-w-0' : ''}>
                    <p className={`text-[13px] text-muted-foreground leading-relaxed flex-1 ${card.full ? 'mt-0 md:mt-0 mb-3' : 'mb-3'}`}>
                      {card.desc}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {card.tags.map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[10px] font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══ Platform ═══ */}
      <motion.section {...fadeUp} className="py-24 px-4 border-y border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.025em] mb-3 text-foreground">
              The platform beneath
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto text-[15px]">
              Everything you expect from modern cloud storage, refined
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="md:col-span-2 p-8 rounded-2xl bg-card border border-border/70 hover:border-brand/25 transition-all duration-300 flex flex-col h-full"
            >
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-brand/10 shrink-0">
                  <Shield className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">RES54 + KZA Architecture</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Files are encrypted before leaving your device using two layers of
                    protection. KZA provides kernel-level isolation across the entire data lifecycle.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['XChaCha20', 'AES-256-GCM', 'KZA', 'Zero-Knowledge', 'E2E'].map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[11px] font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {[
              { icon: Lock, label: 'SquidVault', desc: 'Biometric and PIN-protected vault for your most sensitive files' },
              { icon: Upload, label: 'Unlimited Uploads', desc: 'No file size limits. Chunked uploads with background processing' },
              { icon: Eye, label: 'Secure Sharing', desc: 'Expiring links, download limits, and password-protected shares' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="p-8 rounded-2xl bg-card border border-border/70 hover:border-brand/25 transition-all duration-300 group flex flex-col h-full"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-brand/10 transition-transform duration-300 group-hover:scale-110">
                  <item.icon className="w-5 h-5 text-brand" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.label}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══ Steps ═══ */}
      <motion.section {...fadeUp} className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.025em] mb-3 text-foreground">
              Simple by design
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto text-[15px]">
              Get started in under a minute
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create your account', desc: 'Sign up with email, GitHub, Google, or Discord. No credit card needed.', icon: Users },
              { step: '02', title: 'Upload your files', desc: 'Drag and drop any file type. Encrypted before upload, always.', icon: Upload },
              { step: '03', title: 'Access anywhere', desc: 'Web, mobile, and API — your encrypted files follow you everywhere.', icon: Cloud },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="relative text-center group"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 bg-brand/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-brand/15">
                  <item.icon className="w-6 h-6 text-brand" />
                </div>
                <div className="text-[11px] font-bold text-brand/50 uppercase tracking-[0.1em] mb-2">{item.step}</div>
                <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[260px] mx-auto">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══ CTA ═══ */}
      <motion.section {...fadeUp} className="py-24 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="relative p-12 md:p-16 rounded-3xl bg-card border border-border/70 text-center overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-brand/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-[-0.02em] text-foreground">
                Ready for what's next?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-[15px]">
                KZA security, BYOK, dual encryption, and collaborative workspaces — all in one platform.
              </p>
              <Button
                asChild
                size="lg"
                className="h-12 px-9 text-sm font-semibold rounded-xl shadow-lg shadow-brand/15 transition-all duration-200 hover:shadow-xl hover:shadow-brand/25 active:scale-[0.97]"
              >
                <Link to={user ? '/dashboard' : '/auth'} className="flex items-center gap-2.5">
                  {user ? 'Open Dashboard' : 'Get Started Free'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              {!user && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Free forever for personal use. No credit card required.
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-16 max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <SquidLogo size={28} className="rounded-lg" />
                <span className="font-semibold text-sm text-foreground">SquidCloud</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                Secure, private cloud storage built for people who care about their data.
              </p>
            </div>

            {[
              {
                title: 'Product',
                links: [
                  { label: 'Get Started', to: '/auth' },
                  { label: 'Developer API', to: '/developer-api' },
                  { label: 'CLI', to: '/cli' },
                  { label: 'cbCode IDE', to: '/cbcode' },
                  { label: 'Patch Notes', to: '/patch-notes' },
                ],
              },
              {
                title: 'Resources',
                links: [
                  { label: 'Documentation', to: '/docs' },
                  { label: 'Extensions', to: '/extensions' },
                  { label: 'Status', to: '#' },
                ],
              },
              {
                title: 'Legal',
                links: [
                  { label: 'Privacy Policy', to: '/privacy' },
                  { label: 'Terms of Service', to: '/terms' },
                ],
              },
            ].map((section) => (
              <div key={section.title} className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">{section.title}</h4>
                <div className="space-y-2.5">
                  {section.links.map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="block text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <p className="text-xs text-muted-foreground">
                {'\u00A9'} {new Date().getFullYear()} SquidCloud. All rights reserved.
              </p>
              <p className="text-xs text-muted-foreground">
                KZA powered
              </p>
            </div>
            <a
              href="https://www.producthunt.com/products/squidcloud?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-squidcloud"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="SquidCloud on Product Hunt"
            >
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1116367&theme=dark&t=1775410084692"
                alt="SquidCloud - Featured on Product Hunt"
                width="250"
                height="54"
                className="opacity-80 hover:opacity-100 transition-opacity"
              />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
