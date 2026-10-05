import React from 'react';
import { FuturisticCinematicLogin } from '../../components/auth/FuturisticCinematicLogin';

export const StudentLogin: React.FC = () => {
  return (
    <FuturisticCinematicLogin
      portalRole="STUDENT"
      roleSubtitle="STUDENT PORTAL"
      placeholderIdentifier="Register Number / College Email"
      destinationRoute="/student/dashboard"
    />
  );
};

