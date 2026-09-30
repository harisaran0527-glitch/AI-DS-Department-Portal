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
      <div className="min-h-screen bg-[#020617] text-cyan-400 flex flex-col items-center justify-center font-sans space-y-3">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin shadow-[0_0_20px_rgba(6,182,212,0.5)]" />
        <span className="text-xs font-mono text-cyan-300/80 tracking-widest uppercase">Initializing {role} Terminal...</span>
      </div>
    );
  }

  // Render children cleanly with zero session warning banner exposed
  return <>{children}</>;
};
