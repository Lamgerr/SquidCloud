import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GlassButton } from '@/components/ui/glasscn/glass-button';
import { GlassInput } from '@/components/ui/glasscn/glass-input';
import { GlassCard } from '@/components/ui/glasscn/glass-card';
import { Search, Bell } from '@/lib/icon-map';
import { Gamepad2 } from 'lucide-react';
import { springs, staggerContainer, riseItem } from '@/lib/motion';

interface DashboardHeaderProps {
  title: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onGamesClick?: () => void;
  actions?: React.ReactNode;
  showStats?: boolean;
  stats?: Array<{
    label: string;
    value: string;
    icon: React.ReactNode;
    color: string;
  }>;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  searchQuery = '',
  onSearchChange,
  onGamesClick,
  actions,
  showStats = false,
  stats = [],
}) => {
  return (
    <div className="space-y-4 px-8 pt-6 pb-4">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.soft}
          className="truncate text-2xl font-bold tracking-tighter text-foreground"
        >
          {title}
        </motion.h1>
        {actions && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.soft}
            className="flex items-center gap-3"
          >
            {actions}
          </motion.div>
        )}
      </div>

      {/* Search and Tools Row */}
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springs.soft}
          whileTap={{ scale: 0.98 }}
        >
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={onGamesClick}
            className="h-9 gap-1.5 rounded-lg border border-white/10 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Gamepad2 className="h-4 w-4" />
            Games?
          </GlassButton>
        </motion.div>

        {onSearchChange && (
          <div className="group relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <GlassInput
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 rounded-lg border-white/10 pl-9 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all focus:border-white/25 focus:bg-white/[0.08] focus:ring-1 focus:ring-white/15"
            />
          </div>
        )}

        <motion.div whileTap={{ scale: 0.94 }} transition={springs.snappy}>
          <GlassButton
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-lg border border-white/10 p-0 hover:text-foreground"
          >
            <Bell className="h-4 w-4 text-muted-foreground" />
          </GlassButton>
        </motion.div>
      </div>

      {/* Stats Row */}
      {showStats && stats.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              variants={riseItem}
            >
              <GlassCard className="group relative overflow-hidden rounded-xl border border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg bg-white/8',
                      stat.color
                    )}
                  >
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default DashboardHeader;
