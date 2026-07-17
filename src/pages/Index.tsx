import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Copy, Check, Fingerprint, Database, TerminalSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import SquidLogo from '@/components/ui/SquidLogo';

export default function Index() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install -g squidcloudctl');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#020202] text-zinc-300 font-sans selection:bg-zinc-100 selection:text-black flex flex-col">
      
      {/* ═══ SYS.NAV ═══ */}
      <header className="sticky top-0 z-50 grid grid-cols-1 md:grid-cols-12 border-b border-zinc-900 bg-[#020202]">
        
        {/* Branding */}
        <div className="md:col-span-3 lg:col-span-2 border-r border-zinc-900 p-4 flex items-center">
          <Link to="/" className="flex items-center gap-3 group">
            <SquidLogo size={16} className="text-zinc-100 transition-transform group-hover:rotate-90 duration-500" />
            <span className="font-bold text-[11px] tracking-[0.2em] uppercase text-zinc-100">SquidCloud</span>
          </Link>
        </div>

        {/* Index Links */}
        <nav className="hidden md:flex md:col-span-6 lg:col-span-8 border-r border-zinc-900 items-center">
          <a href="#sys-specs" className="h-full px-6 flex items-center border-r border-zinc-900 text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900/50 transition-colors">
            / Specs
          </a>
          <a href="#sys-arch" className="h-full px-6 flex items-center border-r border-zinc-900 text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900/50 transition-colors">
            / Arch
          </a>
        </nav>

        {/* Auth Action */}
        <div className="md:col-span-3 lg:col-span-2 flex items-center">
          <Link 
            to={user ? "/dashboard" : "/auth"} 
            className="w-full h-full p-4 flex items-center justify-between text-[11px] font-mono font-bold text-black bg-zinc-100 hover:bg-white hover:pl-6 transition-all"
          >
            {user ? 'CONSOLE' : 'INIT'}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      <main className="flex-grow flex flex-col">
        {/* ═══ SYS.HERO ═══ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 border-b border-zinc-900 flex-grow">
          
          {/* Main Display */}
          <div className="lg:col-span-9 border-r border-zinc-900 p-6 md:p-12 lg:p-20 flex flex-col justify-between min-h-[60vh]">
            <motion.div
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <h1 className="text-[12vw] lg:text-[10rem] font-black leading-[0.8] tracking-tighter uppercase text-zinc-100">
                Absolute
                <br />
                <span className="text-zinc-700">Zero.</span>
              </h1>
            </motion.div>

            <motion.div 
              className="max-w-2xl mt-16 lg:mt-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-lg md:text-2xl text-zinc-400 font-medium leading-tight">
                Zero-knowledge architecture. Dual-layer encryption. Keys completely isolated from host infrastructure. 
                <span className="text-zinc-100"> Cloud storage engineered for hostility.</span>
              </p>
            </motion.div>
          </div>

          {/* Terminal / Status Rail */}
          <div className="lg:col-span-3 flex flex-col bg-[#050505]">
            <div className="flex-grow p-6 border-b border-zinc-900 flex flex-col justify-end">
              <div className="mb-8">
                <span className="inline-block w-2 h-2 bg-emerald-500 mr-3 animate-pulse"></span>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Network Active</span>
              </div>
              <ul className="space-y-4 font-mono text-[11px] uppercase tracking-wider">
                <li className="flex justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-600">Core</span> <span className="text-zinc-300">RES54.v12</span>
                </li>
                <li className="flex justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-600">Cipher</span> <span className="text-zinc-300">XChaCha20</span>
                </li>
                <li className="flex justify-between pb-2">
                  <span className="text-zinc-600">Trust</span> <span className="text-zinc-300">Trustless</span>
                </li>
              </ul>
            </div>
            
            <button 
              onClick={handleCopy}
              className="p-6 flex items-center justify-between text-left group hover:bg-zinc-100 hover:text-black transition-colors"
            >
              <div>
                <span className="block text-[10px] font-mono text-zinc-600 group-hover:text-zinc-500 uppercase tracking-widest mb-2">
                  Global CLI Install
                </span>
                <code className="text-sm font-mono tracking-tight">
                  <span className="text-zinc-700 group-hover:text-black mr-2">$</span>
                  npm i -g squidcloud
                </code>
              </div>
              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-zinc-600 group-hover:text-black" />}
            </button>
          </div>
        </section>

        {/* ═══ SYS.SPECS (Ledger Form) ═══ */}
        <section id="sys-specs" className="border-b border-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-12 border-b border-zinc-900 bg-[#050505]">
            <div className="md:col-span-3 p-6 flex items-center">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">System Specifications</h2>
            </div>
          </div>

          <div className="flex flex-col">
            {[
              {
                id: "01",
                label: "Client-Side Cryptography",
                title: "Dual-Layer Cipher Matrix",
                desc: "Data undergoes non-linear wave splitting via XChaCha20 on local hardware prior to network transit, followed by AES-256-GCM application at rest. Server infrastructure hosts strictly unaligned matrix noise.",
                icon: Fingerprint
              },
              {
                id: "02",
                label: "Role-Based Access Control",
                title: "Mathematical Workspaces",
                desc: "Granular file-level access controlled by cryptographic keys, not application logic. Workspace identities form trust rings, bypassing legacy administrative escalation vulnerabilities.",
                icon: Database
              },
              {
                id: "03",
                label: "Integration & Telemetry",
                title: "Native Developer Engine",
                desc: "Command-line integration, comprehensive webhook dispatchers, and API Keys v2.1. Embed zero-knowledge storage directly into CI/CD pipelines without exposing payload state.",
                icon: TerminalSquare
              }
            ].map((spec) => (
              <div 
                key={spec.id} 
                className="grid grid-cols-1 md:grid-cols-12 border-b border-zinc-900 group hover:bg-zinc-100 hover:text-black transition-colors duration-0"
              >
                <div className="md:col-span-3 p-6 md:p-8 border-r border-zinc-900 flex flex-col justify-between">
                  <span className="text-[10px] font-mono text-zinc-600 group-hover:text-zinc-400 uppercase tracking-widest mb-4 block">
                    [{spec.id}] {spec.label}
                  </span>
                  <spec.icon size={24} className="text-zinc-700 group-hover:text-black" />
                </div>
                
                <div className="md:col-span-9 p-6 md:p-12">
                  <h3 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase mb-6 text-zinc-100 group-hover:text-black">
                    {spec.title}
                  </h3>
                  <p className="text-lg text-zinc-500 group-hover:text-zinc-800 font-medium max-w-3xl leading-relaxed">
                    {spec.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ SYS.ACTION ═══ */}
        <section className="bg-zinc-100 text-black border-b border-zinc-900 group">
          <Link to={user ? "/dashboard" : "/auth"} className="grid grid-cols-1 md:grid-cols-12 cursor-pointer">
            <div className="md:col-span-9 p-12 md:p-20 border-r border-zinc-300">
              <h2 className="text-5xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85] mb-6">
                Initialize <br/> Workspace.
              </h2>
              <p className="text-xl font-medium text-zinc-600 max-w-lg">
                Zero infrastructure overhead. Free forever for individual developers. No credit card required.
              </p>
            </div>
            <div className="md:col-span-3 flex items-center justify-center p-12 bg-zinc-200/50 group-hover:bg-black group-hover:text-white transition-all">
              <ArrowUpRight size={80} className="transform group-hover:scale-110 transition-transform" />
            </div>
          </Link>
        </section>
      </main>

      {/* ═══ SYS.FOOTER ═══ */}
      <footer className="bg-[#020202] text-zinc-500 font-mono text-[10px] uppercase tracking-widest p-6 border-t-[12px] border-zinc-100">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 md:gap-0 pb-12 border-b border-zinc-900">
          
          <div className="col-span-2 md:col-span-6 lg:col-span-4">
            <SquidLogo size={20} className="text-zinc-100 mb-6" />
            <p className="leading-relaxed max-w-xs text-zinc-600">
              SQ.CLOUD // Engineered for hostility.<br/>
              Zero-knowledge data matrix.
            </p>
          </div>

          <div className="col-span-1 md:col-span-3 lg:col-span-2">
            <span className="block text-zinc-300 mb-6">Product</span>
            <ul className="space-y-4">
              <li><Link to="/auth" className="hover:text-zinc-100 transition-colors">Start Free</Link></li>
              <li><Link to="/api-docs" className="hover:text-zinc-100 transition-colors">Developer API</Link></li>
              <li><Link to="/cli" className="hover:text-zinc-100 transition-colors">Terminal CLI</Link></li>
              <li><Link to="/changelog" className="hover:text-zinc-100 transition-colors">Changelog</Link></li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-3 lg:col-span-2">
            <span className="block text-zinc-300 mb-6">Resources</span>
            <ul className="space-y-4">
              <li><Link to="/docs" className="hover:text-zinc-100 transition-colors">Documentation</Link></li>
              <li><Link to="/github" className="hover:text-zinc-100 transition-colors">Open Source</Link></li>
              <li><Link to="/status" className="hover:text-zinc-100 transition-colors">System Status</Link></li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-12 lg:col-span-4 lg:text-right mt-8 lg:mt-0 flex flex-col justify-between">
            <div className="flex gap-6 lg:justify-end">
              <Link to="/privacy" className="hover:text-zinc-100 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-zinc-100 transition-colors">Terms</Link>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <span>&copy; {new Date().getFullYear()} SQUIDCLOUD INC.</span>
          <span className="text-zinc-700">STATUS: NOMINAL</span>
        </div>
      </footer>
    </div>
  );
}
