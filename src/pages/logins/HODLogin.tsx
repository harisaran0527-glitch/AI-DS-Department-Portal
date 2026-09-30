import React from 'react';
import { HolographicBookLogin } from '../../components/auth/HolographicBookLogin';

export const HODLogin: React.FC = () => {
  return (
    <HolographicBookLogin
      portalRole="HOD"
      roleSubtitle="HOD PORTAL"
      placeholderIdentifier="HOD Email / ID"
      destinationRoute="/hod/dashboard"
    />
  );
};
