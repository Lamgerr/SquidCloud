import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  Zap, 
  Lock, 
  Search, 
  Share2, 
  Cloud, 
  Smartphone, 
  FileUp, 
  ChevronRight 
} from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full backdrop-blur-lg bg-white/75 dark:bg-slate-900/75 border-b border-slate-200/50 dark:border-slate-800/50 transition-all duration-200">
        <div className="container mx-auto py-4 px-6 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg w-8 h-8 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm" />
            </div>
            <span className="font-semibold text-xl">InflateStorage</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link 
              to="/auth" 
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              Login
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-block mb-4">
              <div className="flex items-center space-x-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Unlimited Secure Storage
                </span>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 animate-slide-down">
              Secure, Unlimited Cloud Storage
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-blue-700">
                {" "}for Your Digital Life
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-slide-down animation-delay-100">
              Experience the future of secure storage with end-to-end encryption, unlimited space, and AI-powered organization.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12 animate-slide-down animation-delay-200">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started Free
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  See Features
                </Button>
              </Link>
            </div>
            
            {/* Security badges */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground mb-8 animate-fade-in animation-delay-300">
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>AES-256 Encryption</span>
              </div>
              <div className="flex items-center gap-1">
                <Lock className="h-4 w-4 text-green-500" />
                <span>Zero-Knowledge Privacy</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>High-Speed Transfers</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-blue-400/10 to-purple-500/10 blur-3xl -z-10" />
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 bg-slate-50 dark:bg-slate-900/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything you need to securely store, manage, and share your files.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">End-to-End Encryption</h3>
              <p className="text-muted-foreground">
                Your files are encrypted before they leave your device. Only you can access your data.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in animation-delay-100">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mb-4">
                <Cloud className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Unlimited Storage</h3>
              <p className="text-muted-foreground">
                Store as much as you want without worrying about running out of space.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in animation-delay-200">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered Search</h3>
              <p className="text-muted-foreground">
                Intelligent search helps you find any file instantly, even without the exact filename.
              </p>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in animation-delay-300">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-4">
                <Share2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Sharing</h3>
              <p className="text-muted-foreground">
                Share files securely with customized access controls and expiring links.
              </p>
            </div>
            
            {/* Feature 5 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in animation-delay-400">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-center mb-4">
                <Smartphone className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Cross-Device Sync</h3>
              <p className="text-muted-foreground">
                Access your files from any device with real-time synchronization.
              </p>
            </div>
            
            {/* Feature 6 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in animation-delay-500">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center mb-4">
                <FileUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Large File Support</h3>
              <p className="text-muted-foreground">
                Upload files of any size with our optimized large file transfer system.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Secure Your Files?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of users who trust InflateStorage for their secure storage needs.
            </p>
            
            <Link to="/auth">
              <Button size="lg" className="animate-pulse">
                Get Started Now
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-blue-400/5 to-purple-500/5 blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-green-400/5 to-blue-500/5 blur-3xl -z-10" />
      </section>
      
      {/* Footer */}
      <footer className="py-12 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg w-8 h-8 flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-sm" />
              </div>
              <span className="font-semibold">InflateStorage</span>
            </div>
            
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
              <span className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} InflateStorage. All rights reserved.
              </span>
              <div className="flex space-x-4">
                <Link to="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Privacy
                </Link>
                <Link to="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Terms
                </Link>
                <Link to="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
