
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Menu, Cloud as CloudIcon, LogOut } from '@/lib/icon-map';
import MaintenanceBanner from '@/components/MaintenanceBanner';

const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();

  return (
    <>
      <MaintenanceBanner />
      <nav className="bg-background border-b sticky top-0 z-50">
        <div className="container flex items-center justify-between py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg w-8 h-8 flex items-center justify-center"><div className="w-4 h-4 bg-white rounded-sm"></div></div>
          <span className="font-semibold md:inline-block">SquidCloud</span>
          <span className="text-xs text-muted-foreground hidden md:inline-block">by </span>
        </Link>
        
        {isMobile ? (
          user ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="sm:w-80">
                <SheetHeader>
                  <SheetTitle>User Menu</SheetTitle>
                  <SheetDescription>
                    Manage your account settings and preferences.
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="px-4 py-2">
                    <p className="text-sm font-medium leading-none">
                      {user.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.id}
                    </p>
                  </div>
                  
                  <Button variant="destructive" onClick={signOut} className="justify-start gap-2 mx-4">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Link to="/auth">
              <Button>Login</Button>
            </Link>
          )
        ) : (
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center">
                <Link to="/developer-api" className="inline-flex items-center justify-center rounded-lg px-2.5 h-8 text-sm font-medium hover:bg-muted hover:text-foreground">
                  Developer API
                </Link>
              </div>
            )}
            
            {user ? (
              <Button variant="destructive" onClick={signOut}>Logout</Button>
            ) : (
              <Link to="/auth">
                <Button>Login</Button>
              </Link>
            )}
          </div>
        )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
