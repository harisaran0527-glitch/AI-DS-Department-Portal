import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, getValidSessionToken, clearSessionAuth } from '../../services/api';
import type { Role } from '../../types';

interface LoginRouteProps {
  role: Role;
  children: React.ReactNode;
}

export const LoginRoute: React.FC<LoginRouteProps> = ({ role, children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Strictly isolate all login screens to their fixed dark theme
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');

    let isMounted = true;
    const token = getValidSessionToken(role);
    if (!token) {
      // User is not logged in with this role; stay on the login screen cleanly
      return;
    }

    API.getMe(role)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.user) {
          const userRole = String(res.user.role || '').toUpperCase();
          const targetRole = String(role || '').toUpperCase();
          if (userRole === targetRole) {
            switch (userRole) {
              case 'STUDENT': navigate('/student/dashboard', { replace: true }); break;
              case 'FACULTY': navigate('/faculty/dashboard', { replace: true }); break;
              case 'HOD': navigate('/hod/dashboard', { replace: true }); break;
              case 'ADMIN': navigate('/admin/dashboard', { replace: true }); break;
            }
          } else {
            clearSessionAuth(role);
          }
        }
      })
      .catch(() => {
        clearSessionAuth(role);
      });

    return () => {
      isMounted = false;
    };
  }, [role, navigate]);

  // Render children cleanly with zero initialization loader
  return <>{children}</>;
};

