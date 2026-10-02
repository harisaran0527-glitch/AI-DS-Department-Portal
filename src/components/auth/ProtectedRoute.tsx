import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import type { Role, UserSession } from '../../types';
import { ShieldAlert, LogOut, LayoutDashboard } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles: Role[];
  loginRoute: string;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  loginRoute,
  children
}) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [status, setStatus] = useState<'checking' | 'authorized' | 'unauthorized' | 'forbidden'>('checking');

  useEffect(() => {
    let isMounted = true;

    API.getMe()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.user) {
          setSession(res.user);
          if (allowedRoles.includes(res.user.role)) {
            setStatus('authorized');
          } else {
            setStatus('forbidden');
          }
        } else {
          setStatus('unauthorized');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus('unauthorized');
      });

    return () => {
      isMounted = false;
    };
  }, [allowedRoles]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] flex flex-col items-center justify-center font-sans space-y-3">
        <div className="w-10 h-10 border-4 border-[#252B36] border-t-[#A78BFA] rounded-full animate-spin" />
        <span className="text-xs font-mono text-[#94A3B8]">Verifying Portal Access Credentials...</span>
      </div>
    );
  }

  if (status === 'unauthorized') {
    // Redirect unauthenticated user to the specific role login page
    navigate(loginRoute, { replace: true });
    return null;
  }

  if (status === 'forbidden') {
    const currentRole = session?.role || 'UNKNOWN';
    const requiredRole = allowedRoles.join(' / ');

    const getDashboardPath = (role: Role) => {
      switch (role) {
        case 'STUDENT': return '/student/dashboard';
        case 'FACULTY': return '/faculty/dashboard';
        case 'HOD': return '/hod/dashboard';
        case 'ADMIN': return '/admin/dashboard';
        default: return '/student';
      }
    };

    const handleSwitchAccount = async () => {
      try {
        await API.logout();
      } catch {}
      navigate(loginRoute, { replace: true });
    };

    return (
      <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-md bg-[#12161F] border border-[#252B36] rounded-2xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-800 flex items-center justify-center mx-auto text-rose-400 shadow-md">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono tracking-widest text-rose-400 uppercase font-bold bg-rose-950/80 px-3 py-1 rounded-full border border-rose-800/80">
              403 FORBIDDEN — ROLE MISMATCH
            </span>
            <h2 className="text-xl font-bold text-[#F1F5F9]">Access Denied</h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed font-mono">
              You are currently authenticated as <strong className="text-[#A78BFA]">{session?.email}</strong> with role <strong className="text-amber-400">{currentRole}</strong>.
              This section requires <strong className="text-[#22D3EE]">{requiredRole}</strong> permissions.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => navigate(getDashboardPath(session!.role), { replace: true })}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Return to My {currentRole} Dashboard</span>
            </button>

            <button
              onClick={handleSwitchAccount}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl font-semibold text-xs transition-all flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span>Sign Out & Login as {requiredRole}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
