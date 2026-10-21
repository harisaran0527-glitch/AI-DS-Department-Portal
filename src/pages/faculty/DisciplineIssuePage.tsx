import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import type { UserSession } from '../../types';
import { DisciplineIssueModule } from '../../components/discipline/DisciplineIssueModule';
import { Loader2 } from 'lucide-react';

export const DisciplineIssuePage: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    API.getMe()
      .then((res) => {
        if (res?.user && ['FACULTY', 'HOD', 'ADMIN'].includes(res.user.role)) {
          setSession(res.user);
        } else {
          setAccessError('A Faculty, HOD, or Admin session is required.');
        }
      })
      .catch(() => {
        setAccessError('Unable to verify your session. Sign in to access discipline records.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#061229] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#061229] text-white flex items-center justify-center p-6">
        <div className="max-w-md space-y-4">
          <p role="alert">{accessError}</p>
          <button type="button" onClick={() => navigate('/discipline/login')} className="rounded-lg bg-blue-600 px-4 py-3">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061229] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span>{session.name} · {session.role}</span>
          <button type="button" className="rounded-lg bg-slate-800 px-4 py-2" onClick={async () => {
            await API.logout(session.role);
            navigate('/discipline/login', { replace: true });
          }}>Sign Out</button>
        </div>
        <DisciplineIssueModule
          userRole={session.role}
          onBack={() => {
            if (session?.role === 'HOD') navigate('/hod/dashboard');
            else if (session?.role === 'ADMIN') navigate('/admin/dashboard');
            else if (session?.role === 'FACULTY') navigate('/faculty/dashboard');
            else navigate('/faculty');
          }}
        />
      </div>
    </div>
  );
};
export default DisciplineIssuePage;
