import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';

export const StudentVideoLogin: React.FC = () => {
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

  const forwardVideoSrc = '/media/student-login.mp4';
  const reverseVideoSrc = '/media/student-login-reverse.mp4';

  // Ensure playback starts reliably on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback: show overlay if video cannot autoplay
        setIsVideoEnded(true);
      });
    }

    // Safety timeout: ensure interactive form is always reachable after 8.5 seconds
    const fallbackTimer = setTimeout(() => {
      setIsVideoEnded(true);
    }, 8500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  const handleVideoError = () => {
    console.error('Student reference video failed to load');
    setHasVideoError(true);
    setIsVideoEnded(true);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isPlayingExit && videoRef.current.duration > 0) {
      // Pause near final frame (duration - 0.08) to freeze exact holographic frame
      if (videoRef.current.currentTime >= videoRef.current.duration - 0.08) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.duration - 0.05);
        videoRef.current.pause();
        setIsVideoEnded(true);
      }
    }
  };

  const handleVideoEnded = () => {
    if (isPlayingExit) {
      navigate('/student/dashboard');
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
      const res = await API.login(identifier, password, 'STUDENT');

      if (res && res.user) {
        setAuthenticatedName(res.user.name);
        setAuthStatus('success');

        // Play reverse exit video after showing ACCESS GRANTED briefly
        setTimeout(() => {
          setAuthStatus('closing');
          setIsPlayingExit(true);
          if (videoRef.current) {
            videoRef.current.src = reverseVideoSrc;
            videoRef.current.load();
            videoRef.current.play().catch(() => {
              navigate('/student/dashboard');
            });
            // Backup navigation timer if reverse video stalls or doesn't fire onEnded
            setTimeout(() => {
              navigate('/student/dashboard');
            }, 2500);
          } else {
            navigate('/student/dashboard');
          }
        }, 1100);
      }
    } catch (err: any) {
      setAuthStatus('error');
      setErrorMessage(err.message || 'Invalid credentials. Please check your Register Number/Email or Portal Password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#020510] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Dark Ambient Background Glow (z-0) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(6,182,212,0.18),rgba(2,5,16,0.95)_75%)] pointer-events-none z-0" />

      {/* Main Centered Composition Wrapper preserving 496x368 aspect ratio */}
      <div className="relative w-full max-w-[750px] aspect-[496/368] flex items-center justify-center">

        {/* Video Error Debugging Fallback */}
        {hasVideoError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-900/90 text-red-300 font-mono text-xs text-center rounded-xl border border-red-800">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <span>Unable to load portal animation.</span>
            <span className="text-[10px] text-slate-400 mt-1">Path: {forwardVideoSrc}</span>
          </div>
        )}

        {/* MP4 REFERENCE VIDEO ANIMATION (z-10) */}
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

        {/* INTERACTIVE HTML OVERLAY ALIGNED OVER FINAL VIDEO FRAME (z-30) */}
        {isVideoEnded && !isPlayingExit && (
          <div className="absolute inset-0 flex items-center justify-center z-30 p-4 pointer-events-auto">
            <div className="w-[62%] max-w-[340px] transform -translate-y-5 flex flex-col items-center justify-center text-center">

              {authStatus === 'success' ? (
                <div className="bg-slate-950/90 border-2 border-emerald-400 rounded-2xl p-5 shadow-[0_0_30px_rgba(16,185,129,0.5)] backdrop-blur-md flex flex-col items-center space-y-2 z-40">
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
                </div>
              ) : (
                /* REAL INTERACTIVE OVERLAY FIELDS MATCHING REFERENCE HOLOGRAM POSITIONS */
                <form onSubmit={handleLoginSubmit} className="w-full flex flex-col items-center space-y-2.5">

                  {/* Subtitle Badge */}
                  <div className="text-[10px] font-mono text-cyan-300/90 tracking-widest uppercase mb-0.5 font-bold drop-shadow-[0_0_5px_#06b6d4]">
                    Student Access
                  </div>

                  {/* Error Notification (z-40) */}
                  {errorMessage && (
                    <div className="w-full text-[10px] text-red-200 bg-red-950/95 border border-red-700 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 text-left shadow-lg z-40">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Register Number / Email Input Field */}
                  <div className="w-full relative">
                    <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-cyan-400" />
                    <input
                      type="text"
                      required
                      placeholder="Register Number / Email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-slate-950/90 border border-cyan-500/60 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                    />
                  </div>

                  {/* Password Input Field */}
                  <div className="w-full relative">
                    <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-cyan-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Portal Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/90 border border-cyan-500/60 rounded-xl py-1.5 pl-8 pr-8 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
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
                    className="w-full mt-1 py-2 bg-gradient-to-r from-cyan-600 via-sky-500 to-cyan-600 hover:from-cyan-500 hover:to-sky-400 text-slate-950 font-extrabold rounded-xl text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                  >
                    {authStatus === 'loading' ? 'AUTHENTICATING...' : 'LOGIN'}
                  </button>

                  {/* Forgot Password Link */}
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-[10px] text-cyan-300/70 hover:text-cyan-200 transition-colors font-mono cursor-pointer"
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
        portalRole="STUDENT"
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};
