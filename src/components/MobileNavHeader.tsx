import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogOut, Crown, Sparkles, ArrowUpRight, User } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { SignalsBell } from '@/components/SignalsBell';
import SwitchAccountSheet from '@/components/SwitchAccountSheet';

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
  const { user, profile, signOut } = useAuth();
  const [switchOpen, setSwitchOpen] = useState(false);

  return (
    <div
      className={cn(
        'm3-appbar m3-appbar--small sticky top-0 z-40 backdrop-blur-xl',
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
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="17" x2="21" y2="17" />
            </svg>
          </Button>
          <h1 className="truncate text-sm font-semibold text-foreground ml-0.5">{title}</h1>
        </div>

        <div className="flex items-center gap-1">
          <SignalsBell className="rounded-xl" iconClassName="h-[18px] w-[18px]" />

          <Button
            onClick={onSearchClick}
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-xl p-0 text-muted-foreground hover:bg-muted/50 active:scale-90 transition-all duration-200"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-xl p-0 hover:bg-muted/50 active:scale-90 transition-all duration-200"
                aria-label="Account"
              >
                <Avatar className="h-7 w-7 ring-1.5 ring-border/40">
                  <AvatarImage src={profile?.avatar_url || ''} alt={user?.email || 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-56 mr-2"
            >
              <div className="px-2.5 py-2 border-b border-border/40 mb-1 space-y-1">
                <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <div className={cn(
                  'flex items-center gap-1.5 pt-1',
                  profile?.is_premium ? 'text-amber-500' : 'text-muted-foreground/50',
                )}>
                  {profile?.is_premium ? (
                    <Crown className="h-3 w-3" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  <span className="text-[10px] font-semibold">
                    {profile?.is_premium ? (profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter') : 'Free Plan'}
                  </span>
                </div>
              </div>

              {!profile?.is_premium && (
                <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer text-sm font-medium text-amber-500 focus:text-amber-500 focus:bg-amber-500/10 rounded-md" onClick={() => navigate('/pricing')}>
                  <Crown className="h-4 w-4" /><span>Upgrade Plan</span><ArrowUpRight className="h-3 w-3 ml-auto" />
                </DropdownMenuItem>
              )}

              {profile?.is_premium && (
                <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer text-sm text-muted-foreground focus:text-foreground rounded-md" onClick={() => navigate('/pricing')}>
                  <Sparkles className="h-4 w-4" /><span>Manage Plan</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="gap-2.5 py-2 cursor-pointer text-sm text-muted-foreground focus:text-foreground rounded-md"
                onClick={() => { setSwitchOpen(true); }}
              >
                <User className="h-4 w-4" /><span>Switch Account</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-border/40 my-1" />
              <DropdownMenuItem className="gap-2.5 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-sm rounded-md" onClick={signOut}>
                <LogOut className="h-4 w-4" /><span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SwitchAccountSheet open={switchOpen} onOpenChange={setSwitchOpen} />
    </div>
  );
};

export default MobileNavHeader;
