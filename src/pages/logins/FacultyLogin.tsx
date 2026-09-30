import React from 'react';
import { CinematicBookLogin } from '../../components/auth/CinematicBookLogin';

export const FacultyLogin: React.FC = () => {
  return (
    <CinematicBookLogin
      portalRole="FACULTY"
      roleSubtitle="FACULTY PORTAL"
      placeholderIdentifier="Enter faculty email or ID"
      destinationRoute="/faculty/dashboard"
    />
  );
};
