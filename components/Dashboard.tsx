
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Profile, Session, Attendance } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Plus, Users, Calendar, ClipboardCheck, Clock, 
  CheckCircle2, AlertCircle, LogOut, Download, 
  Power, PowerOff, ShieldCheck, Eye, Hash, BookOpen,
  FileText, QrCode, ArrowUpRight, ListFilter, PlayCircle,
  GraduationCap, Moon, Sun, Share2, Trash2, Search, Copy,
  UserX, CheckCircle, RefreshCw, XCircle, Share
} from 'lucide-react';

interface DashboardProps {
  user: Profile;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<'live' | 'directory' | 'history'>('live');
  const [isDark, setIsDark] = useState(false);
  
  // Data State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [deptStudents, setDeptStudents] = useState<Profile[]>([]);
  const [myAttendanceHistory, setMyAttendanceHistory] = useState<any[]>([]);
  
  // Interaction State
  const [loading, setLoading] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [sixDigitCode, setSixDigitCode] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [studentPin, setStudentPin] = useState('');
  const [myLevel, setMyLevel] = useState(user.level);
  const [searchQuery, setSearchQuery] = useState('');

  // --------------------------------------------------------------------------
  // THEME & PERSISTENCE
  // --------------------------------------------------------------------------
  useEffect(() => {
    const isSavedDark = localStorage.getItem('theme') === 'dark';
    setIsDark(isSavedDark);

    // Check for pending deep link PIN
    const pendingPin = sessionStorage.getItem('pending_pin');
    if (pendingPin && user.role === 'student') {
      setStudentPin(pendingPin);
      sessionStorage.removeItem('pending_pin');
      // Toast notification or similar could be added here
    }
  }, [user.role]);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------
  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('department', user.department)
      .order('created_at', { ascending: false });
    
    if (data) setSessions(data);
  }, [user.department]);

  const fetchAttendance = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('attendance')
      .select(`
        *,
        profiles:student_id (full_name, matric_no, signature)
      `)
      .eq('session_id', sessionId)
      .order('signed_at', { ascending: false });
    
    if (data) setAttendanceRecords(data as any);
  }, []);

  const fetchMyHistory = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select(`
        *,
        active_sessions:session_id (course_code, created_at)
      `)
      .eq('student_id', user.id)
      .order('signed_at', { ascending: false });
    
    if (data) setMyAttendanceHistory(data as any);
  }, [user.id]);

  const fetchDeptStudents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('department', user.department)
      .eq('role', 'student');

    if (data) {
      const sorted = [...data].sort((a, b) => a.matric_no.localeCompare(b.matric_no));
      setDeptStudents(sorted);
    }
    setLoading(false);
  }, [user.department]);

  // --------------------------------------------------------------------------
  // AUTO-RESUME SESSION (HOC ONLY)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (user.role !== 'HOC') return;

    const resumeSession = async () => {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('hoc_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        setSelectedSessionId(data.id);
        setSixDigitCode(data.unique_code);
        fetchAttendance(data.id);
      }
    };
    
    resumeSession();
  }, [user.id, user.role, fetchAttendance]);

  // --------------------------------------------------------------------------
  // REAL-TIME SUBSCRIPTIONS
  // --------------------------------------------------------------------------
  useEffect(() => {
    fetchSessions();
    if (user.role === 'student') fetchMyHistory();

    const sessionChannel = supabase.channel('active_session_updates')
      .on('postgres_changes', { 
        event: '*', 
        table: 'active_sessions',
        filter: `department=eq.${user.department}` 
      }, () => fetchSessions())
      .subscribe();

    return () => { supabase.removeChannel(sessionChannel); };
  }, [user.department, user.role, fetchSessions, fetchMyHistory]);

  useEffect(() => {
    if (!selectedSessionId) return;

    const attendanceChannel = supabase.channel('live_attendance_updates')
      .on('postgres_changes', {
        event: '*', 
        table: 'attendance',
        filter: `session_id=eq.${selectedSessionId}`
      }, () => fetchAttendance(selectedSessionId))
      .subscribe();

    return () => { supabase.removeChannel(attendanceChannel); };
  }, [selectedSessionId, fetchAttendance]);

  // Tab change side effects
  useEffect(() => {
    if (activeTab === 'directory') fetchDeptStudents();
    if (activeTab === 'history') fetchMyHistory();
  }, [activeTab, fetchDeptStudents, fetchMyHistory]);

  // --------------------------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------------------------
  const updateLevel = async (lvl: string) => {
    const { error } = await supabase.from('profiles').update({ level: lvl }).eq('id', user.id);
    if (!error) {
      setMyLevel(lvl);
      const savedUser = localStorage.getItem('attendance_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.level = lvl;
        localStorage.setItem('attendance_user', JSON.stringify(parsed));
      }
    }
  };

  const startSession = async () => {
    if (!courseCode.trim()) return alert("Please enter a course code.");
    
    setLoading(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const { data: sessionData, error: sError } = await supabase
      .from('active_sessions')
      .insert([{
        course_code: courseCode.toUpperCase(),
        unique_code: code,
        hoc_id: user.id,
        department: user.department,
        is_active: true 
      }]).select();
    
    if (sError) {
      alert(sError.message);
    } else if (sessionData && sessionData[0]) {
      setSixDigitCode(code);
      setCourseCode('');
      fetchSessions();
      setSelectedSessionId(sessionData[0].id);
      fetchAttendance(sessionData[0].id);
      try { await navigator.clipboard.writeText(code); } catch (e) {}
    }
    setLoading(false);
  };

  const shareSessionDetails = async () => {
    const activeSession = sessions.find(s => s.id === selectedSessionId);
    const currentCourse = activeSession?.course_code || "Class";
    const shareText = `📝 Attendance PIN for ${currentCourse}\n🔢 PIN: ${sixDigitCode}\n🔗 Fast Join: ${window.location.origin}/join/${sixDigitCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Class Attendance PIN',
          text: shareText,
        });
      } catch (err) { console.log("Share failed", err); }
    } else {
      await navigator.clipboard.writeText(shareText);
      alert("Session info copied to clipboard!");
    }
  };

  const endSessionManually = async () => {
    if (!selectedSessionId) return;
    
    const { error } = await supabase
      .from('active_sessions')
      .update({ is_active: false })
      .eq('id', selectedSessionId);

    if (!error) {
      setSixDigitCode('');
      fetchSessions();
      alert("Portal closed successfully.");
    } else {
      alert("Error closing portal: " + error.message);
    }
  };

  const toggleSessionStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('active_sessions')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    if (error) alert(error.message);
    else {
      fetchSessions();
      if (id === selectedSessionId && currentStatus === true) {
        setSixDigitCode('');
      }
    }
  };

  const deleteSession = async (id: string) => {
    if (!confirm("Delete this session? All attendance logs for this course will be permanently removed.")) return;
    const { error } = await supabase.from('active_sessions').delete().eq('id', id);
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSessionId === id) {
        setSelectedSessionId(null);
        setAttendanceRecords([]);
        setSixDigitCode('');
      }
    }
  };

  const removeStudentRecord = async (attendanceId: string) => {
    if (!confirm("Remove this student from the list?")) return;
    const { error } = await supabase.from('attendance').delete().eq('id', attendanceId);
    if (error) alert(error.message);
  };

  const handleMarkAttendance = async (session: Session) => {
    if (!session.is_active) return alert("This portal is currently closed by the HOC.");
    if (studentPin !== session.unique_code) return alert("Invalid PIN. Please obtain the 6-digit code from the front of the class.");

    setLoading(true);

    const { data: verifySession, error: vError } = await supabase
      .from('active_sessions')
      .select('id, is_active')
      .eq('id', session.id)
      .maybeSingle();

    if (!verifySession || vError) {
      alert("This session no longer exists. It may have been deleted by the HOC.");
      setLoading(false);
      fetchSessions(); 
      return;
    }

    if (!verifySession.is_active) {
      alert("This portal has just been closed by the HOC.");
      setLoading(false);
      fetchSessions();
      return;
    }

    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', user.id)
      .eq('session_id', session.id)
      .maybeSingle();

    if (existing) {
      alert("Verification Error: You have already signed for this session.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('attendance').insert([{
      student_id: user.id,
      session_id: session.id,
      status: 'present',
      department: user.department,
      signed_at: new Date().toISOString()
    }]);

    if (error) {
      if (error.code === '23503') { 
        alert("Session Expired: The lecture has been removed. Please check with your HOC.");
      } else {
        alert("Database Error: " + error.message);
      }
      fetchSessions();
    } else {
      alert("Success: Attendance Recorded.");
      setStudentPin('');
      fetchMyHistory();
    }
    setLoading(false);
  };

  const downloadHistory = () => {
    if (sessions.length === 0) return alert("No history to download");

    const headers = "Date,Course Code,PIN,Status\n";
    const rows = sessions.map(s => {
      const date = new Date(s.created_at).toLocaleDateString();
      const status = s.is_active ? 'Active' : 'Closed';
      return `${date},${s.course_code},${s.unique_code},${status}`;
    }).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Session_History_${user.department}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const shareHistorySummary = async () => {
    if (sessions.length === 0) return alert("No history to share");

    let summaryText = `Attendance Summary for ${user.department}\n\n`;
    sessions.slice(0, 8).forEach(s => {
      summaryText += `• ${s.course_code}: PIN ${s.unique_code} (${new Date(s.created_at).toLocaleDateString()})\n`;
    });
    if (sessions.length > 8) summaryText += `...and ${sessions.length - 8} more sessions.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Department Attendance History',
          text: summaryText,
        });
      } else {
        await navigator.clipboard.writeText(summaryText);
        alert("Summary copied to clipboard!");
      }
    } catch (err) {}
  };

  const downloadPDF = () => {
    if (attendanceRecords.length === 0) return alert("No sign-ins found to export.");
    const session = sessions.find(s => s.id === selectedSessionId);
    
    const doc = new (jsPDF as any)();
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); 
    doc.text(`OFFICIAL ATTENDANCE LOG`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Course: ${session?.course_code || 'N/A'}`, 14, 28);
    doc.text(`Department: ${user.department}`, 14, 34);
    doc.text(`Date Created: ${new Date(session?.created_at || Date.now()).toLocaleDateString()}`, 14, 40);
    doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 46);
    
    (doc as any).autoTable({
      startY: 54,
      head: [['#', 'Full Student Name', 'Matriculation No', 'Time Signed', 'Digital Signature']],
      body: attendanceRecords.map((item, i) => [
        i + 1,
        item.profiles?.full_name || 'N/A',
        item.profiles?.matric_no || 'N/A',
        new Date(item.signed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ''
      ]),
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      didDrawCell: (data: any) => {
        if (data.column.index === 4 && data.section === 'body') {
          const sig = attendanceRecords[data.row.index].profiles?.signature;
          if (sig) {
            doc.addImage(sig, 'PNG', data.cell.x + 2, data.cell.y + 2, 12, 6);
          }
        }
      }
    });

    doc.save(`${session?.course_code}_Attendance_Registry.pdf`);
  };

  const filteredStudents = useMemo(() => {
    return deptStudents.filter(s => 
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.matric_no.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [deptStudents, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <header className="card p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-12 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center border border-gray-200 dark:border-slate-600 overflow-hidden shrink-0 shadow-sm ring-4 ring-gray-50 dark:ring-slate-800">
               <img 
                 src={user.signature} 
                 alt="User Signature" 
                 className={`max-h-full max-w-full object-contain p-1 ${isDark ? 'invert grayscale' : ''}`} 
               />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white leading-tight flex items-center gap-2">
                {user.full_name}
                {user.role === 'HOC' && <ShieldCheck className="w-4 h-4 text-indigo-500" title="Admin Verified" />}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg uppercase tracking-tight ring-1 ring-indigo-100 dark:ring-indigo-800">
                  {user.department}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lvl:</label>
                  <select 
                    value={myLevel} 
                    onChange={e => updateLevel(e.target.value)}
                    className="text-[10px] font-black bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 py-1 px-2 rounded-lg cursor-pointer focus:ring-1 focus:ring-indigo-400 outline-none text-indigo-600 dark:text-indigo-400"
                  >
                    {['100','200','300','400','500'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('live')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'live' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <PlayCircle className="w-4 h-4" /> Live
              </button>
              {user.role === 'HOC' && (
                <button 
                  onClick={() => setActiveTab('directory')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'directory' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Users className="w-4 h-4" /> Registry
                </button>
              )}
              {user.role === 'student' && (
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Clock className="w-4 h-4" /> My Logs
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
               <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-xl text-gray-400 hover:text-indigo-500 transition-colors"
                title="Toggle Theme"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={onLogout} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {activeTab === 'live' ? (
        <>
          {/* HOC SESSION CREATION */}
          {user.role === 'HOC' && !sixDigitCode && (
            <section className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-8 rounded-3xl shadow-2xl text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black flex items-center gap-3">
                    <Power className="w-8 h-8 text-indigo-300 animate-pulse" /> Launch Attendance
                  </h2>
                  <p className="text-indigo-100/70 text-sm font-medium">Open a digital gateway for students to sign-in securely</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input 
                      value={courseCode}
                      onChange={e => setCourseCode(e.target.value)}
                      placeholder="Course (e.g. EEC 201)"
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:bg-white/20 outline-none transition-all"
                    />
                  </div>
                  <button 
                    onClick={startSession} 
                    disabled={loading} 
                    className="px-10 py-3.5 bg-white text-indigo-800 rounded-2xl font-black hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> : 'Go Live'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* HOC PIN DISPLAY */}
          {user.role === 'HOC' && sixDigitCode && (
             <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl border-2 border-indigo-500 shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/10">
                  <div className="h-full bg-indigo-500 animate-[loading_2s_linear_infinite]" style={{ width: '40%' }}></div>
                </div>
                <div className="flex flex-col items-center justify-center space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.4em]">Active Portal PIN</h2>
                    <div className="text-8xl font-black tracking-widest text-gray-900 dark:text-white font-mono drop-shadow-lg">
                      {sixDigitCode}
                    </div>
                  </div>
                  <div className="p-6 bg-white rounded-3xl border-[8px] border-gray-50 shadow-inner group transition-all">
                    <QRCodeCanvas value={`${window.location.origin}/join/${sixDigitCode}`} size={240} className="group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-4">
                    <button onClick={() => setSixDigitCode('')} className="px-6 py-3 bg-gray-100 dark:bg-slate-700 rounded-2xl text-xs font-black text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all">
                      Hide Screen
                    </button>
                    <button onClick={shareSessionDetails} className="px-6 py-3 bg-indigo-600 rounded-2xl text-xs font-black text-white shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center gap-2">
                      <Share className="w-4 h-4" /> Share PIN/QR
                    </button>
                    <button onClick={downloadPDF} className="px-6 py-3 bg-indigo-50 dark:bg-slate-700 rounded-2xl text-xs font-black text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-600 transition-all flex items-center gap-2">
                      <Download className="w-4 h-4" /> Export Registry
                    </button>
                    <button onClick={endSessionManually} className="px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl text-xs font-black hover:bg-red-200 dark:hover:bg-red-900/50 transition-all flex items-center gap-2">
                      <PowerOff className="w-4 h-4" /> End Session
                    </button>
                  </div>
                </div>
             </section>
          )}

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-black flex items-center gap-2 text-gray-900 dark:text-white">
                  <Clock className="w-5 h-5 text-indigo-500" /> 
                  {user.role === 'HOC' ? 'Session History' : 'Available Attendance Gates'}
                </h3>
                {user.role === 'HOC' && sessions.length > 0 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={downloadHistory}
                      className="px-3 py-1.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV Logs
                    </button>
                    <button 
                      onClick={shareHistorySummary}
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-100 transition-all flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share History
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sessions.map(session => (
                  <div 
                    key={session.id} 
                    className={`card p-6 rounded-3xl border-2 transition-all relative group ${
                      selectedSessionId === session.id || studentPin === session.unique_code ? 'border-indigo-500 shadow-xl ring-4 ring-indigo-500/5' : 'border-transparent shadow-sm'
                    }`}
                  >
                    {user.role === 'HOC' && (
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleSessionStatus(session.id, !!session.is_active); }}
                          className={`p-2 rounded-xl transition-all ${session.is_active ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-gray-400 bg-gray-50 dark:bg-slate-700'}`}
                          title={session.is_active ? 'Close Portal' : 'Reopen Portal'}
                        >
                          {session.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                          className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full uppercase tracking-tighter ring-1 ring-indigo-100 dark:ring-indigo-800">
                            {session.course_code}
                          </span>
                          {!session.is_active && (
                            <span className="text-[9px] font-black text-red-500 bg-red-50 dark:bg-red-900/40 px-3 py-1 rounded-full uppercase tracking-tighter ring-1 ring-red-100 dark:ring-red-800">
                              CLOSED
                            </span>
                          )}
                        </div>
                        <h4 className="text-xl font-black mt-3 text-gray-800 dark:text-gray-100 leading-none">{session.course_code}</h4>
                        <div className="flex items-center gap-2 mt-2">
                           <Calendar className="w-3.5 h-3.5 text-gray-400" />
                           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(session.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    {user.role === 'HOC' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-700">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">GATE PIN</span>
                          <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-widest">{session.unique_code}</span>
                        </div>
                        <button 
                          onClick={() => { setSelectedSessionId(session.id); setSixDigitCode(session.unique_code); fetchAttendance(session.id); }} 
                          className={`w-full py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all ${
                            selectedSessionId === session.id 
                            ? 'bg-indigo-600 text-white shadow-lg' 
                            : 'bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100'
                          }`}
                        >
                          <Eye className="w-4 h-4" /> View Sign-ins
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            maxLength={6}
                            disabled={!session.is_active}
                            placeholder="6-DIGIT PIN"
                            className="flex-1 px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-2xl text-center font-black text-xl tracking-[0.2em] outline-none bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 transition-all placeholder:text-[10px] placeholder:tracking-normal placeholder:font-bold"
                            value={studentPin && session.unique_code === studentPin ? studentPin : ''}
                            onChange={e => {
                                setSelectedSessionId(session.id);
                                setStudentPin(e.target.value);
                            }}
                          />
                          <button 
                            onClick={() => handleMarkAttendance(session)} 
                            disabled={!session.is_active || loading}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 transition-all flex items-center gap-2"
                          >
                            <ShieldCheck className="w-4 h-4" /> Sign
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {sessions.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-gray-50/50 dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-black uppercase tracking-widest text-[10px] text-gray-400">No active ports for {user.department}</p>
                  </div>
                )}
              </div>
            </div>

            {/* LIVE FEED SIDEBAR */}
            <aside className="lg:col-span-4 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black flex items-center gap-2 text-gray-900 dark:text-white">
                  <ClipboardCheck className="w-5 h-5 text-indigo-500" /> Sign-in Feed
                </h3>
              </div>
              
              <div className="card rounded-3xl shadow-sm overflow-hidden min-h-[550px] flex flex-col border border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md">
                {attendanceRecords.length > 0 ? (
                  <div className="divide-y divide-gray-50 dark:divide-slate-800 flex-1 overflow-y-auto max-h-[600px] scrollbar-hide">
                    {attendanceRecords.map((record) => (
                      <div key={record.id} className="p-4 hover:bg-white dark:hover:bg-slate-700/50 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded-2xl flex items-center justify-center font-black text-sm border border-indigo-100 dark:border-slate-600 group-hover:scale-105 transition-transform">
                            {record.profiles?.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{record.profiles?.full_name}</p>
                            <p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.1em]">{record.profiles?.matric_no}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                             <CheckCircle2 className="w-4 h-4 text-green-500" />
                             {user.role === 'HOC' && (
                               <button 
                                 onClick={() => removeStudentRecord(record.id)}
                                 className="text-[8px] font-black text-red-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                               >
                                 Void
                               </button>
                             )}
                          </div>
                        </div>
                        {user.role === 'HOC' && (
                          <div className="mt-3 px-3 py-2 bg-gray-50 dark:bg-slate-900/30 rounded-xl flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8px] text-gray-400 font-bold uppercase tracking-[0.2em]">Verified Sig</span>
                            <img 
                              src={record.profiles?.signature} 
                              alt="sig" 
                              className={`h-4 w-12 object-contain grayscale hover:grayscale-0 ${isDark ? 'invert brightness-150' : ''}`} 
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30">
                    <Users className="w-12 h-12 mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest leading-loose">
                      Select a session<br/>to watch sign-ins
                    </p>
                  </div>
                )}
                
                {attendanceRecords.length > 0 && (
                  <div className="p-5 bg-indigo-600 dark:bg-indigo-900 text-white shadow-2xl">
                    <div className="flex justify-between items-center">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">Total Count</p>
                        <p className="text-2xl font-black">{attendanceRecords.length} Students</p>
                      </div>
                      <button onClick={downloadPDF} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      ) : activeTab === 'directory' ? (
        <section className="card p-8 rounded-3xl shadow-sm space-y-8 animate-in slide-in-from-bottom-2 duration-400">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 dark:border-slate-800 pb-8">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Department Registry</h2>
              <p className="text-sm text-gray-400 mt-1">Authorized students for {user.department}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Filter by name or matric..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-full sm:w-64"
                />
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-center justify-center">
                 <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{filteredStudents.length} Students</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 border-b border-gray-100 dark:border-slate-800">
                  <th className="px-6 py-6">Student Identity</th>
                  <th className="px-6 py-6">Identity Code</th>
                  <th className="px-6 py-6 text-center">Level Status</th>
                  <th className="px-6 py-6 text-right">Signature Credential</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-all group">
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-indigo-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center font-black text-indigo-500 shrink-0 border border-indigo-100 dark:border-slate-600 group-hover:scale-105 transition-transform">
                          {student.full_name.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{student.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium font-mono bg-gray-50 dark:bg-slate-900 px-2 py-1 rounded-lg">{student.matric_no}</span>
                        <button onClick={() => navigator.clipboard.writeText(student.matric_no)} className="p-1.5 text-gray-300 hover:text-indigo-500 transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full ring-1 ring-indigo-100 dark:ring-indigo-800">
                        {student.level} LEVEL
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="w-24 h-10 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-1 flex items-center justify-center shadow-sm">
                          <img 
                            src={student.signature} 
                            alt="sig" 
                            className={`max-h-full max-w-full object-contain grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all ${isDark ? 'invert' : ''}`} 
                          />
                        </div>
                        <div className="p-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500">
                           <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card p-8 rounded-3xl shadow-sm space-y-8 animate-in slide-in-from-bottom-2 duration-400">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Attendance History</h2>
            <p className="text-sm text-gray-400 mt-1">A timeline of your validated classroom presences</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myAttendanceHistory.map((item) => (
              <div key={item.id} className="p-6 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 group-hover:border-indigo-100 transition-colors">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-lg uppercase tracking-[0.2em] ring-1 ring-green-100 dark:ring-green-800">Verified</span>
                  </div>
                </div>
                <h4 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{item.active_sessions?.course_code}</h4>
                <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(item.signed_at).toLocaleDateString()}</span>
                  <span className="mx-1">•</span>
                  <span>{new Date(item.signed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
