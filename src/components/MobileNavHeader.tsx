import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Crown, Sparkles } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface MobileNavHeaderProps {
  onSearchClick: () => void;
  onMenuClick: () => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

const MobileNavHeader: React.FC<MobileNavHeaderProps> = ({
  onSearchClick,
  onMenuClick,
  title = 'SquidCloud',
  className,
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isFree = profile && !profile.is_premium;
  const isPremium = profile?.is_premium;

  return (
    <div
      className={cn(
        'sticky top-0 z-40 border-b border-border/20 bg-background/80 backdrop-blur-xl',
        'pt-[calc(env(safe-area-inset-top)+4px)]',
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            onClick={onMenuClick}
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-xl p-0 text-muted-foreground hover:bg-muted/50 active:scale-90 transition-all duration-200"
            aria-label="Open navigation menu"
          >
            <Menu className="h-[18px] w-[18px]" />
          </Button>
          <h1 className="truncate text-sm font-semibold text-foreground ml-0.5">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {isFree && (
            <button
              onClick={() => navigate('/pricing')}
              className="flex items-center gap-1.5 h-8 pl-3 pr-3.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold active:bg-amber-500/25 transition-all"
            >
              <Crown className="h-3.5 w-3.5" />
              Upgrade
            </button>
          )}
          {isPremium && (
            <button
              onClick={() => navigate('/pricing')}
              className="flex items-center gap-1.5 h-8 pl-3 pr-3.5 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-semibold active:bg-primary/25 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Plan
            </button>
          )}
          <Button
            onClick={onSearchClick}
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-xl p-0 text-muted-foreground hover:bg-muted/50 active:scale-90 transition-all duration-200"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MobileNavHeader;
