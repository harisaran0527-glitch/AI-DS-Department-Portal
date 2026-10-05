import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, getValidSessionToken } from '../../services/api';
import type { Role } from '../../types';

interface LoginRouteProps {
  role: Role;
  children: React.ReactNode;
}

export const LoginRoute: React.FC<LoginRouteProps> = ({ role, children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const token = getValidSessionToken();
    if (!token) {
      // User is not logged in; stay on the login screen cleanly without triggering 401
      return;
    }

    API.getMe()
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
          }
        }
      })
      .catch(() => {
        // Token was invalid or expired; stay on the login page cleanly
      });

    return () => {
      isMounted = false;
    };
  }, [role, navigate]);

  // Render children cleanly with zero initialization loader
  return <>{children}</>;
};

