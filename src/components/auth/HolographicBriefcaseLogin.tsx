import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HolographicBriefcaseLoginProps {
  portalRole: 'FACULTY' | 'HOD';
  roleSubtitle: string;
  placeholderIdentifier: string;
  destinationRoute: string;
}

export const HolographicBriefcaseLogin: React.FC<HolographicBriefcaseLoginProps> = ({
  portalRole,
  roleSubtitle,
  placeholderIdentifier,
  destinationRoute
}) => {
  const navigate = useNavigate();

  // Animation timeline phase (1 to 16 matching exact 8.06s reference video)
  const [animPhase, setAnimPhase] = useState<number>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'closing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  // Timeline Step Trigger (Exact 8.06s Reference Sequence)
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Phase 1 (0.00s - 0.70s): Closed suitcase idle in dark environment
    // Phase 2 (0.70s - 1.80s): Horizontal cyan energy seam illuminates from center outward
    timers.push(setTimeout(() => setAnimPhase(2), 700));

    // Phase 3 (1.50s - 2.60s): Energy wraps around case, small cyan particles emerge
    timers.push(setTimeout(() => setAnimPhase(3), 1500));

    // Phase 4 (2.30s - 3.10s): Two front latches release mechanically upward
    timers.push(setTimeout(() => setAnimPhase(4), 2300));

    // Phase 5 (3.10s - 3.70s): Lid slowly rotates open around rear hinge
    timers.push(setTimeout(() => setAnimPhase(5), 3100));

    // Phase 6 (3.50s - 4.20s): Volumetric blue internal projector light beam shines upward
    timers.push(setTimeout(() => setAnimPhase(6), 3500));

    // Phase 7 (4.10s - 4.80s): Holographic platform emerges upward from base
    timers.push(setTimeout(() => setAnimPhase(7), 4100));

    // Phase 8 (4.20s - 6.40s): 3D orbiting electric cyan energy ring orbits panel
    timers.push(setTimeout(() => setAnimPhase(8), 4200));

    // Phase 9 (4.70s - 5.30s): Holographic panel forms into glowing rounded rectangle
    timers.push(setTimeout(() => setAnimPhase(9), 4700));

    // Phase 10 (4.90s - 5.20s): Profile icon appears at top center
    timers.push(setTimeout(() => setAnimPhase(10), 4900));

    // Phase 11 (5.10s - 5.50s): PORTAL title and role subtitle appear
    timers.push(setTimeout(() => setAnimPhase(11), 5100));

    // Phase 12 (5.30s - 5.70s): Identifier input field appears
    timers.push(setTimeout(() => setAnimPhase(12), 5300));

    // Phase 13 (5.60s - 6.00s): Password input field appears
    timers.push(setTimeout(() => setAnimPhase(13), 5600));

    // Phase 14 (6.00s - 6.40s): LOGIN button appears
    timers.push(setTimeout(() => setAnimPhase(14), 6000));

    // Phase 15 (6.30s - 6.60s): Forgot Password link appears
    timers.push(setTimeout(() => setAnimPhase(15), 6300));

    // Phase 16 (6.60s - 8.06s+): Final idle state ready for user typing
    timers.push(setTimeout(() => setAnimPhase(16), 6600));

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

        // Reverse animation sequence: retract hologram, close suitcase, then navigate
        setTimeout(() => {
          setAuthStatus('closing');
        }, 1200);

        setTimeout(() => {
          navigate(destinationRoute);
        }, 2700);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid credentials. Please check your identifier or portal password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background — Midnight Navy Center with Black Edges & Soft Cyan Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.14),transparent_65%)] pointer-events-none" />

      {/* Main Centered Composition Container */}
      <div className="relative w-[496px] h-[368px] flex flex-col items-center justify-center perspective-2000">

        {/* FLOATING HOLOGRAPHIC LOGIN PANEL (Phases 7 - 16) */}
        <AnimatePresence>
          {animPhase >= 7 && authStatus !== 'closing' && (
            <motion.div
              initial={{ y: 70, opacity: 0, scale: 0.7 }}
              animate={{
                y: authStatus === 'success' ? 0 : -28,
                opacity: 1,
                scale: authStatus === 'success' ? 1.02 : 1
              }}
              exit={{ y: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute z-40 w-[300px] bg-slate-950/90 border-2 border-cyan-400/80 rounded-2xl p-5 shadow-[0_0_35px_rgba(6,182,212,0.35)] backdrop-blur-xl flex flex-col items-center justify-center text-center ${
                authStatus === 'error' ? 'animate-shake border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.4)]' : ''
              }`}
            >
              {/* ORBITING 3D ENERGY RING (Phase 8 - 16) */}
              {animPhase >= 8 && authStatus !== 'success' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <motion.div
                    animate={{ rotateZ: 360, rotateX: 65 }}
                    transition={{ duration: 7.5, repeat: Infinity, ease: 'linear' }}
                    className="w-[340px] h-[340px] rounded-full border-2 border-dashed border-cyan-400/50 shadow-[0_0_20px_#06b6d4]"
                  />
                </div>
              )}

              {/* SUCCESS RETRACTION DISPLAY */}
              {authStatus === 'success' ? (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="py-4 flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-bold">ACCESS GRANTED</span>
                    <h3 className="text-base font-bold text-white mt-0.5">Welcome, {authenticatedName}</h3>
                    <p className="text-[10px] text-cyan-300/80 font-mono mt-0.5 animate-pulse">
                      Retracting hologram into briefcase...
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* REAL INTERACTIVE HOLOGRAPHIC LOGIN FORM */
                <form onSubmit={handleLoginSubmit} className="w-full flex flex-col items-center space-y-2.5 relative z-50">
                  {/* Phase 10: Profile Icon */}
                  {animPhase >= 10 && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-10 h-10 rounded-full bg-cyan-950/80 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                    >
                      <User className="w-5 h-5" />
                    </motion.div>
                  )}

                  {/* Phase 11: PORTAL Title & Subtitle */}
                  {animPhase >= 11 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                      <h2 className="text-lg font-extrabold tracking-[0.3em] text-white uppercase font-sans">
                        PORTAL
                      </h2>
                      <p className="text-[10px] font-mono text-cyan-300/80 tracking-widest uppercase mt-0.5">
                        {roleSubtitle}
                      </p>
                    </motion.div>
                  )}

                  {/* Error Notification inside Holographic Panel */}
                  {errorMessage && (
                    <div className="w-full text-[10px] text-red-200 bg-red-950/80 border border-red-800/80 px-2.5 py-1 rounded-lg flex items-center space-x-1.5 text-left">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Phase 12: Username / Identifier Input Field */}
                  {animPhase >= 12 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="w-full relative">
                      <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-cyan-400" />
                      <input
                        type="text"
                        required
                        placeholder={placeholderIdentifier}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full bg-slate-950/90 border border-cyan-800/60 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                      />
                    </motion.div>
                  )}

                  {/* Phase 13: Password Input Field */}
                  {animPhase >= 13 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="w-full relative">
                      <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-cyan-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Portal Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950/90 border border-cyan-800/60 rounded-xl py-1.5 pl-8 pr-8 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-cyan-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </motion.div>
                  )}

                  {/* Phase 14: LOGIN Button */}
                  {animPhase >= 14 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      type="submit"
                      disabled={authStatus === 'loading'}
                      className="w-full mt-1 py-2 bg-gradient-to-r from-cyan-600 via-sky-500 to-cyan-600 hover:from-cyan-500 hover:to-sky-400 text-slate-950 font-extrabold rounded-xl text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                    >
                      {authStatus === 'loading' ? 'AUTHENTICATING...' : 'LOGIN'}
                    </motion.button>
                  )}

                  {/* Phase 15: Forgot Password */}
                  {animPhase >= 15 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <button type="button" className="text-[10px] text-cyan-300/70 hover:text-cyan-200 transition-colors font-mono">
                        Forgot Password?
                      </button>
                    </motion.div>
                  )}
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CLOSED DARK METALLIC EXECUTIVE BRIEFCASE (Phases 1 - 16) */}
        <div className="relative w-[380px] h-[210px] mt-28 transform-style-3d">
          {/* Floor Shadow / Light Reflection beneath Case */}
          <div className="absolute -bottom-5 left-8 right-8 h-8 bg-cyan-500/20 blur-lg rounded-full pointer-events-none" />

          {/* BRIEFCASE SHELL */}
          <div className="relative w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-2.5 flex flex-col justify-between">
            {/* Raised Parallel Vertical Detail Lines on Left and Right Edges */}
            <div className="absolute left-5 top-2.5 bottom-2.5 w-1 bg-slate-800 border-r border-slate-700/50 rounded-full" />
            <div className="absolute right-5 top-2.5 bottom-2.5 w-1 bg-slate-800 border-l border-slate-700/50 rounded-full" />

            {/* Reinforced Metallic Corner Pieces */}
            <div className="absolute top-1 left-1 w-5 h-5 border-t-2 border-l-2 border-cyan-500/60 rounded-tl-lg" />
            <div className="absolute top-1 right-1 w-5 h-5 border-t-2 border-r-2 border-cyan-500/60 rounded-tr-lg" />
            <div className="absolute bottom-1 left-1 w-5 h-5 border-b-2 border-l-2 border-cyan-500/60 rounded-bl-lg" />
            <div className="absolute bottom-1 right-1 w-5 h-5 border-b-2 border-r-2 border-cyan-500/60 rounded-br-lg" />

            {/* PHASE 2 & 3: HORIZONTAL CYAN ENERGY SEAM */}
            {animPhase >= 2 && (
              <motion.div
                initial={{ width: '0%', opacity: 0 }}
                animate={{ width: animPhase >= 3 ? '100%' : '55%', opacity: 1 }}
                transition={{ duration: 1.0, ease: 'easeInOut' }}
                className="absolute top-1/2 left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_16px_#06b6d4] z-20 mx-auto"
              />
            )}

            {/* PHASE 5 & 6: INTERNAL BLUE LIGHT PROJECTOR */}
            {animPhase >= 5 && (
              <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/35 via-cyan-400/15 to-transparent pointer-events-none z-10 flex items-center justify-center">
                <div className="w-28 h-12 rounded-full bg-cyan-400/40 blur-md border border-cyan-300/50" />
              </div>
            )}

            {/* SUITCASE TOP LID (3D Rear-Hinge Rotation) */}
            <motion.div
              initial={{ rotateX: 0 }}
              animate={{ rotateX: animPhase >= 5 && authStatus !== 'closing' ? -100 : 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-0 left-0 right-0 h-1/2 bg-slate-900 border-b-2 border-slate-700/80 rounded-t-xl origin-top p-2.5 flex justify-between items-start z-30 shadow-xl"
            >
              {/* U-SHAPED HANDLE */}
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-20 h-5 border-t-4 border-x-4 border-slate-700 bg-slate-950 rounded-t-md shadow-sm" />

              {/* PHASE 4: TWO RECTANGULAR FRONT LATCHES (Unlock Motion) */}
              <motion.div
                animate={{ y: animPhase >= 4 ? -5 : 0, scale: animPhase >= 4 ? 1.05 : 1 }}
                className="w-7 h-3.5 bg-slate-800 border border-cyan-500/50 rounded shadow"
              />
              <motion.div
                animate={{ y: animPhase >= 4 ? -5 : 0, scale: animPhase >= 4 ? 1.05 : 1 }}
                className="w-7 h-3.5 bg-slate-800 border border-cyan-500/50 rounded shadow"
              />
            </motion.div>

            {/* SUITCASE BASE INTERIOR */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-slate-950 rounded-b-xl border-t border-slate-800 p-2.5 flex justify-between items-end">
              <span className="text-[8px] font-mono text-slate-600">EXECUTIVE SUITCASE</span>
              <span className="text-[8px] font-mono text-cyan-400/70">AI & DS</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
