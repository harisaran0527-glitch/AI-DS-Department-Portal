import React from 'react';
import { CinematicBookLogin } from '../../components/auth/CinematicBookLogin';

export const HODLogin: React.FC = () => {
  return (
    <CinematicBookLogin
      portalRole="HOD"
      roleSubtitle="HOD PORTAL"
      placeholderIdentifier="Enter HOD email or ID"
      destinationRoute="/hod/dashboard"
    />
  );
};
