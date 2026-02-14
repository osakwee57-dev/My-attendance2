
import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../supabaseClient';
import { UserRole, Profile } from '../types';
import { User, Lock, Fingerprint, GraduationCap, Briefcase, Key, Building2 } from 'lucide-react';

interface AuthProps {
  onLogin: (user: Profile) => void;
}

const DEPARTMENTS = [
  "Electrical Electronics Engineering",
  "Computer Engineering",
  "Agric Engineering",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Civil Engineering"
];

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const sigPad = useRef<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    matric: '',
    level: '100',
    dept: 'Electrical Electronics Engineering', // Default as requested
    password: '',
    isHOC: false,
    secret: ''
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. HOC Security Check
    if (formData.isHOC && formData.secret !== 'ACCES-GRANTED') {
      return alert("Invalid HOC Secret Code!");
    }

    // 2. Signature Check
    if (!sigPad.current || sigPad.current.isEmpty()) {
      return alert("Please provide a signature.");
    }

    setLoading(true);
    const sigData = sigPad.current.getTrimmedCanvas().toDataURL('image/png');

    try {
      // 3. Database Insertion
      const { data, error } = await supabase.from('profiles').insert([{
        full_name: formData.name,
        matric_no: formData.matric,
        level: formData.level,
        department: formData.dept,
        password: formData.password,
        role: (formData.isHOC ? 'HOC' : 'student') as UserRole,
        signature: sigData
      }]).select().single();

      if (error) throw error;
      
      alert("Registration Successful! Please Login.");
      setIsLogin(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('matric_no', formData.matric)
        .eq('password', formData.password)
        .single();

      if (error || !data) throw new Error("Login Failed!");
      onLogin(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">{isLogin ? 'Login' : 'Register'}</h2>
        <p className="text-gray-500 mt-2">{isLogin ? 'Log in to track your attendance' : 'Join your department platform'}</p>
      </div>

      <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
        {!isLogin && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              placeholder="Full Name" 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              onChange={e => setFormData({...formData, name: e.target.value})} 
              required 
            />
          </div>
        )}

        <div className="relative">
          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            placeholder="Matriculation Number" 
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            onChange={e => setFormData({...formData, matric: e.target.value})} 
            required 
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            onChange={e => setFormData({...formData, password: e.target.value})} 
            required 
          />
        </div>

        {!isLogin && (
          <>
            <div className="space-y-4">
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                  onChange={e => setFormData({...formData, level: e.target.value})}
                  value={formData.level}
                >
                  {['100','200','300','400','500'].map(l => <option key={l} value={l}>{l} Level</option>)}
                </select>
              </div>

              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                  onChange={e => setFormData({...formData, dept: e.target.value})}
                  value={formData.dept}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-center p-3 border border-gray-200 rounded-xl bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-indigo-600 rounded"
                  onChange={e => setFormData({...formData, isHOC: e.target.checked})} 
                /> 
                <span className="text-sm font-medium text-gray-600">Register as HOC?</span>
              </label>
            </div>

            {formData.isHOC && (
              <div className="relative animate-in slide-in-from-top duration-300">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input 
                  placeholder="HOC Secret Code" 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-amber-200 bg-amber-50 focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-amber-400"
                  onChange={e => setFormData({...formData, secret: e.target.value})} 
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Fingerprint className="w-4 h-4" /> Digital Signature
              </div>
              <div className="signature-pad bg-white">
                <SignatureCanvas 
                  ref={sigPad} 
                  canvasProps={{ width: 384, height: 120, className: 'sigCanvas' }} 
                />
              </div>
              <button 
                type="button"
                onClick={() => sigPad.current?.clear()}
                className="text-xs text-gray-500 hover:text-indigo-600 font-medium underline"
              >
                Clear Signature
              </button>
            </div>
          </>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            isLogin ? 'Login' : 'Complete Registration'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-gray-500 hover:text-indigo-600 font-medium"
        >
          {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
};
