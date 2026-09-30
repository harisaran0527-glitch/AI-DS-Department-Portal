import React from 'react';
import { CinematicBookLogin } from '../../components/auth/CinematicBookLogin';

export const AdminLogin: React.FC = () => {
  return (
    <CinematicBookLogin
      portalRole="ADMIN"
      roleSubtitle="ADMIN PORTAL"
      placeholderIdentifier="Enter admin email or ID"
      destinationRoute="/admin/dashboard"
    />
  );
};
