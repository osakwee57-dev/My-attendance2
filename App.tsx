
import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { ConnectionTest } from './components/ConnectionTest';
import { Profile } from './types';
import { ShieldCheck, Database } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

const App: React.FC = () => {
  const [user, setUser] = useState<Profile | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(true);

  // Persistence Logic and Deep Linking
  useEffect(() => {
    // 1. Check for logged in user
    const savedUser = localStorage.getItem('attendance_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('attendance_user');
      }
    }

    // 2. Handle potential deep links from QR codes (/join/123456)
    const path = window.location.pathname;
    if (path.startsWith('/join/')) {
      const pin = path.split('/')[2];
      if (pin) {
        // Store PIN temporarily for the dashboard to pick up after login/resume
        sessionStorage.setItem('pending_pin', pin);
        // Clear URL for clean state
        window.history.replaceState({}, '', '/');
      }
    }

    setLoading(false);
  }, []);

  const handleLogin = (userData: Profile) => {
    setUser(userData);
    localStorage.setItem('attendance_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('attendance_user');
    sessionStorage.removeItem('pending_pin');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-indigo-600 uppercase tracking-widest animate-pulse">Initializing Gateways...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] dark:bg-slate-950 transition-colors duration-300">
      <Analytics />
      <nav className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-100 dark:shadow-none">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight hidden sm:block">AttendanceHub</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className={`p-2 rounded-xl transition-all ${showDebug ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
              title="Test Database Connection"
            >
              <Database className="w-5 h-5" />
            </button>
            {user && (
              <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-100 dark:border-slate-800">
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900 dark:text-white leading-none">{user.full_name}</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">{user.matric_no}</p>
                </div>
                <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-md shadow-indigo-100 dark:shadow-none">
                  {user.full_name.charAt(0)}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="py-8 px-4 sm:px-6">
        {showDebug && (
          <div className="mb-12">
            <ConnectionTest />
          </div>
        )}

        {user ? (
          <Dashboard user={user} onLogout={handleLogout} />
        ) : (
          <Auth onLogin={handleLogin} />
        )}
      </main>

      <footer className="max-w-4xl mx-auto py-12 text-center text-gray-400 text-[10px] uppercase tracking-widest font-bold opacity-60">
        <p>&copy; 2024 Dept. Attendance Identification System</p>
        <p className="mt-1">Digital Signature Protocol Enabled & PWA Ready</p>
      </footer>
    </div>
  );
};

export default App;
