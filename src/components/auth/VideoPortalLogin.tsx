import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
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

  const [isVideoEnded, setIsVideoEnded] = useState(false);
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
        setIsVideoEnded(true);
      });
    }

    const fallbackTimer = setTimeout(() => {
      setIsVideoEnded(true);
    }, 8500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  const handleVideoError = () => {
    console.error('Holographic Suitcase reference video failed to load');
    setHasVideoError(true);
    setIsVideoEnded(true);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isPlayingExit && videoRef.current.duration > 0) {
      if (videoRef.current.currentTime >= videoRef.current.duration - 0.08) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.duration - 0.05);
        videoRef.current.pause();
        setIsVideoEnded(true);
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
      setIsVideoEnded(true);
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
      setErrorMessage(err.message || 'Invalid credentials. Please check your identifier or portal password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center p-3 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Dark Ambient Background Glow (z-0) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.15),transparent_70%)] pointer-events-none z-0" />

      {/* Main Centered Holographic Suitcase Container (Preserves reference 496x368 aspect ratio) */}
      <div className="relative w-full max-w-[750px] aspect-[496/368] flex items-center justify-center">

        {/* Video Error Fallback Container */}
        {hasVideoError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-900/90 text-red-300 font-mono text-xs text-center rounded-xl border border-red-800">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <span>Unable to load holographic suitcase animation.</span>
            <span className="text-[10px] text-slate-400 mt-1">Path: {forwardVideoSrc}</span>
          </div>
        )}

        {/* MP4 HOLOGRAPHIC SUITCASE VIDEO (z-10) */}
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
          className="w-full h-full object-contain rounded-xl shadow-2xl z-10"
        />

        {/* THE ONE AND ONLY FUNCTIONAL HOLOGRAPHIC LOGIN OVERLAY (z-30) */}
        {isVideoEnded && !isPlayingExit && (
          <div className="absolute inset-0 flex items-center justify-center z-30 p-2 sm:p-4 pointer-events-auto">
            <div className="w-[68%] sm:w-[60%] max-w-[340px] transform -translate-y-3 sm:-translate-y-4 flex flex-col items-center justify-center text-center">

              {authStatus === 'success' ? (
                <div className="bg-slate-950/90 border-2 border-emerald-400 rounded-2xl p-5 shadow-[0_0_30px_rgba(16,185,129,0.5)] backdrop-blur-md flex flex-col items-center space-y-2 z-40">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-bold">ACCESS GRANTED</span>
                    <h3 className="text-base font-bold text-white mt-0.5">Welcome, {authenticatedName}</h3>
                    <p className="text-[10px] text-cyan-300/80 font-mono mt-0.5 animate-pulse">
                      Retracting holographic briefcase...
                    </p>
                  </div>
                </div>
              ) : (
                /* SINGLE INTEGRATED HOLOGRAPHIC SUITCASE FORM */
                <form onSubmit={handleLoginSubmit} className="w-full flex flex-col items-center space-y-1.5 sm:space-y-2">

                  {/* AVSEC Salem Official Brand Logo & Role Title */}
                  <div className="flex flex-col items-center justify-center mb-0.5">
                    <img 
                      src="/images/avsec-salem-logo.png" 
                      alt="AVSEC Salem Logo" 
                      className="h-9 sm:h-12 w-auto object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.4)] mb-0.5" 
                    />
                    <div className="text-[9px] sm:text-[10px] font-mono text-cyan-300/90 tracking-widest uppercase font-bold drop-shadow-[0_0_5px_#06b6d4]">
                      AVSEC SALEM — {roleSubtitle}
                    </div>
                  </div>

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="w-full text-[9px] sm:text-[10px] text-red-200 bg-red-950/95 border border-red-700 px-2.5 py-1 sm:py-1.5 rounded-lg flex items-center space-x-1.5 text-left shadow-lg z-40">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Email / ID Input Field */}
                  <div className="w-full relative">
                    <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-cyan-400" />
                    <input
                      type="text"
                      required
                      placeholder={placeholderIdentifier}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-slate-950/90 border border-cyan-500/60 rounded-xl py-1.5 sm:py-2 pl-8 pr-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                    />
                  </div>

                  {/* Portal Password Field */}
                  <div className="w-full relative">
                    <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-cyan-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Portal Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/90 border border-cyan-500/60 rounded-xl py-1.5 sm:py-2 pl-8 pr-8 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-cyan-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* LOGIN Button */}
                  <button
                    type="submit"
                    disabled={authStatus === 'loading'}
                    className="w-full mt-1 py-1.5 sm:py-2 bg-gradient-to-r from-cyan-600 via-sky-500 to-cyan-600 hover:from-cyan-500 hover:to-sky-400 text-slate-950 font-extrabold rounded-xl text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
                  >
                    {authStatus === 'loading' ? 'AUTHENTICATING...' : 'LOGIN'}
                  </button>

                  {/* Forgot Password Link */}
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-[9px] sm:text-[10px] text-cyan-300/70 hover:text-cyan-200 transition-colors font-mono cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Forgot Password Guidance Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        portalRole={portalRole}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};
