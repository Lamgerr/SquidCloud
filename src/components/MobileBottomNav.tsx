
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, FolderOpen, Share2, Settings, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const MobileBottomNav = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  
  if (!isMobile) return null;
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 px-2 py-1 md:hidden">
      <div className="flex items-center justify-between">
        <NavItem 
          to="/dashboard" 
          icon={Home} 
          label="Home" 
          isActive={isActive('/dashboard')} 
        />
        <NavItem 
          to="/files" 
          icon={FolderOpen} 
          label="Files" 
          isActive={isActive('/files')} 
        />
        <NavItem 
          to="/upload" 
          icon={Plus} 
          label="Upload" 
          isActive={isActive('/upload')} 
          isPrimary
        />
        <NavItem 
          to="/shared" 
          icon={Share2} 
          label="Shared" 
          isActive={isActive('/shared')} 
        />
        <NavItem 
          to="/settings" 
          icon={Settings} 
          label="Settings" 
          isActive={isActive('/settings')} 
        />
      </div>
    </div>
  );
};

interface NavItemProps {
  to: string;
  icon: React.ComponentType<any>;
  label: string;
  isActive: boolean;
  isPrimary?: boolean;
}

const NavItem = ({ to, icon: Icon, label, isActive, isPrimary }: NavItemProps) => {
  return (
    <Link to={to} className="w-1/5 flex flex-col items-center justify-center">
      {isPrimary ? (
        <div className="rounded-full bg-primary p-3 -mt-6 shadow-lg">
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
      ) : (
        <>
          <Icon className={cn(
            "h-5 w-5 mb-1",
            isActive ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "text-[10px]",
            isActive ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {label}
          </span>
        </>
      )}
    </Link>
  );
};

export default MobileBottomNav;
