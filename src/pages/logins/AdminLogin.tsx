import React from 'react';
import { HolographicBookLogin } from '../../components/auth/HolographicBookLogin';

export const AdminLogin: React.FC = () => {
  return (
    <HolographicBookLogin
      portalRole="ADMIN"
      roleSubtitle="ADMIN PORTAL"
      placeholderIdentifier="Admin Email / ID"
      destinationRoute="/admin/dashboard"
    />
  );
};
