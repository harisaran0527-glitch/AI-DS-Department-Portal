import React from 'react';
import { HolographicBookLogin } from '../../components/auth/HolographicBookLogin';

export const FacultyLogin: React.FC = () => {
  return (
    <HolographicBookLogin
      portalRole="FACULTY"
      roleSubtitle="FACULTY PORTAL"
      placeholderIdentifier="Faculty Email / ID"
      destinationRoute="/faculty/dashboard"
    />
  );
};
