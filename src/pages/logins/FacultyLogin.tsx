import React from 'react';
import { FuturisticCinematicLogin } from '../../components/auth/FuturisticCinematicLogin';

export const FacultyLogin: React.FC = () => {
  return (
    <FuturisticCinematicLogin
      portalRole="FACULTY"
      roleSubtitle="FACULTY PORTAL"
      placeholderIdentifier="Enter faculty email or ID"
      destinationRoute="/faculty/dashboard"
    />
  );
};
