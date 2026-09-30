import React from 'react';
import { FuturisticSuitcaseLogin } from '../../components/auth/FuturisticSuitcaseLogin';

export const HODLogin: React.FC = () => {
  return (
    <FuturisticSuitcaseLogin
      portalRole="HOD"
      roleSubtitle="HOD PORTAL"
      placeholderIdentifier="Enter HOD email or ID"
      destinationRoute="/hod/dashboard"
    />
  );
};
