import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import type { Role, UserSession } from '../../types';
import { ShieldAlert, LogOut, LayoutDashboard, RefreshCw } from 'lucide-react';

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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-400">Verifying Portal Access Credentials...</span>
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-md bg-slate-900 border border-red-900/60 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-950 border border-red-800 flex items-center justify-center mx-auto text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono tracking-widest text-red-400 uppercase font-bold bg-red-950 px-3 py-1 rounded-full border border-red-800">
              403 FORBIDDEN — ROLE MISMATCH
            </span>
            <h2 className="text-xl font-bold text-white">Access Denied</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              You are currently authenticated as <strong className="text-cyan-400">{session?.email}</strong> with role <strong className="text-amber-400">{currentRole}</strong>.
              This section requires <strong className="text-indigo-400">{requiredRole}</strong> permissions.
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
