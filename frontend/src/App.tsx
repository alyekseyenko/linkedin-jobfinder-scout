import './index.css'
import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Sparkles, LayoutDashboard, BrainCircuit, User, Activity, ShieldCheck, ShieldAlert } from 'lucide-react'
import { mcpService } from './lib/mcp-service'
import { AnimatePresence } from 'framer-motion'
import { LinkedInAuthModal } from './components/LinkedInAuthModal'

// Principal/Staff Front-End Optimization: Route-level code splitting
const Dashboard = lazy(() => import('./components/Dashboard'))
const Pipeline = lazy(() => import('./components/Pipeline'))
const MyCV = lazy(() => import('./components/MyCV'))
const SystemDiagnostics = lazy(() => import('./components/SystemDiagnostics'))

function PageLoader() {
  return (
    <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-green-500/20 border-t-green-400 animate-spin" />
      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Loading Neural Module...</span>
    </div>
  )
}

function AppContent() {
  const location = useLocation();
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isLinkedInAuthOpen, setIsLinkedInAuthOpen] = useState(false);
  const [isLinkedInConnected, setIsLinkedInConnected] = useState<boolean | null>(null);

  useEffect(() => {
    mcpService.getLinkedInAuthStatus()
      .then(res => setIsLinkedInConnected(res.connected))
      .catch(() => setIsLinkedInConnected(false));
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    
    const checkNewJobs = async () => {
      try {
        const jobs = await mcpService.fetchCRMJobs();
        const discovered = jobs.filter(j => j.status === 'discovered');
        const lastCount = parseInt(localStorage.getItem('last_discovered_count') || '0');
        
        if (discovered.length > lastCount) {
          if (Notification.permission === "granted") {
            new Notification("Neural Scout: Nova Proposta! 🎯", {
              body: `${discovered.length - lastCount} novas vagas de alta compatibilidade detetadas pelo Autopilot.`,
            });
          }
          localStorage.setItem('last_discovered_count', discovered.length.toString());
        } else if (discovered.length < lastCount) {
          // If user cleared jobs, reset the count
          localStorage.setItem('last_discovered_count', discovered.length.toString());
        }
      } catch (e) {
        console.error('Notification monitor failed:', e);
      }
    };

    const interval = setInterval(checkNewJobs, 1000 * 60 * 15); // Check every 15 mins
    checkNewJobs(); 
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="min-h-screen bg-[#050505] selection:bg-green-500/30 selection:text-green-400 flex flex-col font-sans">
      {/* Global Navigation */}
      <nav className="flex-none z-50 bg-[#050505]/80 border-b border-white/5 backdrop-blur-2xl sticky top-0">
        <div className="w-full px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                <BrainCircuit className="text-green-400" size={20} />
            </div>
            <span className="font-black text-lg tracking-tighter text-white uppercase select-none">
              Neural Career<span className="text-green-500">.</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-white/[0.03] p-1.5 rounded-full border border-white/10 backdrop-blur-xl">
            <Link 
              to="/cv" 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                location.pathname === '/cv' 
                  ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-100' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
              title="Configure your professional profile, experience, and career goals"
            >
              <User size={13} />
              1. Profile CV
            </Link>
            <Link 
              to="/" 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                location.pathname === '/' 
                  ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-100' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
              title="Real-time jobs and matches scouted by your autonomous agent"
            >
              <LayoutDashboard size={13} />
              2. Job Radar
            </Link>
            <Link 
              to="/pipeline" 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                location.pathname === '/pipeline' 
                  ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-100' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
              title="Track your job applications, interviews, and offers"
            >
              <Sparkles size={13} />
              3. Applications
            </Link>
            <button
               onClick={() => setIsDiagnosticsOpen(true)}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-all ml-1"
               title="System health diagnostics and microservices status"
             >
               <Activity size={13} className="text-bio-neon-blue" />
               Diagnostics
             </button>
          </div>
          
          <div className="flex items-center gap-3">
             {/* LinkedIn Connection Status Cockpit */}
             <button
               onClick={() => setIsLinkedInAuthOpen(true)}
               className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                 isLinkedInConnected
                   ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                   : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse'
               }`}
               title={isLinkedInConnected ? 'LinkedIn session active - Click to manage or disconnect' : 'LinkedIn disconnected - Click to connect your account'}
             >
               {isLinkedInConnected ? (
                 <>
                   <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                   <span className="hidden sm:inline">LinkedIn Connected</span>
                 </>
               ) : (
                 <>
                   <ShieldAlert size={14} className="text-amber-400" />
                   <span>Connect LinkedIn</span>
                 </>
               )}
             </button>

             <div className="hidden md:flex flex-col items-end">
                <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Autonomous Agent</span>
                <span className="text-[10px] font-bold text-green-400 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Active 24/7
                </span>
             </div>
          </div>
        </div>
      </nav>

      {/* Mandatory / First-time LinkedIn Connection Warning Banner */}
      {isLinkedInConnected === false && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs backdrop-blur-md">
          <div className="flex items-center gap-2.5 text-amber-300">
            <ShieldAlert size={16} className="shrink-0 text-amber-400" />
            <span>
              <strong>LinkedIn Session Disconnected:</strong> Connect your account to enable real-time job scraping and one-click auto-fill.
            </span>
          </div>
          <button
            onClick={() => setIsLinkedInAuthOpen(true)}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[10px] tracking-wider transition-all shrink-0 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            Connect Now
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/cv" element={<MyCV />} />
          </Routes>
        </Suspense>
      </main>

      <AnimatePresence>
        {isDiagnosticsOpen && (
          <Suspense fallback={null}>
            <SystemDiagnostics 
              isOpen={isDiagnosticsOpen} 
              onClose={() => setIsDiagnosticsOpen(false)} 
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* LinkedIn Auth Lifecycle Modal */}
      <LinkedInAuthModal
        isOpen={isLinkedInAuthOpen}
        onClose={() => setIsLinkedInAuthOpen(false)}
        onStatusChange={(connected) => setIsLinkedInConnected(connected)}
      />
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
