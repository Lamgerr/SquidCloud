import { Link } from 'react-router-dom';
import { motion, useScroll } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import SquidLogo from '@/components/ui/SquidLogo';
import { Shell } from '@/components/landing/Shell';

const NAV_LINKS = [
  { label: 'Protocol', href: '#protocol' },
  { label: 'Tools', href: '#tools' },
  { label: 'CLI', href: '#cli' },
  { label: 'Pricing', href: '#pricing' },
];

export default function LandingNav() {
  const { user } = useAuth();
  const { scrollYProgress } = useScroll();

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 backdrop-blur-md"
      style={{ background: 'rgba(5, 5, 5, 0.78)', borderBottom: '1px solid var(--sl-line)' }}
    >
      <Shell className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" aria-label="SquidCloud home">
          <SquidLogo size={26} showBg={false} className="[&_svg]:opacity-90" />
          <span className="font-mono text-[13px] font-medium tracking-[0.32em]" style={{ color: 'var(--sl-paper)' }}>
            SQUIDCLOUD
          </span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-[11px] uppercase tracking-[0.22em] transition-opacity duration-200 hover:opacity-60"
              style={{ color: 'var(--sl-dim)' }}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-5">
          {user ? (
            <Link
              to="/dashboard"
              className="font-mono text-[11px] uppercase tracking-[0.22em] transition-opacity duration-200 hover:opacity-70"
              style={{ color: 'var(--sl-paper)' }}
            >
              Dashboard →
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden font-mono text-[11px] uppercase tracking-[0.22em] transition-opacity duration-200 hover:opacity-70 sm:block"
                style={{ color: 'var(--sl-dim)' }}
              >
                Sign in
              </Link>
              <Link
                to="/auth?tab=signup"
                className="rounded-full px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] transition-opacity duration-200 hover:opacity-80"
                style={{ background: 'var(--sl-paper)', color: 'var(--sl-void)' }}
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </Shell>
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[-1px] h-px origin-left"
        style={{ scaleX: scrollYProgress, background: 'rgba(250,250,250,0.45)' }}
      />
    </nav>
  );
}
