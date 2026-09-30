import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';

interface VideoPortalLoginProps {
  portalRole: 'FACULTY' | 'HOD' | 'ADMIN';
  roleSubtitle: string;
  placeholderIdentifier: string;
  destinationRoute: string;
}

export const VideoPortalLogin: React.FC<VideoPortalLoginProps> = ({
  portalRole,
  roleSubtitle,
  placeholderIdentifier,
  destinationRoute
}) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [hasVideoError, setHasVideoError] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'revealing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  const forwardVideoSrc = '/media/faculty-hod-login.mp4';
  const reverseVideoSrc = '/media/faculty-hod-login-reverse.mp4';

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay handled
      });
    }
  }, []);

  const handleVideoError = () => {
    console.error('Suitcase video layer fallback engaged.');
    setHasVideoError(true);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && authStatus !== 'revealing' && videoRef.current.duration > 0) {
      if (videoRef.current.currentTime >= videoRef.current.duration - 0.08) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.duration - 0.05);
        videoRef.current.pause();
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus === 'loading' || authStatus === 'revealing') return;

    setErrorMessage('');
    setAuthStatus('loading');

    try {
      const res = await API.login(identifier, password, portalRole);

      if (res && res.user) {
        setAuthenticatedName(res.user.name);
        setAuthStatus('success');

        // Trigger Cinematic Reveal Transition (1.2 Seconds)
        setTimeout(() => {
          setAuthStatus('revealing');
          if (videoRef.current) {
            videoRef.current.src = reverseVideoSrc;
            videoRef.current.load();
            videoRef.current.play().catch(() => {
              navigate(destinationRoute);
            });
            setTimeout(() => {
              navigate(destinationRoute);
            }, 1200);
          } else {
            navigate(destinationRoute);
          }
        }, 1000);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid credentials. Please verify your portal identifier and password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* 4K Dark Navy Ambient Background Glow (z-0) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.2),rgba(2,6,23,0.98)_75%)] pointer-events-none z-0" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-cyan-500/15 blur-[140px] rounded-full pointer-events-none z-0" />

      {/* Post-Authentication Cinematic Reveal Light Sweep Layer (z-50) */}
      {authStatus === 'revealing' && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-cyan-950/40 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="w-full h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-[0_0_50px_#06b6d4]" />
          <div className="absolute text-cyan-300 font-mono text-sm tracking-widest font-extrabold uppercase animate-bounce">
            REVEALING {roleSubtitle} DASHBOARD...
          </div>
        </div>
      )}

      {/* Main Composite Container: Suitcase Video + Front Login Card */}
      <div className="relative w-full max-w-[850px] aspect-[16/10] sm:aspect-[496/368] flex items-center justify-center">

        {/* BACKGROUND CINEMATIC SUITCASE & BOOK ENVIRONMENT (z-10) */}
        {!hasVideoError ? (
          <video
            ref={videoRef}
            src={forwardVideoSrc}
            autoPlay
            muted
            playsInline
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onError={handleVideoError}
            className={`w-full h-full object-contain z-10 transition-all duration-700 filter drop-shadow-[0_0_30px_rgba(6,182,212,0.3)] ${
              authStatus === 'revealing' ? 'scale-110 opacity-30 blur-md' : 'opacity-90'
            }`}
          />
        ) : (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950/80 text-cyan-400 font-mono text-xs text-center border border-cyan-800/50 rounded-2xl">
            <ShieldCheck className="w-10 h-10 text-cyan-400 mb-2 animate-pulse" />
            <span className="font-bold tracking-widest text-slate-200">AVSEC SALEM HOLOGRAPHIC TERMINAL</span>
            <span className="text-[10px] text-cyan-400/70 mt-1">Ready for Secure Authentication</span>
          </div>
        )}

        {/* FOREGROUND FRONT LOGIN CARD (z-30) — CLEAR, HIGH-CONTRAST, IMMEDIATELY USABLE */}
        {authStatus !== 'revealing' && (
          <div className="absolute z-30 w-full max-w-[360px] px-4">
            
            {authStatus === 'success' ? (
              /* Holographic Access Granted Card */
              <div className="w-full bg-slate-950/95 border-2 border-emerald-400/90 rounded-2xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.55)] backdrop-blur-xl flex flex-col items-center space-y-3 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-extrabold">AUTHENTICATION SUCCESSFUL</span>
                  <h3 className="text-base font-extrabold text-white mt-1">Welcome, {authenticatedName}</h3>
                  <p className="text-[11px] text-cyan-300/90 font-mono mt-1 animate-pulse">
                    Initiating Cinematic Dashboard Reveal...
                  </p>
                </div>
              </div>
            ) : (
              /* THE FOREGROUND ULTRA-PREMIUM LOGIN CARD */
              <form 
                onSubmit={handleLoginSubmit} 
                className="w-full bg-slate-950/85 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_45px_rgba(6,182,212,0.35)] backdrop-blur-xl flex flex-col items-center space-y-3 transition-all duration-300 hover:border-cyan-400/60"
              >
                
                {/* AVSEC Salem Official Brand Logo & Role Badge */}
                <div className="flex flex-col items-center justify-center text-center space-y-1 mb-1">
                  <img 
                    src="/images/avsec-salem-logo.png" 
                    alt="AVSEC Salem Logo" 
                    className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
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

                {/* Email / ID Input Field (Real React Input) */}
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

                {/* Password Input Field (Real React Input) */}
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

                {/* LOGIN Submit Button */}
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
          </div>
        )}
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
