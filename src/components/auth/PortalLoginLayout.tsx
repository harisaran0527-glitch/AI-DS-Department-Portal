import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Award, BarChart3, BookOpen, CalendarCheck,
  CheckCircle2, ClipboardCheck, Eye, EyeOff, FileCheck2, GraduationCap,
  LockKeyhole, Settings, ShieldCheck, UserRound, Users,
} from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';
import { useTheme } from '../../context/ThemeContext';
import type { Role } from '../../types';
import './portal-login.css';

const PORTAL_CONTENT = {
  STUDENT: {
    name: 'Student', icon: GraduationCap, eyebrow: 'Your academic workspace',
    description: 'A clearer view of your academic journey. Access your records, track your progress and celebrate your achievements.',
    mobileDescription: 'Your academic journey, all in one place.',
    features: [
      { icon: BookOpen, title: 'Academic records', text: 'Your marks and academic profile.' },
      { icon: CalendarCheck, title: 'Attendance', text: 'Stay informed about your attendance.' },
      { icon: BarChart3, title: 'Performance', text: 'Follow your academic progress.' },
      { icon: Award, title: 'Achievements', text: 'Your projects and certificates.' },
    ],
  },
  FACULTY: {
    name: 'Faculty', icon: Users, eyebrow: 'Your teaching workspace',
    description: 'Support every student with a connected academic workspace. Manage your classes, records and departmental activities.',
    mobileDescription: 'Your classes and academic records, connected.',
    features: [
      { icon: Users, title: 'Student records', text: 'Manage your assigned students.' },
      { icon: CalendarCheck, title: 'Attendance', text: 'Keep class attendance up to date.' },
      { icon: ClipboardCheck, title: 'Academic records', text: 'Manage marks and assessments.' },
      { icon: FileCheck2, title: 'Achievements', text: 'Review student projects and proofs.' },
    ],
  },
  HOD: {
    name: 'HOD', icon: ShieldCheck, eyebrow: 'Your department workspace',
    description: 'Lead with a complete view of your department. Review academic progress, support faculty and oversee departmental activities.',
    mobileDescription: 'A clear view of your department’s progress.',
    features: [
      { icon: BarChart3, title: 'Department reports', text: 'Review academic performance.' },
      { icon: Users, title: 'Faculty oversight', text: 'Monitor faculty and class activities.' },
      { icon: ClipboardCheck, title: 'Approvals', text: 'Review departmental submissions.' },
      { icon: GraduationCap, title: 'Student progress', text: 'Follow student academic records.' },
    ],
  },
  ADMIN: {
    name: 'Admin', icon: Settings, eyebrow: 'Your administration workspace',
    description: 'Keep your department running smoothly. Manage faculty assignments, user access and essential system settings in one place.',
    mobileDescription: 'Your department’s administration, simplified.',
    features: [
      { icon: Users, title: 'Faculty assignments', text: 'Organize faculty responsibilities.' },
      { icon: UserRound, title: 'User management', text: 'Manage existing portal accounts.' },
      { icon: BookOpen, title: 'Academic setup', text: 'Maintain department subject records.' },
      { icon: Settings, title: 'System settings', text: 'Manage your portal configuration.' },
    ],
  },
} as const;

export const PortalLoginLayout: React.FC<{ role: Role; children: React.ReactNode }> = ({ role, children }) => {
  const { theme } = useTheme();
  const portal = PORTAL_CONTENT[role];
  const Icon = portal.icon;

  return (
    <div className="portal-login" data-role={role.toLowerCase()} data-theme={theme}>
      <a className="login-skip" href="#portal-login-form">Skip to sign in</a>
      <header className="login-header">
        <div className="login-brand">
          <img src="/images/avsec-salem-logo.png" alt="AVS Engineering College logo" width="46" height="46" />
          <div>
            <strong className="login-brand-full">AVS ENGINEERING COLLEGE</strong>
            <strong className="login-brand-short">AVSEC SALEM</strong>
            <span>Autonomous | Salem, Tamil Nadu</span>
          </div>
        </div>
        <ThemeToggle className="login-theme-toggle" />
      </header>

      <main className="login-main">
        <section className="login-introduction" aria-labelledby="login-portal-title">
          <p className="login-department">Department of Artificial Intelligence &amp; Data Science</p>
          <p className="login-eyebrow">{portal.eyebrow}</p>
          <h1 id="login-portal-title">{portal.name} Portal</h1>
          <p className="login-intro-description">{portal.description}</p>
          <ul className="login-features">
            {portal.features.map(({ icon: FeatureIcon, title, text }) => (
              <li key={title}>
                <FeatureIcon size={20} strokeWidth={1.7} aria-hidden="true" />
                <div><strong>{title}</strong><p>{text}</p></div>
              </li>
            ))}
          </ul>
          <figure className="login-campus">
            <img src="/images/avsec-college-front.jpg" alt="Front view of AVS Engineering College’s white and blue campus building"
              width="594" height="334" decoding="async" />
            <figcaption><span>AVS Engineering College, Salem</span><span>Photo: FreeApply.com</span></figcaption>
          </figure>
        </section>

        <div className="login-form-column">
          <div className="login-mobile-intro">
            <span className="login-role-icon"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span>
            <h1>{portal.name} Portal</h1>
            <p>{portal.mobileDescription}</p>
          </div>
          {children}
          <p className="login-security"><LockKeyhole size={13} aria-hidden="true" />Secure access to your department workspace</p>
        </div>
      </main>

      <footer className="login-footer">
        <span>Department of Artificial Intelligence &amp; Data Science</span>
        <span>&copy; {new Date().getFullYear()} AVS Engineering College</span>
      </footer>
    </div>
  );
};

interface PortalLoginCardProps {
  role: Role;
  identifierLabel: string;
  placeholderIdentifier: string;
  identifier: string;
  password: string;
  showPassword: boolean;
  rememberMe: boolean;
  authStatus: 'idle' | 'loading' | 'success' | 'error';
  errorMessage: string;
  authenticatedName: string;
  onIdentifierChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onVisibilityChange: () => void;
  onRememberChange: (value: boolean) => void;
  onForgotPassword: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const PortalLoginCard: React.FC<PortalLoginCardProps> = (props) => {
  const { role, identifierLabel, placeholderIdentifier, identifier, password, showPassword,
    rememberMe, authStatus, errorMessage, authenticatedName } = props;
  const portal = PORTAL_CONTENT[role];
  const Icon = portal.icon;
  const prefix = role.toLowerCase();
  const loading = authStatus === 'loading';

  return (
    <section className="login-card" aria-labelledby="login-card-title">
      <div className="login-card-heading">
        <span className="login-role-icon"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span>
        <h2 id="login-card-title">{portal.name} login</h2>
        <p>Sign in with your existing portal credentials.</p>
      </div>

      {authStatus === 'success' ? (
        <div className="login-success" role="status" aria-live="polite">
          <CheckCircle2 size={36} aria-hidden="true" />
          <strong>{role === 'ADMIN' ? 'Administrator authorized' : 'Identity verified'}</strong>
          <h3>Welcome, {authenticatedName}</h3>
          <p>{role === 'ADMIN' ? 'Opening Admin Dashboard...' : `Launching ${role} PORTAL Dashboard...`}</p>
        </div>
      ) : (
        <form id="portal-login-form" className="login-form" onSubmit={props.onSubmit} aria-busy={loading}>
          {errorMessage && <div className="login-error" id="portal-login-error" role="alert">{errorMessage}</div>}
          <div className="login-field">
            <label htmlFor={`${prefix}-identifier`}>{identifierLabel}</label>
            <div className="login-input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input id={`${prefix}-identifier`} name={`${prefix}-identifier`} type="text" required disabled={loading}
                value={identifier} onChange={event => props.onIdentifierChange(event.target.value)}
                placeholder={placeholderIdentifier} autoComplete="username" autoCapitalize="none" spellCheck={false}
                aria-describedby={errorMessage ? 'portal-login-error' : undefined} />
            </div>
          </div>
          <div className="login-field">
            <label htmlFor={`${prefix}-password`}>{role === 'ADMIN' ? 'Portal Password' : 'Password'}</label>
            <div className="login-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input id={`${prefix}-password`} name={`${prefix}-password`} type={showPassword ? 'text' : 'password'}
                required disabled={loading} value={password} onChange={event => props.onPasswordChange(event.target.value)}
                placeholder={role === 'ADMIN' ? 'Enter admin password' : 'Enter your password'} autoComplete="current-password"
                aria-describedby={errorMessage ? 'portal-login-error' : undefined} />
              <button className="login-password-toggle" type="button" disabled={loading}
                onClick={props.onVisibilityChange} aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword} aria-controls={`${prefix}-password`}>
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div className="login-options">
            <label className="login-remember">
              <input type="checkbox" checked={rememberMe} disabled={loading} onChange={event => props.onRememberChange(event.target.checked)} />
              <span>{role === 'ADMIN' ? 'Remember Me' : 'Remember device'}</span>
            </label>
            <button className="login-forgot" type="button" onClick={props.onForgotPassword}>Forgot Password?</button>
          </div>
          <button className="login-submit" type="submit" disabled={loading}>
            <span>{loading ? 'Signing in...' : `Login as ${portal.name}`}</span>
            {!loading && <ArrowRight size={18} aria-hidden="true" />}
          </button>
          <span className="login-loading-status" role="status" aria-live="polite">{loading ? 'Authenticating your credentials. Please wait.' : ''}</span>
        </form>
      )}
      <Link className="login-back" to="/"><ArrowLeft size={15} aria-hidden="true" />Back to Department Portal</Link>
    </section>
  );
};

// Keep the existing recovery content/workflow; add login-only dialog semantics and focus handling.
export const PortalLoginRecovery: React.FC<{ role: Role; isOpen: boolean; onClose: () => void }> = ({ role, isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const buttons = controls();
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="login-recovery" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Portal Password Recovery">
      <ForgotPasswordModal isOpen={isOpen} portalRole={role} onClose={onClose} />
    </div>
  );
};
