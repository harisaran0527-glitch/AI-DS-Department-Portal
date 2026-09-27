import React from 'react';
import { VideoPortalLogin } from '../../components/auth/VideoPortalLogin';

export const FacultyLogin: React.FC = () => {
  return (
    <VideoPortalLogin
      portalRole="FACULTY"
      roleSubtitle="Faculty Access"
      placeholderIdentifier="Faculty Email / ID"
      destinationRoute="/faculty/dashboard"
    />
  );
};
