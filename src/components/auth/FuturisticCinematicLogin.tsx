import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck, Sparkles, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';
import { ParticleField } from './ParticleField';
import { DisciplineIssueModule } from '../discipline/DisciplineIssueModule';
import type { Role } from '../../types';

interface FuturisticCinematicLoginProps {
  portalRole?: Role;
  roleSubtitle?: string;
  placeholderIdentifier?: string;
  destinationRoute?: string;
}

export const FuturisticCinematicLogin: React.FC<FuturisticCinematicLoginProps> = ({
  portalRole = 'HOD',
  roleSubtitle = 'HOD PORTAL',
  placeholderIdentifier = 'Enter official email or ID',
  destinationRoute = '/hod/dashboard'
}) => {
  const navigate = useNavigate();

  // Standalone Discipline Module Modal / Fullscreen view State
  const [isStandaloneDisciplineOpen, setIsStandaloneDisciplineOpen] = useState(false);

  // Parallax mouse position tracking for desktop
  const mousePos = useRef({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return;
      mousePos.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isMobile]);

  // Form States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Field Focus States
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | null>(null);

  // Auth Status & Feedback
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  // Clean up any stale remembered emails on mount to guarantee fresh blank fields
  useEffect(() => {
    localStorage.removeItem(`remembered_email_${portalRole.toLowerCase()}`);
  }, [portalRole]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus === 'loading') return;

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Credentials required to initiate portal authentication');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

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

        const redirectTarget = sessionStorage.getItem('redirect_after_login');
        sessionStorage.removeItem('redirect_after_login');

        setTimeout(() => {
          navigate(redirectTarget || destinationRoute);
        }, 1100);
      }
    } catch (err: any) {
      setAuthStatus('error');
      const msg = err.message || '';
      const isGenuineNetworkDrop = err instanceof TypeError || msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed');
      if (isGenuineNetworkDrop) {
        setErrorMessage('Network connection error. Please check your internet connection and try again.');
      } else {
        setErrorMessage(msg || `Invalid ${roleSubtitle} credentials. Verify your login details.`);
      }
    }
  };

  const handleOpenDisciplineModule = () => {
    setIsStandaloneDisciplineOpen(true);
  };

  if (isStandaloneDisciplineOpen) {
    return (
      <div className="min-h-screen bg-[#061229] p-4 md:p-8 text-white font-sans relative z-20">
        <div className="max-w-7xl mx-auto">
          <DisciplineIssueModule
            userRole="FACULTY"
            onBack={() => setIsStandaloneDisciplineOpen(false)}
          />
        </div>
      </div>
    );
  }

  const isHod = portalRole === 'HOD';
  const isStudent = portalRole === 'STUDENT';

  return (
    <div className="min-h-screen bg-[#061229] text-white flex flex-col items-center justify-start py-8 sm:py-12 px-4 relative overflow-x-hidden overflow-y-auto font-sans select-none stage">
      {/* Interactive Floating Particle Canvas */}
      <ParticleField mouse={mousePos} intensity={1.1} />

      {/* Atmospheric Environment Background Layers */}
      <div className="env on pointer-events-none">
        <div className="fog-a" />
        <div className="fog-b" />
        <div className="fog-c" />
        <div className="shaft s1 hidden md:block" />
        <div className="shaft s2 hidden md:block" />
        <div className="shaft s3 hidden md:block" />
        <div className="floor" />
        <div className="grid-floor" />
        <div className="vignette" />
        <div className="noise" />
      </div>

      {/* Intro Center Seed Line Animation */}
      <div className="seed pointer-events-none">
        <div className="seed-line" />
        <div className="seed-core" />
      </div>

      {/* MAIN CONTAINER FOR LOGIN TERMINAL AND SCROLL-DOWN CARDS */}
      <div className="relative z-10 w-full max-w-[460px] my-auto px-2 sm:px-0 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="panel relative rounded-2xl p-6 sm:p-9 space-y-6 overflow-hidden border border-[#123A73]/60 bg-[#0B2559]/80 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_50px_rgba(18,58,115,0.4)]"
        >
          {/* Holographic Scanner Beam Bar */}
          <div className="panel-scan" />

          {/* Flowing Energy Border */}
          <div className="panel-energy" />

          {/* Corner Tech Brackets */}
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />

          {/* TOP STATUS BAR (ThemeToggle Removed per Requirement 1) */}
          <div className="flex items-center justify-between border-b border-[#1E4D8F]/50 pb-3.5">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#22D3EE] animate-pulse shadow-[0_0_10px_#22D3EE]" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#22D3EE] uppercase">
                SECURE ACCESS NODE
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-slate-300 bg-[#071A3D] px-2.5 py-0.5 rounded border border-[#1E4D8F]/60 font-semibold tracking-wider">
                AVSEC-AI&DS v4.9
              </span>
            </div>
          </div>

          {/* BRANDING HEADER */}
          <div className="flex flex-col items-center justify-center text-center space-y-3 pt-1">
            {/* College Logo Container with Orbit Rings */}
            <div className="logo relative">
              <div className="logo-glow" />
              <div className="ring r1" />
              <div className="ring r2" />
              <div className="ring r3" />
              <div className="orbit o1">
                <i />
                <i />
              </div>
              <div className="relative z-10 w-12 h-12 flex items-center justify-center rounded-xl bg-[#071A3D] border border-[#1E4D8F] shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                <img
                  src="/images/avsec-salem-logo.png"
                  alt="AVS Engineering College Logo"
                  className="h-9 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono font-extrabold text-[#22D3EE] tracking-[0.2em] uppercase block">
                AVS ENGINEERING COLLEGE
              </span>
              <h2 className="text-sm font-bold text-white tracking-widest uppercase mt-0.5">
                DEPARTMENT OF AI & DATA SCIENCE
              </h2>
              <h1 className="text-xl font-extrabold text-white tracking-tight mt-1.5 font-sans">
                {isHod ? 'HOD PORTAL ACCESS' : isStudent ? 'STUDENT PORTAL ACCESS' : 'FACULTY WORKSPACE'}
              </h1>
              <p className="text-xs text-[#D9E6FF]/80 font-mono mt-1">
                {isHod
                  ? 'Department Governance & Executive Operations'
                  : isStudent
                  ? 'Student Academic & Performance Portal'
                  : 'Faculty Academic & Research Management'}
              </p>
            </div>
          </div>

          {/* AUTH STATUS DISPLAY / FORM */}
          <AnimatePresence mode="wait">
            {authStatus === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-[#071A3D] border border-[#22D3EE] rounded-xl p-6 text-center space-y-3 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
              >
                <div className="w-12 h-12 rounded-full bg-[#22D3EE]/20 border border-[#22D3EE] flex items-center justify-center mx-auto text-[#22D3EE] shadow-[0_0_20px_rgba(34,211,238,0.5)]">
                  <CheckCircle2 className="w-7 h-7 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-extrabold text-[#22D3EE] tracking-widest uppercase block">
                    IDENTITY VERIFIED
                  </span>
                  <h3 className="text-base font-bold text-white">Welcome, {authenticatedName}</h3>
                  <p className="text-xs text-slate-300 font-mono animate-pulse">
                    Launching {roleSubtitle} Dashboard...
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleLoginSubmit}
                className="space-y-4"
              >
                {/* ERROR MESSAGE ALERT */}
                {errorMessage && (
                  <div className="bg-rose-950/80 border border-rose-500/80 text-rose-200 p-3 rounded-xl text-xs font-mono flex items-center space-x-2 animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="break-words leading-tight">{errorMessage}</span>
                  </div>
                )}

                {/* USER / EMAIL INPUT FIELD */}
                <div
                  className={`field ${focusedField === 'identifier' || identifier ? 'lifted' : ''} ${
                    focusedField === 'identifier' ? 'focused' : ''
                  }`}
                >
                  <div className="field-scan" />
                  <div className="field-line" />
                  <div className="edge-dot t" />
                  <div className="edge-dot b" />
                  <div className="field-inner">
                    <div className="field-icon">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      onFocus={() => setFocusedField('identifier')}
                      onBlur={() => setFocusedField(null)}
                      placeholder={placeholderIdentifier || "Enter your college email or ID"}
                      autoComplete="username"
                    />
                    <div className="caret-glow" />
                  </div>
                </div>

                {/* PASSWORD INPUT FIELD */}
                <div
                  className={`field ${focusedField === 'password' || password ? 'lifted' : ''} ${
                    focusedField === 'password' ? 'focused' : ''
                  }`}
                >
                  <div className="field-scan" />
                  <div className="field-line" />
                  <div className="edge-dot t" />
                  <div className="edge-dot b" />
                  <div className="field-inner">
                    <div className="field-icon">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="eye absolute right-2 top-1/2 -translate-y-1/2"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-[#22D3EE]" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-400 hover:text-white" />
                      )}
                    </button>
                    <div className="caret-glow" />
                  </div>
                </div>

                {/* CONTROLS ROW */}
                <div className="row-between pt-1">
                  <button
                    type="button"
                    className={`check ${rememberMe ? 'on' : ''}`}
                    onClick={() => setRememberMe(!rememberMe)}
                  >
                    <i />
                    <span>Remember device</span>
                  </button>

                  <button
                    type="button"
                    className="link"
                    onClick={() => setIsForgotPasswordOpen(true)}
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="btn-shell pt-2">
                  <div className="btn-aura" />
                  <button
                    type="submit"
                    disabled={authStatus === 'loading'}
                    className={`btn ${authStatus === 'loading' ? 'charging' : ''}`}
                  >
                    <div className="btn-sheen" />
                    <div className="btn-energy" />
                    <span className="btn-label flex items-center justify-center space-x-2">
                      {authStatus === 'loading' ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-spin text-[#22D3EE]" />
                          <span>AUTHENTICATING NODE...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-[#22D3EE]" />
                          <span>INITIATE LOG IN</span>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* FOOTER CAPTION */}
          <div className="pt-2 text-center text-[10px] font-mono text-slate-400 border-t border-[#1E4D8F]/30">
            AVS Engineering College • Department of AI & DS
          </div>
        </motion.div>

        {/* FACULTY ONLY: PREMIUM SCROLL-DOWN DISCIPLINE ISSUE ACCESS CARD */}
        {portalRole === 'FACULTY' && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="panel relative rounded-2xl p-6 sm:p-7 space-y-4 overflow-hidden border border-amber-500/40 bg-[#0B2347]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_40px_rgba(245,158,11,0.2)]"
          >
            {/* Holographic Scanner Beam Bar */}
            <div className="panel-scan" />

            {/* Corner Tech Brackets */}
            <div className="corner tl" />
            <div className="corner tr" />
            <div className="corner bl" />
            <div className="corner br" />

            {/* Top Header Status */}
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#F59E0B]" />
                <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase">
                  Authorized Faculty Access
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-300/90 bg-amber-950/70 px-2.5 py-0.5 rounded border border-amber-500/40 font-semibold tracking-wider">
                DISCIPLINE PORTAL
              </span>
            </div>

            {/* Title & Description */}
            <div className="flex flex-col items-center text-center space-y-2 pt-1">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight uppercase font-sans">
                Discipline Issue
              </h3>
              <p className="text-xs text-slate-300 font-mono leading-relaxed max-w-xs">
                Dedicated access point for authorized Faculty to log, validate, and manage student disciplinary incidents & rule violations.
              </p>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenDisciplineModule}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-mono text-xs tracking-wider uppercase transition-all duration-200 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center justify-center space-x-2 group cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
                <span>Access Discipline Module</span>
                <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Small Footer Note */}
            <div className="text-center text-[10px] font-mono text-slate-400 pt-1 border-t border-amber-500/20">
              Faculty Authentication & Register No. Validation Required
            </div>
          </motion.div>
        )}
      </div>

      {/* FORGOT PASSWORD MODAL */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        portalRole={portalRole}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};
