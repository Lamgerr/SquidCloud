
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
  Shield
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
  
  // Don't show navbar on the landing or auth pages
  if (location.pathname === '/' || location.pathname === '/auth') {
    return null;
  }
  
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-lg bg-white/75 dark:bg-slate-900/75 border-b border-slate-200/50 dark:border-slate-800/50 transition-all duration-200">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
          
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg w-8 h-8 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm" />
            </div>
            <span className="font-semibold text-xl hidden sm:inline-block">SecureVault</span>
          </Link>
          
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
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              className="bg-secondary rounded-full px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-[200px] lg:w-[300px]"
              placeholder="Search files..."
              type="search"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleTheme}
              className="transition-all duration-200"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            
            {user && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut size={20} />
                </Button>
                
                <Button
                  variant="ghost"
                  className="rounded-full h-8 w-8 p-0 overflow-hidden"
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
        <div className="fixed inset-0 top-16 bg-background/95 backdrop-blur-sm z-50 p-4 md:hidden animate-fade-in">
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
