import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';

export const SimpleAdminLogin: React.FC = () => {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  // Load remembered admin email on mount
  useEffect(() => {
    const saved = localStorage.getItem('remembered_email_admin');
    if (saved) {
      setIdentifier(saved);
      setRememberMe(true);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus === 'loading') return;

    setErrorMessage('');
    setAuthStatus('loading');

    if (rememberMe) {
      localStorage.setItem('remembered_email_admin', identifier);
    } else {
      localStorage.removeItem('remembered_email_admin');
    }

    try {
      const res = await API.login(identifier, password, 'ADMIN');

      if (res && res.user) {
        setAuthenticatedName(res.user.name);
        setAuthStatus('success');

        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 1000);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid admin credentials. Please verify your email/ID and password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#3641C9] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* 4K Minimal Radial Portal Glow (z-0) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(63,75,218,0.4),rgba(27,32,95,0.95)_80%)] pointer-events-none z-0" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-cyan-400/15 blur-[130px] rounded-full pointer-events-none z-0" />

      {/* CLEAN SIMPLE PREMIUM ADMIN LOGIN CARD (z-10) */}
      <div className="relative z-10 w-full max-w-[400px]">
        
        {authStatus === 'success' ? (
          /* Admin Access Granted Display */
          <div className="w-full bg-[#1B205F]/95 border-2 border-emerald-400 rounded-2xl p-6 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in zoom-in duration-300">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-extrabold">ADMINISTRATOR AUTHORIZED</span>
              <h3 className="text-base font-extrabold text-white mt-1">Welcome, {authenticatedName}</h3>
              <p className="text-[11px] text-cyan-300 font-mono mt-1 animate-pulse">
                Opening Admin Dashboard...
              </p>
            </div>
          </div>
        ) : (
          /* THE CLEAN MINIMAL ADMIN LOGIN FORM */
          <form 
            onSubmit={handleLoginSubmit} 
            className="w-full bg-[#1B205F]/95 border border-white/14 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl flex flex-col space-y-4"
          >
            
            {/* Header Branding */}
            <div className="flex flex-col items-center justify-center text-center space-y-1 mb-2">
              <img 
                src="/images/avsec-salem-logo.png" 
                alt="AVSEC Salem Official Logo" 
                className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.5)] mb-1" 
              />
              <span className="text-xs font-mono font-extrabold text-slate-300 tracking-wider">
                AI & DATA SCIENCE
              </span>
              <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.25)] mt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono text-cyan-200 tracking-widest uppercase font-extrabold drop-shadow-[0_0_6px_#06b6d4]">
                  AVSEC SALEM — ADMIN PORTAL
                </span>
              </div>
            </div>

            {/* Error Notification Alert */}
            {errorMessage && (
              <div className="w-full text-[10px] text-red-200 bg-red-950/90 border border-red-500/80 px-3 py-2 rounded-xl flex items-center space-x-2 text-left shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span className="leading-tight">{errorMessage}</span>
              </div>
            )}

            {/* 1. Email / College Gmail Input Field */}
            <div className="w-full space-y-1 text-left">
              <label className="text-[11px] font-semibold text-slate-300 ml-0.5">
                Email / College Gmail
              </label>
              <div className="relative group">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                <input
                  type="text"
                  required
                  placeholder="Enter admin email or ID"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-slate-900/90 border border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
                />
              </div>
            </div>

            {/* 2. Password Field & Visibility Toggle */}
            <div className="w-full space-y-1 text-left">
              <label className="text-[11px] font-semibold text-slate-300 ml-0.5">
                Portal Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/90 border border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-cyan-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 3. Remember Me Checkbox & Forgot Password Link */}
            <div className="w-full flex items-center justify-between text-xs pt-1">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-cyan-500/60 text-cyan-500 focus:ring-cyan-400 focus:ring-offset-slate-950 cursor-pointer"
                />
                <span className="text-[11px] font-medium text-slate-300">Remember Me</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-200 transition-colors font-mono cursor-pointer underline-offset-2 hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            {/* 4. LOGIN Submit Button */}
            <button
              type="submit"
              disabled={authStatus === 'loading'}
              className="btn-action w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold rounded-xl text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-transform duration-200 transform-gpu hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-75 disabled:cursor-not-allowed motion-reduce:transform-none cursor-pointer flex items-center justify-center space-x-2"
            >
              {authStatus === 'loading' ? (
                <span className="flex items-center space-x-2">
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>AUTHENTICATING...</span>
                </span>
              ) : (
                <span>LOGIN</span>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        portalRole="ADMIN"
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};
