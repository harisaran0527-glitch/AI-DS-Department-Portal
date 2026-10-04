import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import type { Role } from '../../types';

interface LoginRouteProps {
  role: Role;
  children: React.ReactNode;
}

export const LoginRoute: React.FC<LoginRouteProps> = ({ role, children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    API.getMe()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.user && res.user.role === role) {
          switch (role) {
            case 'STUDENT': navigate('/student/dashboard', { replace: true }); break;
            case 'FACULTY': navigate('/faculty/dashboard', { replace: true }); break;
            case 'HOD': navigate('/hod/dashboard', { replace: true }); break;
            case 'ADMIN': navigate('/admin/dashboard', { replace: true }); break;
          }
        }
      })
      .catch(() => {
        // Unauthenticated -> stay on login page
      });

    return () => {
      isMounted = false;
    };
  }, [role, navigate]);

  // Render children cleanly with zero initialization loader
  return <>{children}</>;
};
