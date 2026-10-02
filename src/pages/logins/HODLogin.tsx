import React from 'react';
import { FuturisticCinematicLogin } from '../../components/auth/FuturisticCinematicLogin';

export const HODLogin: React.FC = () => {
  return (
    <FuturisticCinematicLogin
      portalRole="HOD"
      roleSubtitle="HOD PORTAL"
      placeholderIdentifier="Enter HOD email or ID"
      destinationRoute="/hod/dashboard"
    />
  );
};
