
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, 
  BarChart3, 
  Lock, 
  Settings, 
  LogOut, 
  Sparkles,
  Menu,
  X
} from '@/lib/icon-map';
import { useIsMobile } from '@/hooks/use-mobile';
import SquidLogo from '@/components/ui/SquidLogo';
import { SignalsBell } from '@/components/SignalsBell';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { GlassNav, type GlassNavItem } from '@/components/layout/GlassNav';

/**
 * NavIconButton — reusable icon-only nav item with tooltip
 * 
 * Design: 36x36 hit target, 18px icons, muted → foreground on hover,
 * primary accent for active state with bottom indicator dot.
 */
interface NavIconButtonProps {
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  className?: string;
}

const NavIconButton: React.FC<NavIconButtonProps> = ({ 
  to, onClick, icon, label, isActive, className 
}) => {
  const buttonClasses = cn(
    "relative flex items-center justify-center w-9 h-9 rounded-lg",
    "motion-fast motion-press",
    "hover:bg-accent/70",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "group",
    isActive && "bg-accent",
    className
  );

  const iconClasses = cn(
    "w-[18px] h-[18px] motion-fast",
    "text-muted-foreground group-hover:text-foreground",
    isActive && "text-primary"
  );

  const content = (
    <>
      <span className={iconClasses}>{icon}</span>
      <span className="sr-only">{label}</span>
      {isActive && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-primary rounded-full" />
      )}
    </>
  );

  const tooltipContent = (
    <TooltipContent
      side="bottom"
      sideOffset={8}
      className="text-popover-foreground text-xs px-2.5 py-1.5 rounded-lg shadow-lg animate-fade-in-scale"
    >
      {label}
    </TooltipContent>
  );

  if (to) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link to={to} className={buttonClasses} aria-label={label}>
              {content}
            </Link>
          }
        />
        {tooltipContent}
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button onClick={onClick} className={buttonClasses} aria-label={label}>
            {content}
          </button>
        }
      />
      {tooltipContent}
    </Tooltip>
  );
};

/**
 * MainHeader — Global navigation bar
 * 
 * Design decisions:
 * - 56px height (14 × 4px grid)
 * - Sticky with backdrop blur for layered scroll feel
 * - Icon groups separated by subtle vertical dividers
 * - Logo uses gradient brand mark + text label
 * - Mobile: hamburger → slide-down drawer
 */
const MainHeader: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Scroll-linked header: gains definition once content moves under it.
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  
  // Hide on mobile for app-shell routes (they have their own nav).
  // NOTE: routes with their own in-page TopBar (developer-api, settings,
  // docs, checkout) never render MainHeader at all — see showHeader in App.tsx.
  const hiddenMobileRoutes = ['/dashboard', '/auth', '/webhooks', '/settings'];
  if (isMobile && hiddenMobileRoutes.some(route => location.pathname.startsWith(route))) {
    return null;
  }

  const isActiveRoute = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
      <TooltipProvider delay={200}>
      <header 
        className={cn(
          "sticky top-0 z-50 w-full",
          "h-14",
          "bg-background/85 backdrop-blur-xl",
          "border-b",
          scrolled ? "border-border/60 shadow-[0_1px_0_rgba(0,0,0,0.25)]" : "border-border/30",
          "motion-base"
        )}
        role="banner"
      >
        <div className="h-full px-5 lg:px-6 flex items-center justify-between max-w-full">
          {/* ── Logo ── */}
          <Link 
            to="/" 
            className={cn(
              "flex items-center gap-2.5",
              "motion-fast hover:opacity-80 active:opacity-70",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 rounded-lg"
            )}
            aria-label="SquidCloud Home"
          >
            <SquidLogo className="motion-fast hover:scale-105" />
            <span className="font-semibold text-[15px] tracking-[-0.01em] text-foreground hidden sm:inline-block">
              SquidCloud
            </span>
          </Link>
          
          {/* ── Mobile hamburger ── */}
          {isMobile && user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg",
                "motion-fast motion-press",
                "hover:bg-accent/60"
              )}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-foreground" />
              ) : (
                <Menu className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          )}

          {/* ── Desktop nav ── */}
          {!isMobile && (
            <nav className="flex items-center gap-2" role="navigation" aria-label="Main navigation">
              {user ? (
                <>
                  <GlassNav
                    layoutId="main-header-thumb"
                    items={([
                      { key: 'dashboard', label: 'Files', icon: <LayoutDashboard />, to: '/dashboard', active: isActiveRoute('/dashboard') },
                      { key: 'analytics', label: 'Insights', icon: <BarChart3 />, to: '/analytics', active: isActiveRoute('/analytics') },
                      { key: 'security', label: 'Security', icon: <Lock />, to: '/security', active: isActiveRoute('/security') },
                      { key: 'settings', label: 'Settings', icon: <Settings />, to: '/settings/account', active: isActiveRoute('/settings') },
                    ] as GlassNavItem[])}
                  />

                  <div className="flex items-center gap-0.5 pl-1">
                    <NavIconButton
                      onClick={() => window.dispatchEvent(new Event('openSquidAI'))}
                      icon={<Sparkles className="text-muted-foreground" />}
                      label="Squid AI (⌘K)"
                    />
                    <SignalsBell />
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center ml-0.5",
                            "motion-fast motion-press",
                            "hover:bg-accent/60",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          )}
                          aria-label="User menu"
                        >
                          <Avatar className="h-7 w-7 ring-1.5 ring-border/40">
                            <AvatarImage src={profile?.avatar_url} alt={user?.email || 'User'} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="end" 
                        sideOffset={8}
                        className={cn(
                          "w-56",
                          "bg-popover/95 backdrop-blur-xl",
                          "border border-border/50",
                          "shadow-xl rounded-xl",
                          "animate-fade-in-scale"
                        )}
                      >
                        <div className="px-3 py-2.5 border-b border-border/30">
                          <p className="text-sm font-medium text-foreground truncate">
                            {profile?.display_name || user?.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {user?.email}
                          </p>
                        </div>
                        <div className="p-1">
                          <DropdownMenuItem asChild>
                            <Link 
                              to="/settings/account" 
                              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent/60 motion-fast"
                            >
                              <Settings className="h-4 w-4" />
                              <span className="text-sm">User Settings</span>
                            </Link>
                          </DropdownMenuItem>
                        </div>
                        <DropdownMenuSeparator className="bg-border/30 mx-1" />
                        <div className="p-1">
                          <DropdownMenuItem 
                            onClick={signOut}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 motion-fast"
                          >
                            <LogOut className="h-4 w-4" />
                            <span className="text-sm">Sign Out</span>
                          </DropdownMenuItem>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link 
                    to="/auth" 
                    className="text-sm text-muted-foreground hover:text-foreground motion-fast font-medium"
                  >
                    Sign In
                  </Link>
                  <Button
                    render={<Link to="/auth" />}
                    className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-lg motion-fast motion-press shadow-sm shadow-primary/15"
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </nav>
          )}
        </div>

        {/* ── Mobile drawer ── */}
        {isMobile && mobileMenuOpen && user && (
          <nav 
            className={cn(
              "absolute top-14 left-0 right-0",
              "bg-background/95 backdrop-blur-xl",
              "border-b border-border/30",
              "px-4 py-4",
              "animate-slide-down shadow-lg"
            )}
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="grid grid-cols-4 gap-2">
              {[
                { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { to: '/analytics', icon: BarChart3, label: 'Analytics' },
                { to: '/security', icon: Lock, label: 'Security' },
                { to: '/settings/account', icon: Settings, label: 'Settings' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl",
                    "motion-fast motion-press",
                    "hover:bg-accent/60",
                    isActiveRoute(item.to) && "bg-accent/50"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className={cn(
                    "w-5 h-5",
                    isActiveRoute(item.to) ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
                </Link>
              ))}
            </div>
            
            <div className="mt-3 pt-3 border-t border-border/30">
              <button
                onClick={() => { signOut(); setMobileMenuOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 p-3 rounded-xl",
                  "text-destructive hover:bg-destructive/10",
                  "motion-fast motion-press"
                )}
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </nav>
        )}
      </header>
      </TooltipProvider>
  );
};

export default MainHeader;
