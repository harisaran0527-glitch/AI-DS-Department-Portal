import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';
import type { Role } from '../../types';

interface CinematicBookLoginProps {
  portalRole?: Role;
  roleSubtitle?: string;
  placeholderIdentifier?: string;
  destinationRoute?: string;
}

export const CinematicBookLogin: React.FC<CinematicBookLoginProps> = ({
  portalRole = 'ADMIN',
  roleSubtitle = 'ADMIN PORTAL',
  placeholderIdentifier = 'Enter your email or ID',
  destinationRoute = '/admin/dashboard'
}) => {
  const navigate = useNavigate();

  // Animation Timeline Phase: 
  // 1: Closed Book
  // 2: Top Cover Lifts & Moves Forward
  // 3: Pages Flip / Turn
  // 4: Final Page Revealed & Login Form Active
  const [animPhase, setAnimPhase] = useState<number>(1);

  // Form Controlled States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Auth Status
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'closing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  // Pre-fill remembered email
  useEffect(() => {
    const saved = localStorage.getItem(`remembered_email_${portalRole.toLowerCase()}`);
    if (saved) {
      setIdentifier(saved);
      setRememberMe(true);
    }
  }, [portalRole]);

  // Execute 3D Book Opening Timeline
  useEffect(() => {
    const t1 = setTimeout(() => setAnimPhase(2), 300);  // 0.3s: Top Cover opens forward
    const t2 = setTimeout(() => setAnimPhase(3), 900);  // 0.9s: Pages start flipping
    const t3 = setTimeout(() => setAnimPhase(4), 2100); // 2.1s: Pages settle and Login Page is revealed

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus === 'loading' || authStatus === 'closing') return;

    setErrorMessage('');
    setAuthStatus('loading');

    if (rememberMe) {
      localStorage.setItem(`remembered_email_${portalRole.toLowerCase()}`, identifier);
    } else {
      localStorage.removeItem(`remembered_email_${portalRole.toLowerCase()}`);
    }

    try {
      const res = await API.login(identifier, password, portalRole);

      if (res && res.user) {
        setAuthenticatedName(res.user.name);
        setAuthStatus('success');

        // Post-Login Book Reveal Transition (1.2s)
        setTimeout(() => {
          setAuthStatus('closing');
        }, 1000);

        setTimeout(() => {
          navigate(destinationRoute);
        }, 2200);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid credentials. Please verify your identifier and password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#3641C9] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* 4K Portal Ambient Background with Soft Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(63,75,218,0.4),rgba(27,32,95,0.95)_75%)] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.15),transparent_60%)] pointer-events-none z-0" />

      {/* CENTERED 3D BOOK CONTAINER WITH PERSPECTIVE */}
      <div className="relative w-full max-w-[700px] h-[560px] flex items-center justify-center [perspective:1400px]">

        {/* 3D BOOK COMPOSITION */}
        <motion.div 
          initial={{ rotateX: 15, rotateY: -10, scale: 0.9, opacity: 0 }}
          animate={{ 
            rotateX: animPhase >= 4 ? 0 : 12, 
            rotateY: animPhase >= 4 ? 0 : -8, 
            scale: 1, 
            opacity: 1 
          }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative w-[620px] h-[480px] bg-[#1B205F] border-2 border-white/14 rounded-2xl shadow-2xl flex items-center justify-between p-3 sm:p-4 [transform-style:preserve-3d]"
        >
          {/* Central Book Spine */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-8 bg-slate-950 border-x border-slate-800 shadow-2xl z-30 flex items-center justify-center">
            <div className="w-1 h-full bg-cyan-500/30" />
            {/* Bookmark Ribbon */}
            <div className="absolute bottom-0 w-3 h-10 bg-sky-600 rounded-b shadow-md" />
          </div>

          {/* LEFT PAGE STACK (OPEN BOOK) */}
          <div className="w-[48%] h-full bg-[#0a1120] border border-cyan-900/50 rounded-l-xl p-4 shadow-inner relative flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-3 border border-cyan-500/20 rounded-lg p-3 text-[9px] font-mono text-cyan-300/70 leading-relaxed overflow-hidden">
              <div className="font-extrabold text-center border-b border-cyan-500/30 mb-2 pb-1 text-cyan-200 tracking-widest">
                AVSEC SALEM AI & DS
              </div>
              <p className="mb-2">DEPARTMENT OF ARTIFICIAL INTELLIGENCE & DATA SCIENCE.</p>
              <p className="mb-2">OFFICIAL ACADEMIC & PERFORMANCE RECOGNITION SYSTEM.</p>
              <div className="mt-4 pt-2 border-t border-cyan-500/20 text-[8px] text-cyan-400/50">
                SECURITY LEVEL: AUTHORIZED ACCESS ONLY.
              </div>
            </div>
          </div>

          {/* RIGHT PAGE STACK / REVEALED LOGIN FORM PAGE */}
          <div className="w-[48%] h-full bg-[#0a1120] border border-cyan-900/50 rounded-r-xl p-4 shadow-inner relative flex flex-col items-center justify-center overflow-hidden">
            
            {/* Background Holographic Grid Accent */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#082f4915_1px,transparent_1px),linear-gradient(to_bottom,#082f4915_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />

            {/* PHASE 4: REVEALED LOGIN FORM PRINTED ON THE OPEN BOOK PAGE */}
            {animPhase >= 4 && authStatus !== 'closing' && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full flex flex-col items-center space-y-3 relative z-20"
              >
                {/* SUCCESS REVEAL DISPLAY */}
                {authStatus === 'success' ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="py-6 flex flex-col items-center space-y-2 text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                      <CheckCircle2 className="w-7 h-7 animate-bounce" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-extrabold">AUTHENTICATION SUCCESSFUL</span>
                      <h3 className="text-sm font-extrabold text-white mt-1">Welcome, {authenticatedName}</h3>
                      <p className="text-[10px] text-cyan-300/90 font-mono mt-1 animate-pulse">
                        Opening {roleSubtitle} Dashboard...
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  /* THE REQUIRED LOGIN FORM PRINTED ON THE FINAL OPEN PAGE */
                  <form onSubmit={handleLoginSubmit} className="w-full flex flex-col space-y-2.5">
                    
                    {/* AVSEC SALEM & ROLE TITLE HEADER */}
                    <div className="flex flex-col items-center justify-center text-center space-y-1 mb-0.5">
                      <img 
                        src="/images/avsec-salem-logo.png" 
                        alt="AVSEC Salem Official Logo" 
                        className="h-9 sm:h-10 w-auto object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]" 
                      />
                      <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/50">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                        <span className="text-[9px] font-mono text-cyan-200 tracking-widest uppercase font-extrabold drop-shadow-[0_0_6px_#06b6d4]">
                          AVSEC SALEM — {roleSubtitle}
                        </span>
                      </div>
                    </div>

                    {/* Error Alert */}
                    {errorMessage && (
                      <div className="w-full text-[9px] text-red-200 bg-red-950/90 border border-red-500/80 px-2 py-1 rounded-lg flex items-center space-x-1 text-left shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-in fade-in duration-200">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                        <span className="leading-tight">{errorMessage}</span>
                      </div>
                    )}

                    {/* 1. Gmail / Email Field */}
                    <div className="w-full space-y-0.5 text-left">
                      <label className="text-[10px] font-semibold text-slate-300 ml-0.5">
                        Gmail / Email
                      </label>
                      <div className="relative group">
                        <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                        <input
                          type="text"
                          required
                          placeholder={placeholderIdentifier}
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          className="w-full bg-slate-950/90 border border-cyan-500/50 rounded-lg py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all"
                        />
                      </div>
                    </div>

                    {/* 2. Password Field & Visibility Toggle */}
                    <div className="w-full space-y-0.5 text-left">
                      <label className="text-[10px] font-semibold text-slate-300 ml-0.5">
                        Password
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-950/90 border border-cyan-500/50 rounded-lg py-2 pl-9 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all"
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-cyan-400 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* 3. Remember Me & Forgot Password */}
                    <div className="w-full flex items-center justify-between text-xs pt-0.5">
                      <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-3.5 h-3.5 rounded bg-slate-950 border-cyan-500/60 text-cyan-500 focus:ring-cyan-400 focus:ring-offset-slate-950 cursor-pointer"
                        />
                        <span className="text-[10px] font-medium text-slate-300">Remember Me</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsForgotPasswordOpen(true)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-200 transition-colors font-mono cursor-pointer underline-offset-2 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    {/* 4. LOGIN Submit Button */}
                    <button
                      type="submit"
                      disabled={authStatus === 'loading'}
                      className="btn-action w-full mt-1 py-2 bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold rounded-lg text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-transform duration-200 transform-gpu hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-75 disabled:cursor-not-allowed motion-reduce:transform-none cursor-pointer flex items-center justify-center space-x-2"
                    >
                      {authStatus === 'loading' ? (
                        <span className="flex items-center space-x-2">
                          <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>AUTHENTICATING...</span>
                        </span>
                      ) : (
                        <span>LOGIN</span>
                      )}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </div>

          {/* SEQUENTIAL 3D FLIPPING PAGES (Phases 2 & 3) */}
          <AnimatePresence>
            {/* Top Cover Opening (Phase 2) */}
            {animPhase === 2 && (
              <motion.div
                initial={{ rotateY: 0 }}
                animate={{ rotateY: -160 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="absolute inset-y-2 left-1/2 right-2 bg-slate-900 border-2 border-cyan-700/80 rounded-r-xl shadow-2xl origin-left z-40 flex flex-col items-center justify-center p-4 text-center"
              >
                <img src="/images/avsec-salem-logo.png" alt="AVSEC Salem Logo" className="h-12 w-auto mb-2 opacity-80" />
                <span className="text-xs font-mono text-cyan-300 tracking-widest uppercase font-bold">AVSEC SALEM</span>
              </motion.div>
            )}

            {/* Fanning Paper Pages Turning (Phase 3) */}
            {animPhase === 3 && (
              <>
                <motion.div
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: -170 }}
                  transition={{ duration: 0.7, delay: 0, ease: 'easeInOut' }}
                  className="absolute inset-y-3 left-1/2 right-3 bg-[#dedede] border-r border-slate-400 rounded-r shadow-lg origin-left z-35"
                />
                <motion.div
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: -170 }}
                  transition={{ duration: 0.7, delay: 0.2, ease: 'easeInOut' }}
                  className="absolute inset-y-3 left-1/2 right-3 bg-[#e8e8e8] border-r border-slate-400 rounded-r shadow-lg origin-left z-34"
                />
                <motion.div
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: -170 }}
                  transition={{ duration: 0.7, delay: 0.4, ease: 'easeInOut' }}
                  className="absolute inset-y-3 left-1/2 right-3 bg-[#f2f2f2] border-r border-slate-400 rounded-r shadow-lg origin-left z-33"
                />
              </>
            )}
          </AnimatePresence>

        </motion.div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        portalRole={portalRole}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};
