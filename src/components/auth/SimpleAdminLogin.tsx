import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { PortalLoginLayout, PortalLoginCard, PortalLoginRecovery } from './PortalLoginLayout';

export const SimpleAdminLogin: React.FC = () => {
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

  // Clean up any stale remembered emails on mount, reset states, without changing the saved theme
  useEffect(() => {
    setIdentifier('');
    setPassword('');
    setShowPassword(false);
    setErrorMessage('');
    setAuthStatus('idle');
    setRememberMe(false);
    localStorage.removeItem('remembered_email_admin');
    localStorage.removeItem('remembered_email_student');
    localStorage.removeItem('remembered_email_faculty');
    localStorage.removeItem('remembered_email_hod');
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus === 'loading' || submitting.current) return;

    setErrorMessage('');
    submitting.current = true;
    setAuthStatus('loading');

    try {
      const res = await API.login(identifier, password, 'ADMIN', rememberMe);

      if (res && res.user) {
        setAuthenticatedName(res.user.name);
        setAuthStatus('success');

        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 1000);
      }
    } catch (err: any) {
      setAuthStatus('error');
      const msg = err.message || '';
      const isClientOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (isClientOffline) {
        setErrorMessage('No internet connection detected. Please check your network and try again.');
      } else {
        setErrorMessage(msg || 'Invalid admin credentials. Please verify your email/ID and password.');
      }
    } finally {
      submitting.current = false;
    }
  };

  return (
    <PortalLoginLayout role={'ADMIN'}>
      <PortalLoginCard
        role={'ADMIN'} identifierLabel={'Email / College Gmail'} placeholderIdentifier={'Enter admin email or ID'}
        identifier={identifier} password={password} showPassword={showPassword} rememberMe={rememberMe}
        authStatus={authStatus} errorMessage={errorMessage} authenticatedName={authenticatedName}
        onIdentifierChange={setIdentifier} onPasswordChange={setPassword}
        onVisibilityChange={() => setShowPassword(value => !value)} onRememberChange={setRememberMe}
        onForgotPassword={() => setIsForgotPasswordOpen(true)} onSubmit={handleLoginSubmit}
      />
      <PortalLoginRecovery role={'ADMIN'} isOpen={isForgotPasswordOpen} onClose={() => setIsForgotPasswordOpen(false)} />
    </PortalLoginLayout>
  );
};
