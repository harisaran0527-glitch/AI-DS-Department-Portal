import React from 'react';
import { CinematicBookLogin } from '../../components/auth/CinematicBookLogin';

export const StudentLogin: React.FC = () => {
  return (
    <CinematicBookLogin
      portalRole="STUDENT"
      roleSubtitle="STUDENT PORTAL"
      placeholderIdentifier="Register Number / Email"
      destinationRoute="/student/dashboard"
    />
  );
};

