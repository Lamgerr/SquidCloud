
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import RepoCreation from './pages/RepoCreation';
import RepoCreationPassword from './pages/RepoCreationPassword';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import { useIsMobile } from './hooks/use-mobile';

// Shared layout component that includes the main navigation elements
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  
  return (
    <>
      <Navbar />
      <main className={`min-h-[calc(100vh-3.5rem)] ${isMobile ? 'pb-16' : ''}`}>
        {children}
      </main>
      <MobileBottomNav />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              <AppLayout>
                <Index />
              </AppLayout>
            } 
          />
          <Route 
            path="/auth" 
            element={
              <AppLayout>
                <Auth />
              </AppLayout>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
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
          {/* Add routes for mobile navigation */}
          <Route 
            path="/files" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard defaultTab="files" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/shared" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard defaultTab="shared" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard defaultTab="settings" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/upload" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard openUpload={true} />
                </AppLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="*" 
            element={
              <AppLayout>
                <NotFound />
              </AppLayout>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
