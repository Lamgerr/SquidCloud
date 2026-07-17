import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs, layoutSpring } from '@/lib/motion';

interface DashboardSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onFileClick: () => void;
  onTrashClick: () => void;
  onSharedClick: () => void;
  onSettingsClick: () => void;
  onAnalyticsClick: () => void;
  onLogout: () => void;
  isAdmin?: boolean;
  userEmail?: string;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  isOpen,
  onToggle,
  onFileClick,
  onTrashClick,
  onSharedClick,
  onSettingsClick,
  onAnalyticsClick,
  onLogout,
  isAdmin = false,
  userEmail = '',
}) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  // Liquid nav item — active state rides a shared-layout glass pill.
  const NavItem = ({
    label,
    shortLabel,
    onClick,
    active = false,
  }: {
    label: string;
    shortLabel: string;
    onClick: () => void;
    active?: boolean;
  }) => (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={springs.snappy}
      className={cn(
        'mono-ring group relative w-full flex items-center justify-center px-4 py-3 rounded-[20px] overflow-hidden',
        'transition-colors duration-300',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          transition={layoutSpring}
          className="absolute inset-0 rounded-[20px] mono-glass-subtle"
        />
      )}
      {isOpen ? (
        <span
          className={cn(
            'relative z-10 w-full text-left truncate transition-all duration-300',
            active ? 'font-bold tracking-tight text-[15px]' : 'font-medium tracking-wide text-sm'
          )}
        >
          {label}
        </span>
      ) : (
        <span
          className={cn(
            'relative z-10 block text-[11px] font-bold uppercase tracking-widest transition-all duration-300',
            active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
          )}
        >
          {shortLabel}
        </span>
      )}
    </motion.button>
  );

  return (
    <>
      {/* Floating liquid-glass sidebar */}
      <motion.div
        animate={{ width: isOpen ? 240 : 80 }}
        transition={springs.fluid}
        className={cn(
          'mono-glass-strong fixed left-4 top-4 bottom-4 z-40 flex flex-col overflow-hidden rounded-[32px]',
          'shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]'
        )}
      >
        {/* Brand */}
        <div className="flex h-24 items-center justify-center px-6 pt-2 flex-shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
              <motion.span
                key="full"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={springs.soft}
                className="truncate bg-gradient-to-b from-foreground to-foreground/55 bg-clip-text font-black text-xl tracking-tighter text-transparent"
              >
                SquidCloud
              </motion.span>
            ) : (
              <motion.span
                key="mini"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={springs.bouncy}
                className="bg-gradient-to-b from-foreground to-foreground/55 bg-clip-text font-black text-xl tracking-tighter text-transparent"
              >
                SC
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="smooth-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          <div className="space-y-1.5">
            {isOpen && (
              <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 transition-opacity duration-300">
                Storage
              </p>
            )}
            <NavItem label="Files" shortLabel="FL" onClick={onFileClick} active={isActive('/dashboard')} />
            <NavItem label="Shared" shortLabel="SH" onClick={onSharedClick} active={isActive('/shared')} />
            <NavItem label="Vault" shortLabel="VL" onClick={() => {}} />
            <NavItem label="Trash" shortLabel="TR" onClick={onTrashClick} active={isActive('/trash')} />
          </div>

          <div className="mx-4 h-[1px] rounded-full bg-white/10" />

          <div className="space-y-1.5">
            {isOpen && (
              <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 transition-opacity duration-300">
                Tools
              </p>
            )}
            <NavItem label="Analytics" shortLabel="AN" onClick={onAnalyticsClick} />
            <NavItem label="Extensions" shortLabel="EX" onClick={() => {}} />
          </div>

          {isAdmin && (
            <div className="space-y-1.5 pt-2">
              <div className="mx-4 mb-6 h-[1px] rounded-full bg-white/10" />
              {isOpen && (
                <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 transition-opacity duration-300">
                  Admin
                </p>
              )}
              <NavItem label="System" shortLabel="SY" onClick={() => {}} />
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="mono-glass-subtle flex-shrink-0 space-y-2 rounded-b-[32px] border-t border-white/10 px-3 pb-4 pt-2">
          {isOpen && userEmail && (
            <div className="mb-4 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="truncate text-[13px] font-bold tracking-tight text-foreground">
                {userEmail.split('@')[0]}
              </p>
              <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground">
                {userEmail}
              </p>
            </div>
          )}

          <NavItem label="Settings" shortLabel="ST" onClick={onSettingsClick} />

          <motion.button
            onClick={onLogout}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            className="mono-ring group flex w-full items-center justify-center rounded-[20px] px-4 py-3 text-sm font-bold text-destructive/80 transition-colors duration-300 hover:bg-destructive hover:text-destructive-foreground"
          >
            {isOpen ? (
              <span className="w-full text-left tracking-wide">Logout</span>
            ) : (
              <span className="text-[11px] uppercase tracking-widest">OUT</span>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Floating glass toggle */}
      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 0.9 }}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
        transition={springs.snappy}
        className={cn(
          'mono-glass-subtle mono-ring fixed top-8 z-50 flex h-12 w-8 items-center justify-center rounded-l-[4px] rounded-r-[12px] text-foreground font-bold',
          'shadow-[0_8px_30px_-10px_rgba(0,0,0,0.6)]',
          isOpen ? 'left-[260px]' : 'left-[100px]'
        )}
      >
        <span className="text-[10px] tracking-tighter">{isOpen ? '◀' : '▶'}</span>
      </motion.button>

      <div
        className={cn(
          'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]',
          isOpen ? 'ml-[272px]' : 'ml-[112px]'
        )}
      />
    </>
  );
};

export default DashboardSidebar;
