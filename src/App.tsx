import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/auth/AuthProvider';
import LoginPage from './pages/LoginPage';
import ProfileSetup from './pages/ProfileSetup';
import UserDashboard from './pages/UserDashboard';
import OperationalForm from './pages/OperationalForm';
import LiquidationWorkflow from './pages/LiquidationWorkflow';
import SummaryView from './pages/SummaryView';
import AdminDashboard from './pages/AdminDashboard';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { LogOut, LayoutDashboard, ShieldCheck, User, Menu, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './components/ui/button';
import { OperationalEntry } from './types';

function Navigation() {
  const { user, loading, isAdmin, isProfileComplete } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeEntry, setActiveEntry] = useState<OperationalEntry | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (user) {
      setIsLoggingOut(false);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const toastId = toast.loading("Disconnecting from STLAF Ops...");
      const { auth } = await import('./lib/firebase');
      await auth.signOut();
      toast.success("Disconnected successfully.", { id: toastId });
    } catch (error) {
      console.error(error);
      setIsLoggingOut(false);
      toast.error("Failed to disconnect.");
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-white flex-col gap-4">
       <div className="w-12 h-12 border-4 border-navy-900 border-t-transparent rounded-full animate-spin"></div>
       <p className="text-navy-900 font-black italic tracking-tighter">Initializing STLAF Ops...</p>
    </div>
  );
  
  if (!user) return <LoginPage />;
  if (!isProfileComplete) return <ProfileSetup />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': 
        return (
          <UserDashboard 
            onNewEntry={() => { setActiveEntry(undefined); setCurrentPage('operational-form'); }}
            onContinueEntry={(entry) => {
              setActiveEntry(entry);
              if (entry.status === 'Draft') setCurrentPage('operational-form');
              else setCurrentPage('liquidation-workflow');
            }}
            onViewEntry={(entry) => { setActiveEntry(entry); setCurrentPage('summary-view'); }}
          />
        );
      case 'operational-form': 
        return (
          <OperationalForm 
            entry={activeEntry}
            onBack={() => setCurrentPage('dashboard')} 
            onSuccess={() => setCurrentPage('dashboard')}
          />
        );
      case 'liquidation-workflow':
        return (
          <LiquidationWorkflow 
            entry={activeEntry!}
            onBack={() => setCurrentPage('dashboard')}
            onSuccess={() => setCurrentPage('dashboard')}
          />
        );
      case 'summary-view':
        return <SummaryView entry={activeEntry!} onBack={() => setCurrentPage('dashboard')} />;
      case 'admin-dashboard': 
        return isAdmin ? <AdminDashboard type="opex" onBack={() => setCurrentPage('dashboard')} /> : <UserDashboard onNewEntry={() => {}} onContinueEntry={() => {}} onViewEntry={() => {}} />;
      default: return <UserDashboard onNewEntry={() => {}} onContinueEntry={() => {}} onViewEntry={() => {}} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'My Operations', adminOnly: false },
    { id: 'admin-dashboard', label: 'Admin Hub', adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-navy-900 selection:text-white">
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-6">
          <div 
            className="flex items-center gap-3 font-black text-navy-900 cursor-pointer group" 
            onClick={() => setCurrentPage('dashboard')}
          >
            <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white transition-transform group-hover:rotate-6">
               <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="flex flex-col -space-y-1">
               <span className="text-xl tracking-tighter italic uppercase">STLAF Ops</span>
               <span className="text-[9px] font-black tracking-[0.3em] text-slate-400 uppercase">Mission Control v4.0</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.filter(i => !i.adminOnly || isAdmin).map((item) => (
              <button 
                key={item.id}
                onClick={() => setCurrentPage(item.id)} 
                className={`text-xs font-black uppercase tracking-widest transition-all hover:text-navy-900 relative py-2 ${currentPage === item.id ? 'text-navy-900' : 'text-slate-400'}`}
              >
                {item.label}
                {currentPage === item.id && (
                  <motion.div layoutId="nav-pill" className="absolute -bottom-1 left-0 right-0 h-1 bg-navy-900 rounded-full" />
                )}
              </button>
            ))}
            
            <div className="h-6 w-[1px] bg-slate-100 mx-2" />
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end -space-y-1">
                 <span className="text-xs font-black text-navy-900">{user.displayName || 'Officer'}</span>
                 <span className="text-[10px] font-bold text-slate-400">{isAdmin ? 'ADMINISTRATOR' : 'FIELD OFFICER'}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                 {user.photoURL ? <img src={user.photoURL} alt="User" /> : <User className="h-5 w-5 text-navy-900" />}
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                disabled={isLoggingOut}
                onClick={handleLogout}
                className="rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                {isLoggingOut ? <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <LogOut className="h-5 w-5" />}
              </Button>
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <Button variant="ghost" size="icon" className="lg:hidden rounded-xl" onClick={() => setIsMenuOpen(!isMenuOpen)}>
             {isMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-white border-b border-slate-100 overflow-hidden"
            >
               <div className="p-6 space-y-4">
                  {navItems.filter(i => !i.adminOnly || isAdmin).map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => { setCurrentPage(item.id); setIsMenuOpen(false); }}
                      className="flex items-center justify-between w-full p-6 bg-slate-50 rounded-3xl font-black text-xs uppercase tracking-widest text-navy-900"
                    >
                      {item.label}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}
                  <Button 
                    variant="destructive" 
                    disabled={isLoggingOut}
                    className="w-full h-16 rounded-3xl font-black uppercase tracking-widest gap-2 bg-red-500 text-white hover:bg-red-600 hover:text-white disabled:opacity-50"
                    onClick={handleLogout}
                  >
                    {isLoggingOut ? "Disconnecting..." : "Logout System"}
                    {isLoggingOut ? <div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" /> : <LogOut className="h-4 w-4" />}
                  </Button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto py-12 px-6 border-t border-slate-50">
         <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
               <ShieldCheck className="h-6 w-6 text-slate-300" />
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 italic">STLAF Liaison Ops Management System © 2026</span>
            </div>
            <div className="flex gap-6">
               <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-navy-900 border-b border-transparent hover:border-slate-300 transition-all">System Health</button>
               <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-navy-900 border-b border-transparent hover:border-slate-300 transition-all">Documentation</button>
               <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-navy-900 border-b border-transparent hover:border-slate-300 transition-all">Support</button>
            </div>
         </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navigation />
      <Toaster />
    </AuthProvider>
  );
}
