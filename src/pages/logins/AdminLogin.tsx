import React from 'react';
import { FuturisticSuitcaseLogin } from '../../components/auth/FuturisticSuitcaseLogin';

export const AdminLogin: React.FC = () => {
  return (
    <FuturisticSuitcaseLogin
      portalRole="ADMIN"
      roleSubtitle="ADMIN PORTAL"
      placeholderIdentifier="Enter admin email or ID"
      destinationRoute="/admin/dashboard"
    />
  );
};
