import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import type { Role, UserSession } from '../../types';

interface LoginRouteProps {
  role: Role;
  children: React.ReactNode;
}

export const LoginRoute: React.FC<LoginRouteProps> = ({ role, children }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    API.getMe()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.user) {
          setSession(res.user);
          // If already logged in with the MATCHING role, navigate to their dashboard
          if (res.user.role === role) {
            switch (role) {
              case 'STUDENT': navigate('/student/dashboard', { replace: true }); break;
              case 'FACULTY': navigate('/faculty/dashboard', { replace: true }); break;
              case 'HOD': navigate('/hod/dashboard', { replace: true }); break;
              case 'ADMIN': navigate('/admin/dashboard', { replace: true }); break;
            }
          }
        }
      })
      .catch(() => {
        // Unauthenticated -> stay on login page
      })
      .finally(() => {
        if (isMounted) setIsChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [role, navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans space-y-3">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-400">Loading {role} Portal...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {session && session.role !== role && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-950/90 border-b border-amber-800 text-amber-300 text-[11px] font-mono py-1.5 px-4 text-center flex justify-center items-center space-x-2">
          <span>⚠️ Active Session Detected: Logged in as <strong>{session.email}</strong> ({session.role}). Authenticating here will update your session to {role}.</span>
        </div>
      )}
      {children}
    </div>
  );
};
