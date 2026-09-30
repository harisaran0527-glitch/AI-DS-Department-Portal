import React from 'react';
import { VideoPortalLogin } from '../../components/auth/VideoPortalLogin';

export const AdminLogin: React.FC = () => {
  return (
    <VideoPortalLogin
      portalRole="ADMIN"
      roleSubtitle="ADMIN PORTAL"
      placeholderIdentifier="Admin Email / ID"
      destinationRoute="/admin/dashboard"
    />
  );
};
