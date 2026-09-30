import React from 'react';
import { VideoPortalLogin } from '../../components/auth/VideoPortalLogin';

export const AdminLogin: React.FC = () => {
  return (
    <VideoPortalLogin
      portalRole="ADMIN"
      roleSubtitle="ADMIN PORTAL"
      placeholderIdentifier="Enter admin email or ID"
      destinationRoute="/admin/dashboard"
    />
  );
};
