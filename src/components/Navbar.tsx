
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, LogOut, Menu, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const [avatar, setAvatar] = useState<string | null>(null);
  
  // Fetch user avatar
  useEffect(() => {
    async function fetchUserAvatar() {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
          
        if (data && data.avatar_url) {
          setAvatar(data.avatar_url);
        }
      }
    }
    
    fetchUserAvatar();
  }, [user]);

  return (
    <nav className="bg-background border-b z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-2xl font-bold text-primary">
                CloudBliss
              </Link>
              <div className="hidden md:ml-4 md:flex">
                <Link
                  to="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === '/dashboard'
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground/60 hover:text-primary hover:bg-primary/5'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/file-manager"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === '/file-manager'
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground/60 hover:text-primary hover:bg-primary/5'
                  }`}
                >
                  Storage
                </Link>
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            <ThemeToggle />
            
            {user ? (
              <div className="ml-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="h-8 w-8">
                        {avatar ? (
                          <AvatarImage src={avatar} alt={user.email || 'User'} />
                        ) : (
                          <AvatarFallback className="bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/file-manager')}>
                      File Manager
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-500 hover:text-red-500 focus:text-red-500"
                      onClick={() => signOut()}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button
                onClick={() => navigate('/login')}
                variant="default"
                size="sm"
                className="ml-3"
              >
                Login
              </Button>
            )}
            
            {isMobile && user && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {isMobile && mobileMenuOpen && (
        <div className="md:hidden border-t">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/dashboard"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                location.pathname === '/dashboard'
                  ? 'text-primary bg-primary/10'
                  : 'text-foreground/60 hover:text-primary hover:bg-primary/5'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to="/file-manager"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                location.pathname === '/file-manager'
                  ? 'text-primary bg-primary/10'
                  : 'text-foreground/60 hover:text-primary hover:bg-primary/5'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              File Manager
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
