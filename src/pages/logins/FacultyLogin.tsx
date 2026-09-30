import React from 'react';
import { VideoPortalLogin } from '../../components/auth/VideoPortalLogin';

export const FacultyLogin: React.FC = () => {
  return (
    <VideoPortalLogin
      portalRole="FACULTY"
      roleSubtitle="FACULTY PORTAL"
      placeholderIdentifier="Enter faculty email or ID"
      destinationRoute="/faculty/dashboard"
    />
  );
};
