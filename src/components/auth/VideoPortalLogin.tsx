import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
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

  const [isPlayingExit, setIsPlayingExit] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'closing' | 'error'>('idle');
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
    console.error('Holographic Suitcase video layer fallback initialized.');
    setHasVideoError(true);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isPlayingExit && videoRef.current.duration > 0) {
      if (videoRef.current.currentTime >= videoRef.current.duration - 0.08) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.duration - 0.05);
        videoRef.current.pause();
      }
    }
  };

  const handleVideoEnded = () => {
    if (isPlayingExit) {
      navigate(destinationRoute);
    } else {
      if (videoRef.current && videoRef.current.duration) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.duration - 0.05);
        videoRef.current.pause();
      }
    }
  };

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

        setTimeout(() => {
          setAuthStatus('closing');
          setIsPlayingExit(true);
          if (videoRef.current) {
            videoRef.current.src = reverseVideoSrc;
            videoRef.current.load();
            videoRef.current.play().catch(() => {
              navigate(destinationRoute);
            });
            setTimeout(() => {
              navigate(destinationRoute);
            }, 2500);
          } else {
            navigate(destinationRoute);
          }
        }, 1100);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid credentials. Please verify your portal identifier and password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-3 sm:p-6 relative overflow-hidden font-sans select-none">
      
      {/* Deep Navy/Black Cinematic Background (z-0) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.22),rgba(2,6,23,0.98)_75%)] pointer-events-none z-0" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-cyan-500/15 blur-[140px] rounded-full pointer-events-none z-0" />

      {/* Main Holographic Briefcase Canvas (Preserves original aspect ratio) */}
      <div className="relative w-full max-w-[780px] aspect-[496/368] flex items-center justify-center overflow-hidden">

        {/* Video Load Fallback Visual Layer */}
        {hasVideoError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950/90 text-cyan-400 font-mono text-xs text-center border border-cyan-800/50 rounded-2xl">
            <ShieldCheck className="w-10 h-10 text-cyan-400 mb-2 animate-pulse" />
            <span className="font-bold tracking-widest text-slate-200">AVSEC SALEM HOLOGRAPHIC TERMINAL</span>
            <span className="text-[10px] text-cyan-400/70 mt-1">Ready for Secure Authentication</span>
          </div>
        )}

        {/* MP4 HOLOGRAPHIC SUITCASE VIDEO LAYER (z-10) */}
        {!hasVideoError && (
          <video
            ref={videoRef}
            src={forwardVideoSrc}
            autoPlay
            muted
            playsInline
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            onError={handleVideoError}
            className="w-full h-full object-contain z-10 filter drop-shadow-[0_0_25px_rgba(6,182,212,0.35)]"
          />
        )}

        {/* HOLOGRAPHIC PROJECTION LOGIN INTERFACE (z-30) - NO FLOATING CARDS OR BOX CONTAINERS */}
        {!isPlayingExit && (
          <div className="absolute inset-0 flex items-center justify-center z-30 p-2 sm:p-4 pointer-events-auto">
            <div className="w-[74%] sm:w-[58%] max-w-[340px] transform -translate-y-3 sm:-translate-y-4 flex flex-col items-center justify-center text-center drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]">

              {authStatus === 'success' ? (
                /* Holographic Access Granted Beam */
                <div className="w-full bg-slate-950/90 border border-emerald-400/80 rounded-2xl p-5 shadow-[0_0_40px_rgba(16,185,129,0.6)] backdrop-blur-md flex flex-col items-center space-y-2 z-40 animate-in fade-in zoom-in duration-300">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-extrabold">AUTHENTICATION SUCCESSFUL</span>
                    <h3 className="text-base font-extrabold text-white mt-1">Welcome, {authenticatedName}</h3>
                    <p className="text-[10px] text-cyan-300/80 font-mono mt-1 animate-pulse">
                      Entering {roleSubtitle} Dashboard...
                    </p>
                  </div>
                </div>
              ) : (
                /* INVISIBLE FORM WRAPPER — CONTROLS ARE PROJECTED DIRECTLY FROM THE HOLOGRAM BEAM */
                <form 
                  onSubmit={handleLoginSubmit} 
                  className="w-full flex flex-col items-center space-y-2 sm:space-y-2.5 bg-transparent border-0 p-0 shadow-none backdrop-blur-none"
                >

                  {/* AVSEC Salem Official Brand Logo & Role Title */}
                  <div className="flex flex-col items-center justify-center mb-0.5">
                    <img 
                      src="/images/avsec-salem-logo.png" 
                      alt="AVSEC Salem Official Logo" 
                      className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_0_18px_rgba(6,182,212,0.75)] mb-1" 
                    />
                    <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span className="text-[9px] sm:text-[10px] font-mono text-cyan-200 tracking-widest uppercase font-extrabold drop-shadow-[0_0_8px_#06b6d4]">
                        AVSEC SALEM — {roleSubtitle}
                      </span>
                    </div>
                  </div>

                  {/* Holographic Error Alert */}
                  {errorMessage && (
                    <div className="w-full text-[9px] sm:text-[10px] text-red-200 bg-red-950/90 border border-red-500/80 px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 text-left shadow-[0_0_15px_rgba(239,68,68,0.4)] z-40 animate-in fade-in duration-200">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                      <span className="leading-tight">{errorMessage}</span>
                    </div>
                  )}

                  {/* Email / ID Input Field (Layered directly into Hologram Stream) */}
                  <div className="w-full relative group">
                    <User className="absolute left-3 top-2.5 sm:top-3 w-3.5 h-3.5 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                    <input
                      type="text"
                      required
                      placeholder={placeholderIdentifier}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-slate-950/80 border border-cyan-500/60 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-cyan-300/60 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                    />
                  </div>

                  {/* Portal Password Field */}
                  <div className="w-full relative group">
                    <Lock className="absolute left-3 top-2.5 sm:top-3 w-3.5 h-3.5 text-cyan-400 group-focus-within:text-cyan-200 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Portal Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/80 border border-cyan-500/60 rounded-xl py-2 pl-9 pr-9 text-xs text-white placeholder-cyan-300/60 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 sm:top-3 text-cyan-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* LOGIN Button (Glowing Holographic Light Beam Button) */}
                  <button
                    type="submit"
                    disabled={authStatus === 'loading'}
                    className="w-full mt-1 py-2 bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold rounded-xl text-xs tracking-wider uppercase shadow-[0_0_25px_rgba(6,182,212,0.6)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2"
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

                  {/* Forgot Password Link */}
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-[9px] sm:text-[10px] text-cyan-300/80 hover:text-cyan-100 transition-colors font-mono cursor-pointer underline-offset-2 hover:underline pt-0.5"
                  >
                    Forgot Password?
                  </button>
                </form>
              )}
            </div>
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
