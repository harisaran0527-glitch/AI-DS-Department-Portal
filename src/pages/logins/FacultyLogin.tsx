import React from 'react';
import { FuturisticSuitcaseLogin } from '../../components/auth/FuturisticSuitcaseLogin';

export const FacultyLogin: React.FC = () => {
  return (
    <FuturisticSuitcaseLogin
      portalRole="FACULTY"
      roleSubtitle="FACULTY PORTAL"
      placeholderIdentifier="Enter faculty email or ID"
      destinationRoute="/faculty/dashboard"
    />
  );
};
