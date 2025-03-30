
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FileText, UploadCloud, Share2, Settings, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

const MobileBottomNav: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  if (!isMobile || !user) return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-t border-border z-50">
      <div className="container h-full">
        <div className="flex items-center justify-around h-full">
          <NavLink
            to="/files"
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center w-16 h-full",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs mt-1">Files</span>
          </NavLink>
          
          <NavLink
            to="/upload"
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center w-16 h-full",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <UploadCloud className="h-5 w-5" />
            <span className="text-xs mt-1">Upload</span>
          </NavLink>
          
          <NavLink
            to="/shared"
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center w-16 h-full",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Share2 className="h-5 w-5" />
            <span className="text-xs mt-1">Shared</span>
          </NavLink>
          
          <div className="flex flex-col items-center justify-center w-16 h-full text-muted-foreground">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex flex-col items-center focus:outline-none">
                <div className="bg-background/90 backdrop-blur-lg p-1.5 rounded-md border border-border/30 shadow-sm">
                  <Menu className="h-5 w-5" />
                </div>
                <span className="text-xs mt-1">Menu</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-xl border border-border/50">
                <DropdownMenuItem asChild>
                  <NavLink to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-left">
                  <div className="font-medium">CloudBliss Storage</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileBottomNav;
