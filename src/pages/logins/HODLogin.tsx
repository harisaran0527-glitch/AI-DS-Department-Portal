import React from 'react';
import { VideoPortalLogin } from '../../components/auth/VideoPortalLogin';

export const HODLogin: React.FC = () => {
  return (
    <VideoPortalLogin
      portalRole="HOD"
      roleSubtitle="HOD Access"
      placeholderIdentifier="HOD Email / ID"
      destinationRoute="/hod/dashboard"
    />
  );
};
