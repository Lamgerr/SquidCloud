import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter } from 'lucide-react';
import SquidLogo from '@/components/ui/SquidLogo';

const footerLinks: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Storage', href: '/storage' },
      { label: 'Extensions', href: '/extensions' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Developers',
    items: [
      { label: 'Documentation', href: '/help/docs' },
      { label: 'Developer API', href: '/developer-api' },
      { label: 'CLI (squidcloudctl)', href: '/cli' },
      { label: 'Webhooks', href: '/webhooks' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'API Status', href: '/cc/api/status' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative z-20 border-t border-white/10 bg-[#09090b] text-zinc-400">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-12">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-white">
              <SquidLogo size={28} />
              SquidCloud
            </Link>
            <p className="max-w-xs text-sm leading-relaxed">
              Privacy-first cloud storage with client-side encryption, powered by the Res54 distributed architecture.
            </p>
            <div className="mt-2 flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
              >
                <Github size={18} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Twitter"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
              >
                <Twitter size={18} />
              </a>
            </div>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {group.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className="text-sm text-zinc-400 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-sm text-zinc-500 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} SquidCloud. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="transition-colors hover:text-white">Terms</Link>
            <Link to="/privacy" className="transition-colors hover:text-white">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
