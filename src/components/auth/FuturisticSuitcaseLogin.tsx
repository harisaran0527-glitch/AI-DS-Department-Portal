import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, LockKeyhole, LockKeyholeOpen, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';
import type { Role } from '../../types';

interface FuturisticSuitcaseLoginProps {
  portalRole?: Role;
  roleSubtitle?: string;
  placeholderIdentifier?: string;
  destinationRoute?: string;
}

export const FuturisticSuitcaseLogin: React.FC<FuturisticSuitcaseLoginProps> = ({
  portalRole = 'ADMIN',
  roleSubtitle = 'ADMIN PORTAL',
  placeholderIdentifier = 'Enter your email or ID',
  destinationRoute = '/admin/dashboard'
}) => {
  const navigate = useNavigate();

  // Animation timeline phase (1: Locked, 2: Latches Releasing, 3: Lid Opening, 4: Login Form Revealed)
  const [suitcasePhase, setSuitcasePhase] = useState<'locked' | 'unlocking' | 'opening' | 'open'>('locked');

  // Input states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Auth Status
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'closing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(`remembered_email_${portalRole.toLowerCase()}`);
    if (savedEmail) {
      setIdentifier(savedEmail);
      setRememberMe(true);
    }
  }, [portalRole]);

  // Execute Suitcase Unlock & Opening Animation Sequence on Mount
  useEffect(() => {
    const t1 = setTimeout(() => setSuitcasePhase('unlocking'), 400); // 0.4s: Mechanical latches release
    const t2 = setTimeout(() => setSuitcasePhase('opening'), 900);   // 0.9s: Lid rotates open
    const t3 = setTimeout(() => setSuitcasePhase('open'), 1500);     // 1.5s: Login interface fully revealed

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

    // Save or clear Remember Me
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

        // Close Suitcase before dashboard navigation
        setTimeout(() => {
          setAuthStatus('closing');
          setSuitcasePhase('opening');
        }, 1000);

        setTimeout(() => {
          navigate(destinationRoute);
        }, 1900);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid credentials. Please verify your email/ID and password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* 4K Dark Navy Ambient Background with Soft Cyan Lighting (z-0) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.18),rgba(2,6,23,0.98)_75%)] pointer-events-none z-0" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

      {/* CENTERED FUTURISTIC SUITCASE SCENE (z-10) */}
      <div className="relative w-full max-w-[540px] flex flex-col items-center justify-center">

        {/* FUTURISTIC GRAPHITE SUITCASE SHELL CONTAINER */}
        <motion.div 
          initial={{ scale: 0.92, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative w-full bg-slate-950 border-2 border-slate-800 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.95),0_0_30px_rgba(6,182,212,0.2)] p-4 sm:p-7 overflow-hidden flex flex-col items-center border-t-slate-700/80"
        >
          {/* Metallic Corner Plates & Metallic Handle */}
          <div className="absolute top-0 left-8 right-8 h-2 bg-gradient-to-r from-slate-700 via-slate-500 to-slate-700 rounded-b-md shadow-sm z-20" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-3.5 bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700 rounded-t-lg shadow-md z-20 flex items-center justify-center">
            <div className="w-16 h-1 bg-slate-600 rounded-full" />
          </div>

          {/* LEFT & RIGHT METALLIC LATCHES WITH CYAN LOCK STATUS */}
          <div className="w-full flex justify-between items-center px-4 mb-2 z-20 relative">
            
            {/* Left Latch */}
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg shadow-inner">
              {suitcasePhase === 'locked' ? (
                <LockKeyhole className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              ) : (
                <LockKeyholeOpen className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                {suitcasePhase === 'locked' ? 'LOCKED' : 'UNLOCKED'}
              </span>
            </div>

            {/* Center Status Glow Indicator */}
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <span className={`w-2 h-2 rounded-full ${suitcasePhase === 'open' ? 'bg-cyan-400 animate-ping' : 'bg-amber-400'}`} />
              <span className="text-[9px] font-mono text-cyan-300 font-extrabold tracking-widest uppercase">
                {suitcasePhase === 'open' ? 'TERMINAL READY' : 'SYSTEM UNLOCKING...'}
              </span>
            </div>

            {/* Right Latch */}
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg shadow-inner">
              {suitcasePhase === 'locked' ? (
                <LockKeyhole className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              ) : (
                <LockKeyholeOpen className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                {suitcasePhase === 'locked' ? 'SECURE' : 'READY'}
              </span>
            </div>
          </div>

          {/* SUITCASE INTERIOR / REVEALED LOGIN FORM AREA */}
          <div className="relative w-full min-h-[420px] bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-5 sm:p-7 shadow-inner overflow-hidden flex flex-col items-center justify-center z-10">

            {/* Background Holographic Grid Accent */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#082f4915_1px,transparent_1px),linear-gradient(to_bottom,#082f4915_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

            {/* ANIMATED SUITCASE LID / UNLOCK OVERLAY (Phases: locked, unlocking, opening) */}
            <AnimatePresence>
              {suitcasePhase !== 'open' && (
                <motion.div
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{
                    opacity: suitcasePhase === 'opening' ? 0.3 : 1,
                    y: suitcasePhase === 'opening' ? -120 : 0,
                    scale: suitcasePhase === 'opening' ? 0.95 : 1
                  }}
                  exit={{ opacity: 0, y: -200, scale: 0.8 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                  className="absolute inset-0 z-30 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center border border-slate-700/60 rounded-2xl shadow-2xl"
                >
                  <img 
                    src="/images/avsec-salem-logo.png" 
                    alt="AVSEC Salem Logo" 
                    className="h-16 w-auto object-contain mb-4 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]" 
                  />
                  <h3 className="text-base font-extrabold text-white font-mono tracking-widest uppercase">
                    AVSEC SALEM AI & DS PORTAL
                  </h3>
                  <p className="text-xs text-cyan-400/80 font-mono mt-2 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>UNLOCKED SUITCASE TERMINAL...</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* REVEALED REAL INTERACTIVE LOGIN UI (Phase: 'open') */}
            {suitcasePhase === 'open' && (
              <div className="w-full max-w-[340px] flex flex-col items-center space-y-4 relative z-20">
                
                {/* SUCCESS REVEAL DISPLAY */}
                {authStatus === 'success' ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="py-6 flex flex-col items-center space-y-3 text-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.6)]">
                      <CheckCircle2 className="w-8 h-8 animate-bounce" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-extrabold">AUTHENTICATION SUCCESSFUL</span>
                      <h3 className="text-base font-extrabold text-white mt-1">Welcome, {authenticatedName}</h3>
                      <p className="text-[11px] text-cyan-300/90 font-mono mt-1 animate-pulse">
                        Opening {roleSubtitle} Dashboard...
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  /* THE EXACT REQUIRED LOGIN FORM */
                  <form onSubmit={handleLoginSubmit} className="w-full flex flex-col space-y-3.5">
                    
                    {/* AVSEC SALEM & ROLE TITLE HEADER */}
                    <div className="flex flex-col items-center justify-center text-center mb-1 space-y-1">
                      <img 
                        src="/images/avsec-salem-logo.png" 
                        alt="AVSEC Salem Official Logo" 
                        className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]" 
                      />
                      <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                        <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                        <span className="text-[10px] font-mono text-cyan-200 tracking-widest uppercase font-extrabold drop-shadow-[0_0_6px_#06b6d4]">
                          AVSEC SALEM — {roleSubtitle}
                        </span>
                      </div>
                    </div>

                    {/* Holographic Error Notification */}
                    {errorMessage && (
                      <div className="w-full text-[10px] text-red-200 bg-red-950/90 border border-red-500/80 px-3 py-2 rounded-xl flex items-center space-x-2 text-left shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-in fade-in duration-200">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span className="leading-tight">{errorMessage}</span>
                      </div>
                    )}

                    {/* 1. Gmail / Email Field */}
                    <div className="w-full space-y-1 text-left">
                      <label className="text-[11px] font-semibold text-slate-300 ml-0.5">
                        Gmail / Email / ID
                      </label>
                      <div className="relative group">
                        <User className="absolute left-3.5 top-3 w-4 h-4 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                        <input
                          type="text"
                          required
                          placeholder={placeholderIdentifier}
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          className="w-full bg-slate-950/90 border border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
                        />
                      </div>
                    </div>

                    {/* 2. Password Field & Visibility Eye Toggle */}
                    <div className="w-full space-y-1 text-left">
                      <label className="text-[11px] font-semibold text-slate-300 ml-0.5">
                        Portal Password
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-3.5 top-3 w-4 h-4 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-950/90 border border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
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
                      className="w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold rounded-xl text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2"
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
            )}
          </div>
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
