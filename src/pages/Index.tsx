import React from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Cloud, 
  FolderLock, 
  ShieldAlert, 
  Zap, 
  Users, 
  ChevronRight,
  Database
} from 'lucide-react';

export default function Index() {
  // Animation for the floating UI widgets seen in the examples
  const floatAnimation = {
    animate: {
      y: [0, -15, 0],
      transition: {
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const floatAnimationReverse = {
    animate: {
      y: [0, 15, 0],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-gray-900 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ═══ MINIMALIST NAVIGATION ═══ */}
      <nav className="relative z-50 mx-auto max-w-7xl flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Database size={18} strokeWidth={2.5} />
          </div>
          SquidCloud
        </div>
        
        <div className="hidden md:flex items-center gap-10 text-sm font-medium text-gray-500">
          <a href="#product" className="hover:text-gray-900 transition-colors">Product</a>
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <a href="#solutions" className="hover:text-gray-900 transition-colors">Solutions</a>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-6">
          <a href="/login" className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</a>
          <a href="/demo" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] ring-1 ring-gray-100 hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.1)] transition-all">
            Get demo
          </a>
        </div>
      </nav>

      {/* ═══ FLOATING WIDGET HERO SECTION ═══ */}
      <main>
        <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-6 pt-10 pb-32">
          
          {/* Subtle Dotted Background (Inspired by ChronoTask) */}
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

          {/* --- FLOATING UI ELEMENTS --- */}
          <div className="absolute inset-0 pointer-events-none z-10 max-w-7xl mx-auto overflow-hidden lg:overflow-visible">
            
            {/* Top Left: Checklist Widget */}
            <motion.div 
              {...floatAnimation}
              className="absolute top-[10%] left-[5%] md:left-[10%] bg-white p-4 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-50/50 flex flex-col gap-3 w-48 rotate-[-4deg]"
            >
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Tasks Secure</div>
              <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl">
                <div className="bg-indigo-500 h-6 w-6 rounded-lg flex items-center justify-center text-white"><Check size={12} strokeWidth={3} /></div>
                <div className="h-2 w-16 bg-gray-200 rounded-full"></div>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl">
                <div className="bg-emerald-400 h-6 w-6 rounded-lg flex items-center justify-center text-white"><Check size={12} strokeWidth={3} /></div>
                <div className="h-2 w-20 bg-gray-200 rounded-full"></div>
              </div>
            </motion.div>

            {/* Bottom Left: Main App Icon (Inspired by CoreShift center icon) */}
            <motion.div 
              {...floatAnimationReverse}
              className="absolute bottom-[20%] left-[8%] md:left-[15%] bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(99,102,241,0.4)] rotate-[6deg]"
            >
               <FolderLock size={40} className="text-white" strokeWidth={1.5} />
            </motion.div>

            {/* Top Right: Integration/App Icons */}
            <motion.div 
              {...floatAnimationReverse}
              className="absolute top-[15%] right-[5%] md:right-[12%] bg-white p-5 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-50/50 flex flex-col gap-4 rotate-[3deg]"
            >
              <div className="text-xs font-bold text-gray-800">100+ Integrations</div>
              <div className="flex gap-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500"><Cloud size={24} /></div>
                <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500"><Zap size={24} /></div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500"><ShieldAlert size={24} /></div>
              </div>
            </motion.div>

            {/* Bottom Right: Users/Team Widget */}
            <motion.div 
              {...floatAnimation}
              className="absolute bottom-[25%] right-[5%] md:right-[15%] bg-white p-4 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-50/50 flex items-center gap-4 rotate-[-5deg]"
            >
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                <Users size={20} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">Team Access</div>
                <div className="text-xs text-gray-500">Active now</div>
              </div>
            </motion.div>
          </div>

          {/* --- CENTER HERO CONTENT --- */}
          <div className="relative z-20 text-center max-w-4xl mx-auto mt-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-gray-900 leading-[1.1]">
                Store, secure, and scale <br className="hidden md:block" />
                <span className="text-gray-400 font-medium">all in one place</span>
              </h1>
              
              <p className="mt-8 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                SquidCloud is a modern, all-in-one storage platform designed to perfectly fit your business needs. Effortlessly manage your data and boost security.
              </p>
              
              <div className="mt-10">
                <a href="/demo" className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-[0_8px_25px_-8px_rgba(79,70,229,0.5)] hover:bg-indigo-700 hover:shadow-[0_12px_35px_-8px_rgba(79,70,229,0.6)] transition-all hover:-translate-y-0.5">
                  Get free demo
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══ VISUAL FEATURE GRID (BENTO STYLE) ═══ */}
        <section className="relative z-20 bg-gray-50 rounded-t-[3rem] md:rounded-t-[5rem] py-24 px-6 md:px-12 mt-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Everything you need to scale</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Feature 1: Large Card */}
              <div className="md:col-span-2 bg-white rounded-[2.5rem] p-10 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col justify-between overflow-hidden relative group">
                <div className="relative z-10 max-w-md">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6">
                    <ShieldAlert size={28} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Zero-Knowledge Architecture</h3>
                  <p className="text-gray-500 leading-relaxed">
                    Data is encrypted client-side before it ever reaches our servers. You hold the keys, ensuring total privacy.
                  </p>
                </div>
                {/* Decorative background element */}
                <div className="absolute right-[-10%] bottom-[-20%] w-64 h-64 bg-indigo-50 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
              </div>

              {/* Feature 2: Small Card */}
              <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] border border-gray-100">
                <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 mb-6">
                  <Cloud size={28} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Global Edge</h3>
                <p className="text-gray-500 leading-relaxed">
                  Distribute and retrieve data from edge locations worldwide instantly.
                </p>
              </div>

              {/* Feature 3: Small Card */}
              <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] border border-gray-100">
                <div className="h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mb-6">
                  <Users size={28} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Granular Access</h3>
                <p className="text-gray-500 leading-relaxed">
                  Manage permissions easily at the file or entire workspace level.
                </p>
              </div>

              {/* Feature 4: Large Card */}
              <div className="md:col-span-2 bg-gray-900 rounded-[2.5rem] p-10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.3)] flex flex-col justify-between relative overflow-hidden group">
                <div className="relative z-10 max-w-md">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center text-white mb-6 backdrop-blur-md">
                    <Zap size={28} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Lightning Fast APIs</h3>
                  <p className="text-gray-400 leading-relaxed mb-8">
                    Integrate seamlessly into your workflow with native SDKs and robust REST APIs designed for developers.
                  </p>
                  <a href="/docs" className="inline-flex items-center text-white font-semibold group-hover:gap-3 gap-2 transition-all">
                    Read Documentation <ChevronRight size={18} />
                  </a>
                </div>
                {/* Decorative background element */}
                <div className="absolute right-0 top-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent opacity-60" />
              </div>

            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
