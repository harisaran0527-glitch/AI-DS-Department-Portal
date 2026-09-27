import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const HolographicBookLogin: React.FC = () => {
  const navigate = useNavigate();

  // Animation timeline phase (1 to 16 matching exact Student portal.mp4 reference)
  const [animPhase, setAnimPhase] = useState<number>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'closing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  // Timeline Step Trigger matching Student portal.mp4 keyframes
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Phase 1 (0.00s - 0.70s): Closed dark navy leather book idle in dark blue environment
    // Phase 2 (0.70s - 1.50s): Front cover opens upward/left
    timers.push(setTimeout(() => setAnimPhase(2), 700));

    // Phase 3 (1.50s - 2.80s): Wind-driven paper pages flip across from right to left
    timers.push(setTimeout(() => setAnimPhase(3), 1500));

    // Phase 4 (2.80s - 3.80s): Open book settles with thick page stacks & engraved border graphics
    timers.push(setTimeout(() => setAnimPhase(4), 2800));

    // Phase 5 (3.50s - 4.50s): Central electric cyan/blue vertical light beam shines upward from spine
    timers.push(setTimeout(() => setAnimPhase(5), 3500));

    // Phase 6 (4.20s - 5.20s): Holographic emergence rises vertically from central spine
    timers.push(setTimeout(() => setAnimPhase(6), 4200));

    // Phase 7 (4.80s - 5.80s): Ornate filigree crest & glowing blue frame form above book
    timers.push(setTimeout(() => setAnimPhase(7), 4800));

    // Phase 8 (5.20s - 6.00s): LOGIN title & accent line appear
    timers.push(setTimeout(() => setAnimPhase(8), 5200));

    // Phase 9 (5.50s - 6.20s): Register Number / Email field appears
    timers.push(setTimeout(() => setAnimPhase(9), 5500));

    // Phase 10 (5.80s - 6.50s): Portal Password field appears
    timers.push(setTimeout(() => setAnimPhase(10), 5800));

    // Phase 11 (6.10s - 6.80s): LOGIN button appears
    timers.push(setTimeout(() => setAnimPhase(11), 6100));

    // Phase 12 (6.40s - 7.00s): Forgot Password link appears
    timers.push(setTimeout(() => setAnimPhase(12), 6400));

    // Phase 13 (6.80s - 8.04s+): Final idle state ready for user typing
    timers.push(setTimeout(() => setAnimPhase(13), 6800));

    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus === 'loading' || authStatus === 'closing') return;

    setErrorMessage('');
    setAuthStatus('loading');

    try {
      const res = await API.login(identifier, password, 'STUDENT');

      if (res && res.user) {
        setAuthenticatedName(res.user.name);
        setAuthStatus('success');

        // Reverse animation: retract hologram into spine, reduce energy, close book before navigating
        setTimeout(() => {
          setAuthStatus('closing');
        }, 1200);

        setTimeout(() => {
          navigate('/student/dashboard');
        }, 2700);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid credentials. Please check your Register Number/Email or Portal Password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#020510] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Dark Ambient Background with Soft Cyan Spotlight Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(6,182,212,0.18),rgba(2,5,16,0.95)_75%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(14,165,233,0.12),transparent_60%)] pointer-events-none" />

      {/* Main Centered Visual Composition (Matching Student portal.mp4) */}
      <div className="relative w-[500px] h-[520px] flex flex-col items-center justify-center perspective-2000">

        {/* FLOATING ORNATE HOLOGRAPHIC LOGIN FRAME (Phases 6 - 13) */}
        <AnimatePresence>
          {animPhase >= 6 && authStatus !== 'closing' && (
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.7 }}
              animate={{
                y: authStatus === 'success' ? 10 : -40,
                opacity: 1,
                scale: authStatus === 'success' ? 1.02 : 1
              }}
              exit={{ y: 110, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute z-40 w-[310px] bg-slate-950/85 border-2 border-cyan-400/80 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.4)] backdrop-blur-xl flex flex-col items-center justify-center text-center ${
                authStatus === 'error' ? 'animate-shake border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : ''
              }`}
            >
              {/* ORNATE TOP FILIGREE CREST (Matching reference frame_016) */}
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <svg className="w-10 h-6 text-cyan-400 drop-shadow-[0_0_8px_#06b6d4]" viewBox="0 0 40 24" fill="currentColor">
                  <path d="M20 0C22 6 26 10 32 10C26 10 22 14 20 20C18 14 14 10 8 10C14 10 18 6 20 0Z" />
                </svg>
              </div>

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
                      Retracting hologram back into book...
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* REAL INTERACTIVE HOLOGRAPHIC LOGIN FORM */
                <form onSubmit={handleLoginSubmit} className="w-full flex flex-col items-center space-y-3 relative z-50 mt-1">
                  {/* Phase 8: Title LOGIN & Filigree Accent Line */}
                  {animPhase >= 8 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full">
                      <h2 className="text-xl font-serif tracking-[0.2em] text-white uppercase font-bold">
                        LOGIN
                      </h2>
                      <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-1" />
                    </motion.div>
                  )}

                  {/* Error Notification inside Holographic Panel */}
                  {errorMessage && (
                    <div className="w-full text-[10px] text-red-200 bg-red-950/80 border border-red-800/80 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 text-left">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Phase 9: Register Number / Email Input Field */}
                  {animPhase >= 9 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="w-full relative">
                      <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-cyan-400" />
                      <input
                        type="text"
                        required
                        placeholder="Register Number / Email"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full bg-slate-950/90 border border-cyan-800/60 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                      />
                    </motion.div>
                  )}

                  {/* Phase 10: Password Input Field */}
                  {animPhase >= 10 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="w-full relative">
                      <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-cyan-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Portal Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950/90 border border-cyan-800/60 rounded-xl py-2 pl-9 pr-9 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-cyan-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </motion.div>
                  )}

                  {/* Phase 11: LOGIN Button */}
                  {animPhase >= 11 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      type="submit"
                      disabled={authStatus === 'loading'}
                      className="w-full mt-1 py-2.5 bg-gradient-to-r from-cyan-600 via-sky-500 to-cyan-600 hover:from-cyan-500 hover:to-sky-400 text-slate-950 font-extrabold rounded-xl text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
                    >
                      {authStatus === 'loading' ? 'AUTHENTICATING...' : 'LOGIN'}
                    </motion.button>
                  )}

                  {/* Phase 12: Forgot Password */}
                  {animPhase >= 12 && (
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

        {/* ANCIENT LEATHER BOOK & VERTICAL CYAN LIGHT BEAM (Phases 1 - 13) */}
        <div className="relative w-[440px] h-[260px] mt-28 transform-style-3d">
          {/* Phase 5: Central Electric Cyan Light Beam emanating from open spine directly into hologram */}
          {animPhase >= 5 && authStatus !== 'closing' && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-2 h-[220px] bg-cyan-300 shadow-[0_0_25px_#06b6d4] z-30 pointer-events-none animate-pulse flex flex-col items-center">
              <div className="w-24 h-full bg-gradient-to-t from-cyan-400/50 via-cyan-500/20 to-transparent blur-md" />
            </div>
          )}

          {/* OPEN ANCIENT BOOK SHELL */}
          <div className="relative w-full h-full bg-[#0a1224] border-2 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-3 flex items-center justify-between">
            {/* Dark Blue Bookmark Ribbon hanging from bottom spine center */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-8 bg-sky-700 border-x border-sky-600 rounded-b shadow-md z-30" />

            {/* OPEN BOOK LEFT & RIGHT PAGE STACKS WITH ORNATE ENGRAVED BORDER ARTWORK */}
            {animPhase >= 2 ? (
              <div className="w-full h-full flex justify-between gap-1 relative z-10">
                {/* Left Page Stack */}
                <div className="w-1/2 h-full bg-[#e8eaed] rounded-l-md border-r-2 border-slate-400 p-3 shadow-inner relative flex flex-col justify-between overflow-hidden">
                  <div className="absolute inset-2 border border-slate-400/40 rounded p-2 text-[8px] font-serif text-slate-600 opacity-60 leading-relaxed overflow-hidden">
                    <div className="font-bold text-center border-b border-slate-400 mb-1 pb-0.5">ACADEMIC RECORD</div>
                    DEPARTMENT OF ARTIFICIAL INTELLIGENCE & DATA SCIENCE. STUDENT PERFORMANCE DATA SYSTEM.
                  </div>
                </div>

                {/* Right Page Stack */}
                <div className="w-1/2 h-full bg-[#e8eaed] rounded-r-md border-l-2 border-slate-400 p-3 shadow-inner relative flex flex-col justify-between overflow-hidden">
                  <div className="absolute inset-2 border border-slate-400/40 rounded p-2 text-[8px] font-serif text-slate-600 opacity-60 leading-relaxed overflow-hidden">
                    <div className="font-bold text-center border-b border-slate-400 mb-1 pb-0.5">INTELLIGENCE LOG</div>
                    360 DEGREE PERFORMANCE RECOGNITION PORTAL. OFFICIAL EVALUATION MATRIX.
                  </div>
                </div>
              </div>
            ) : (
              /* CLOSED BOOK STATE (Phase 1) */
              <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center">
                <div className="w-6 h-full bg-slate-950 border-r border-slate-800" />
                <span className="text-xs font-serif text-slate-400 font-bold ml-4">DEPARTMENT OF AI & DS</span>
              </div>
            )}

            {/* WIND-DRIVEN PAPER PAGE FLIP ANIMATION (Phase 3) */}
            {animPhase === 3 && (
              <motion.div
                animate={{ rotateY: [0, -180, 0] }}
                transition={{ duration: 1.3, repeat: 2, ease: 'easeInOut' }}
                className="absolute top-3 bottom-3 left-1/2 w-1/2 bg-[#dedede] border-r border-slate-400 rounded-r shadow-xl origin-left z-20"
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
