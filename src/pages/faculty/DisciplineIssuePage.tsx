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

  useEffect(() => {
    API.getMe()
      .then((res) => {
        if (res?.user) {
          setSession(res.user);
        }
      })
      .catch(() => {
        // Allow standalone module access gracefully
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

  return (
    <div className="min-h-screen bg-[#061229] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <DisciplineIssueModule
          userRole={session?.role || 'FACULTY'}
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
