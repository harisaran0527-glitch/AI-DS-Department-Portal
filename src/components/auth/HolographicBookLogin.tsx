import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';
import type { Role } from '../../types';

interface HolographicBookLoginProps {
  portalRole?: Role;
  roleSubtitle?: string;
  placeholderIdentifier?: string;
  destinationRoute?: string;
}

export const HolographicBookLogin: React.FC<HolographicBookLoginProps> = ({
  portalRole = 'STUDENT',
  roleSubtitle = 'STUDENT PORTAL',
  placeholderIdentifier = 'Register Number / Email',
  destinationRoute = '/student/dashboard'
}) => {
  const navigate = useNavigate();

  // Animation timeline phase (1 to 13)
  const [animPhase, setAnimPhase] = useState<number>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'closing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  // Step-by-step keyframe triggers for the Suitcase + Book environment
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setAnimPhase(2), 300));  // Book shell opens
    timers.push(setTimeout(() => setAnimPhase(3), 800));  // Pages flip across
    timers.push(setTimeout(() => setAnimPhase(4), 1400)); // Page stack splay
    timers.push(setTimeout(() => setAnimPhase(5), 1800)); // Vertical cyan light beam shines upward
    timers.push(setTimeout(() => setAnimPhase(6), 2200)); // Front Login Card emerges cleanly

    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus === 'loading' || authStatus === 'closing') return;

    setErrorMessage('');
    setAuthStatus('loading');

    try {
      const res = await API.login(identifier, password, portalRole);

      if (res && res.user) {
        setAuthenticatedName(res.user.name);
        setAuthStatus('success');

        // Cinematic Retraction & Dashboard Reveal Transition
        setTimeout(() => {
          setAuthStatus('closing');
        }, 1000);

        setTimeout(() => {
          navigate(destinationRoute);
        }, 2200);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid credentials. Please verify your identifier and portal password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#020510] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* 4K Dark Navy Ambient Background with Soft Cyan Radial Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.22),rgba(2,5,16,0.98)_75%)] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(14,165,233,0.15),transparent_60%)] pointer-events-none z-0" />

      {/* Main Centered 3D Composition Container */}
      <div className="relative w-full max-w-[540px] min-h-[580px] flex flex-col items-center justify-center z-10">

        {/* FOREGROUND FRONT REAL LOGIN CARD (z-40) */}
        <AnimatePresence>
          {animPhase >= 6 && authStatus !== 'closing' && (
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{
                y: authStatus === 'success' ? 0 : -20,
                opacity: 1,
                scale: authStatus === 'success' ? 1.02 : 1
              }}
              exit={{ y: 90, opacity: 0, scale: 0.5, filter: 'blur(10px)' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className={`relative z-40 w-full max-w-[360px] bg-slate-950/85 border-2 border-cyan-400/80 rounded-2xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.45)] backdrop-blur-xl flex flex-col items-center justify-center text-center ${
                authStatus === 'error' ? 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : ''
              }`}
            >
              {/* Top Ornate Filigree Crest */}
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <svg className="w-10 h-6 text-cyan-400 drop-shadow-[0_0_10px_#06b6d4]" viewBox="0 0 40 24" fill="currentColor">
                  <path d="M20 0C22 6 26 10 32 10C26 10 22 14 20 20C18 14 14 10 8 10C14 10 18 6 20 0Z" />
                </svg>
              </div>

              {/* SUCCESS REVEAL DISPLAY */}
              {authStatus === 'success' ? (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="py-4 flex flex-col items-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                    <CheckCircle2 className="w-8 h-8 animate-bounce" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-extrabold">AUTHENTICATION SUCCESSFUL</span>
                    <h3 className="text-base font-extrabold text-white mt-1">Welcome, {authenticatedName}</h3>
                    <p className="text-[10px] text-cyan-300/80 font-mono mt-1 animate-pulse">
                      Revealing Live {roleSubtitle} Dashboard...
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* REAL INTERACTIVE FRONT LOGIN FORM */
                <form onSubmit={handleLoginSubmit} className="w-full flex flex-col items-center space-y-3 relative z-50 mt-1">
                  
                  {/* AVSEC Salem Brand Logo & Role Title */}
                  <div className="flex flex-col items-center justify-center text-center space-y-1 mb-1">
                    <img 
                      src="/images/avsec-salem-logo.png" 
                      alt="AVSEC Salem Official Logo" 
                      className="h-11 sm:h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]" 
                    />
                    <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                      <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                      <span className="text-[10px] font-mono text-cyan-200 tracking-widest uppercase font-extrabold drop-shadow-[0_0_6px_#06b6d4]">
                        AVSEC SALEM — {roleSubtitle}
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

                  {/* Email / Identifier Input Field */}
                  <div className="w-full relative group">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                    <input
                      type="text"
                      required
                      placeholder={placeholderIdentifier}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-slate-900/90 border border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
                    />
                  </div>

                  {/* Password Input Field */}
                  <div className="w-full relative group">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Portal Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900/90 border border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-cyan-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* LOGIN Button */}
                  <button
                    type="submit"
                    disabled={authStatus === 'loading'}
                    className="w-full mt-1 py-2.5 bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold rounded-xl text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2"
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

                  {/* Forgot Password Link */}
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-[10px] text-cyan-300/80 hover:text-cyan-200 transition-colors font-mono cursor-pointer underline-offset-2 hover:underline pt-1"
                  >
                    Forgot Password?
                  </button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* BACKGROUND 3D SUITCASE / ANCIENT LEATHER BOOK ENVIRONMENT (z-20) */}
        <div className="relative w-[440px] h-[250px] mt-12 transform-style-3d z-20">
          
          {/* Vertical Cyan Light Beam emanating from open spine up to the login card */}
          {animPhase >= 5 && authStatus !== 'closing' && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-10 w-2 h-[220px] bg-cyan-300 shadow-[0_0_30px_#06b6d4] z-30 pointer-events-none animate-pulse flex flex-col items-center">
              <div className="w-28 h-full bg-gradient-to-t from-cyan-400/60 via-cyan-500/25 to-transparent blur-md" />
            </div>
          )}

          {/* OPEN ANCIENT LEATHER BOOK / SUITCASE SHELL */}
          <div className="relative w-full h-full bg-[#0a1224] border-2 border-cyan-800/60 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.25)] overflow-hidden p-3 flex items-center justify-between">
            
            {/* Dark Blue Ribbon Bookmark */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-8 bg-sky-700 border-x border-sky-600 rounded-b shadow-md z-30" />

            {/* OPEN BOOK PAGE STACKS WITH ENGRAVED ACADEMIC DATA MATRIX ARTWORK */}
            {animPhase >= 2 ? (
              <div className="w-full h-full flex justify-between gap-1 relative z-10">
                {/* Left Page Stack */}
                <div className="w-1/2 h-full bg-[#e8eaed] rounded-l-md border-r-2 border-slate-400 p-3 shadow-inner relative flex flex-col justify-between overflow-hidden">
                  <div className="absolute inset-2 border border-slate-400/40 rounded p-2 text-[8px] font-serif text-slate-600 opacity-60 leading-relaxed overflow-hidden">
                    <div className="font-bold text-center border-b border-slate-400 mb-1 pb-0.5">ACADEMIC MATRIX</div>
                    AVSEC SALEM AI & DS DEPARTMENT PORTAL. AUTHENTICATED ACCESS RECORD.
                  </div>
                </div>

                {/* Right Page Stack */}
                <div className="w-1/2 h-full bg-[#e8eaed] rounded-r-md border-l-2 border-slate-400 p-3 shadow-inner relative flex flex-col justify-between overflow-hidden">
                  <div className="absolute inset-2 border border-slate-400/40 rounded p-2 text-[8px] font-serif text-slate-600 opacity-60 leading-relaxed overflow-hidden">
                    <div className="font-bold text-center border-b border-slate-400 mb-1 pb-0.5">SECURITY PROTOCOL</div>
                    ROLE-BASED AUTHORIZATION SYSTEM. SECURE JWT ENTERPRISE TERMINAL.
                  </div>
                </div>
              </div>
            ) : (
              /* CLOSED BOOK STATE (Phase 1) */
              <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center">
                <div className="w-6 h-full bg-slate-950 border-r border-slate-800" />
                <span className="text-xs font-serif text-slate-400 font-bold ml-4">AVSEC SALEM — AI & DS</span>
              </div>
            )}

            {/* WIND-DRIVEN PAPER PAGE FLIP ANIMATION (Phase 3) */}
            {animPhase === 3 && (
              <motion.div
                animate={{ rotateY: [0, -180, 0] }}
                transition={{ duration: 1.2, repeat: 1, ease: 'easeInOut' }}
                className="absolute top-3 bottom-3 left-1/2 w-1/2 bg-[#dedede] border-r border-slate-400 rounded-r shadow-xl origin-left z-20"
              />
            )}
          </div>
        </div>

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
