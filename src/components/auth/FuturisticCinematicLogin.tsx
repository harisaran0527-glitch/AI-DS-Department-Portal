import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { PortalLoginLayout, PortalLoginCard, PortalLoginRecovery } from './PortalLoginLayout';
import type { Role } from '../../types';

interface FuturisticCinematicLoginProps {
  portalRole?: Role;
  roleSubtitle?: string;
  placeholderIdentifier?: string;
  destinationRoute?: string;
}

export const FuturisticCinematicLogin: React.FC<FuturisticCinematicLoginProps> = ({
  portalRole = 'HOD',
  roleSubtitle = 'HOD PORTAL',
  placeholderIdentifier = 'Enter official email or ID',
  destinationRoute = '/hod/dashboard'
}) => {
  const navigate = useNavigate();

  const submitting = useRef(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedName, setAuthenticatedName] = useState('');

  // Clean up any stale remembered emails on mount, reset input states, without changing the saved theme
  useEffect(() => {
    setIdentifier('');
    setPassword('');
    setShowPassword(false);
    setErrorMessage('');
    setAuthStatus('idle');
    setRememberMe(false);
    localStorage.removeItem(`remembered_email_${portalRole.toLowerCase()}`);
    localStorage.removeItem('remembered_email_student');
    localStorage.removeItem('remembered_email_faculty');
    localStorage.removeItem('remembered_email_hod');
    localStorage.removeItem('remembered_email_admin');
  }, [portalRole]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus === 'loading' || submitting.current) return;

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Credentials required to initiate portal authentication');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setErrorMessage('');
    submitting.current = true;
    setAuthStatus('loading');

    try {
      const res = await API.login(identifier, password, portalRole, rememberMe);

      if (res && res.user) {
        setAuthenticatedName(res.user.name);
        setAuthStatus('success');

        const redirectTarget = sessionStorage.getItem('redirect_after_login');
        sessionStorage.removeItem('redirect_after_login');

        setTimeout(() => {
          navigate(redirectTarget || destinationRoute);
        }, 1100);
      }
    } catch (err: any) {
      setAuthStatus('error');
      const msg = err.message || '';
      const isClientOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (isClientOffline) {
        setErrorMessage('No internet connection detected. Please check your network and try again.');
      } else {
        setErrorMessage(msg || `Invalid ${roleSubtitle} credentials. Verify your login details.`);
      }
    } finally {
      submitting.current = false;
    }
  };

  return (
    <PortalLoginLayout role={portalRole}>
      <PortalLoginCard
        role={portalRole} identifierLabel={portalRole === 'STUDENT' ? 'Register Number / College Email' : portalRole === 'FACULTY' ? 'Faculty email or ID' : 'HOD email or ID'} placeholderIdentifier={placeholderIdentifier}
        identifier={identifier} password={password} showPassword={showPassword} rememberMe={rememberMe}
        authStatus={authStatus} errorMessage={errorMessage} authenticatedName={authenticatedName}
        onIdentifierChange={setIdentifier} onPasswordChange={setPassword}
        onVisibilityChange={() => setShowPassword(value => !value)} onRememberChange={setRememberMe}
        onForgotPassword={() => setIsForgotPasswordOpen(true)} onSubmit={handleLoginSubmit}
      />
      <PortalLoginRecovery role={portalRole} isOpen={isForgotPasswordOpen} onClose={() => setIsForgotPasswordOpen(false)} />
    </PortalLoginLayout>
  );
};
