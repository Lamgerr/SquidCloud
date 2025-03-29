import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, Navigate } from 'react-router-dom';
import './App.css';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import RepoCreation from './pages/RepoCreation';
import RepoCreationPassword from './pages/RepoCreationPassword';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import { useIsMobile } from './hooks/use-mobile';

// Component to handle new user redirection
const NewUserRedirect = ({ children }: { children: React.ReactNode }) => {
  const { isNewUser } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isNewUser) {
      navigate('/r/c/1');
    }
  }, [isNewUser, navigate]);
  
  return <>{children}</>;
};

// Mobile redirect component
const MobileRedirect = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  // If on mobile and logged in, redirect to dashboard
  if (isMobile && user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Otherwise show the landing page (for desktop users or mobile users who aren't logged in)
  return (
    <AppLayout showMobileNav={false}>
      <Index />
    </AppLayout>
  );
};

// Shared layout component that includes the main navigation elements
const AppLayout = ({ children, showMobileNav = true }: { children: React.ReactNode, showMobileNav?: boolean }) => {
  const isMobile = useIsMobile();
  
  return (
    <>
      <Navbar />
      <main className={`min-h-[calc(100vh-3.5rem)] ${isMobile && showMobileNav ? 'pb-16' : ''}`}>
        {children}
      </main>
      {showMobileNav && <MobileBottomNav />}
    </>
  );
};

const AppWithAuth = () => {
  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={<MobileRedirect />} 
        />
        <Route 
          path="/auth" 
          element={
            <AppLayout showMobileNav={false}>
              <Auth />
            </AppLayout>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <NewUserRedirect>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </NewUserRedirect>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/r/p/:count" 
          element={
            <ProtectedRoute>
              <AppLayout>
                <RepoCreationPassword />
              </AppLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/r/c/:count" 
          element={
            <ProtectedRoute>
              <AppLayout>
                <RepoCreation />
              </AppLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/files" 
          element={
            <ProtectedRoute>
              <NewUserRedirect>
                <AppLayout>
                  <Dashboard defaultTab="files" />
                </AppLayout>
              </NewUserRedirect>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/shared" 
          element={
            <ProtectedRoute>
              <NewUserRedirect>
                <AppLayout>
                  <Dashboard defaultTab="shared" />
                </AppLayout>
              </NewUserRedirect>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <NewUserRedirect>
                <AppLayout>
                  <Dashboard defaultTab="settings" />
                </AppLayout>
              </NewUserRedirect>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/upload" 
          element={
            <ProtectedRoute>
              <NewUserRedirect>
                <AppLayout>
                  <Dashboard openUpload={true} />
                </AppLayout>
              </NewUserRedirect>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="*" 
          element={
            <AppLayout showMobileNav={false}>
              <NotFound />
            </AppLayout>
          } 
        />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}

export default App;
