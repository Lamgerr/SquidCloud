
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  LogOut, 
  Sun, 
  Moon, 
  Search,
  Menu,
  X,
  Shield,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from '@/hooks/use-mobile';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);
  
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };
  
  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account",
      });
      navigate('/');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };
  
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/files') return 'My Files';
    if (path === '/shared') return 'Shared Files';
    if (path === '/settings') return 'Settings';
    if (path.includes('/r/c/')) return 'Create Vault';
    if (path.includes('/r/p/')) return 'Secure Vault';
    return 'SecureVault';
  };
  
  const canGoBack = location.pathname !== '/dashboard' && location.pathname !== '/';
  
  // Don't show navbar on the landing or auth pages
  if (location.pathname === '/' || location.pathname === '/auth') {
    return null;
  }
  
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-background/90 border-b border-border">
      <div className="container px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-2">
          {isMobile && canGoBack ? (
            <Button 
              variant="ghost" 
              size="icon" 
              className="mr-1"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={20} />
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          )}
          
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-primary to-blue-600 rounded-lg w-7 h-7 flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-sm" />
            </div>
            {!isMobile && (
              <span className="font-semibold text-lg">SecureVault</span>
            )}
            {isMobile && (
              <span className="font-semibold text-lg">{getPageTitle()}</span>
            )}
          </Link>
          
          {!isMobile && (
            <nav className="ml-6 hidden md:flex items-center space-x-4">
              <Link to="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">
                Dashboard
              </Link>
              <Link to="/files" className="text-sm font-medium transition-colors hover:text-primary">
                My Files
              </Link>
              <Link to="/shared" className="text-sm font-medium transition-colors hover:text-primary">
                Shared
              </Link>
            </nav>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isMobile && (
            <div className="hidden sm:flex items-center relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                className="bg-secondary rounded-full px-10 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-[200px] lg:w-[300px]"
                placeholder="Search files..."
                type="search"
              />
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleTheme}
              className="transition-all duration-200"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            
            {user && !isMobile && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut size={18} />
                </Button>
                
                <Button
                  variant="ghost"
                  className="rounded-full h-7 w-7 p-0 overflow-hidden"
                >
                  <div className="h-full w-full rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {isMenuOpen && (
        <div className="fixed inset-0 top-14 bg-background/95 backdrop-blur-sm z-50 p-4 md:hidden animate-fade-in">
          <nav className="flex flex-col gap-4 mt-4">
            <Link 
              to="/dashboard" 
              className="p-4 rounded-lg hover:bg-secondary"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              to="/files" 
              className="p-4 rounded-lg hover:bg-secondary"
              onClick={() => setIsMenuOpen(false)}
            >
              My Files
            </Link>
            <Link 
              to="/shared" 
              className="p-4 rounded-lg hover:bg-secondary"
              onClick={() => setIsMenuOpen(false)}
            >
              Shared
            </Link>
            
            <div className="mt-auto border-t pt-4">
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
              >
                <LogOut className="mr-2" size={16} />
                Logout
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
