
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FolderOpen, Share2, Settings, Plus, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const MobileBottomNav = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  
  // Hide bottom nav on root path and auth page
  if (!isMobile || location.pathname === '/' || location.pathname === '/auth') return null;
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleUploadClick = () => {
    if (location.pathname === '/dashboard') {
      // If already on dashboard, scroll to top and focus on the upload button
      window.scrollTo(0, 0);
      const uploadBtn = document.querySelector('.upload-button-container button');
      if (uploadBtn) {
        (uploadBtn as HTMLElement).click();
      }
    } else {
      navigate('/dashboard');
    }
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50 px-2 py-1 md:hidden">
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
        <div className="w-1/5 flex flex-col items-center justify-center">
          <Button 
            onClick={handleUploadClick} 
            className="rounded-full bg-primary p-3 -mt-6 shadow-lg"
          >
            <Upload className="h-5 w-5 text-primary-foreground" />
          </Button>
          <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
        </div>
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
