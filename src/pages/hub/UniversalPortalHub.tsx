import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, GraduationCap, Menu, Settings, ShieldCheck, Users } from 'lucide-react';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { useTheme } from '../../context/ThemeContext';
import { usePortalPwa } from '../../hooks/usePortalPwa';
import './portal-landing.css';

const PORTALS = [
  { id: 'student', name: 'Student', route: '/student', icon: GraduationCap,
    description: 'View academic records, attendance, performance and achievements.',
    mobileDescription: 'Access your academic details.' },
  { id: 'faculty', name: 'Faculty', route: '/faculty', icon: Users,
    description: 'Manage students, academic records and departmental activities.',
    mobileDescription: 'Manage classes and records.' },
  { id: 'hod', name: 'HOD', route: '/hod', icon: ShieldCheck,
    description: 'Monitor department progress, approvals and reports.',
    mobileDescription: 'Review department reports.' },
  { id: 'admin', name: 'Admin', route: '/admin', icon: Settings,
    description: 'Manage faculty assignments, users and system settings.',
    mobileDescription: 'Manage system settings.' },
] as const;

export const UniversalPortalHub: React.FC = () => {
  const { theme } = useTheme();
  const { canInstall, isInstalled, triggerInstall } = usePortalPwa();

  return (
    <div className="portal-landing" data-theme={theme}>
      <a className="landing-skip" href="#portal-selection">Skip to portal selection</a>
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand">
            <img className="landing-logo" src="/images/avsec-salem-logo.png"
              alt="AVS Engineering College logo" width="52" height="52" />
            <div className="landing-brand-copy">
              <span className="landing-college-full">AVS ENGINEERING COLLEGE</span>
              <span className="landing-college-short">AVSEC SALEM</span>
              <span className="landing-college-location">Autonomous | Salem, Tamil Nadu</span>
            </div>
          </div>
          <div className="landing-department">
            <span>Department of</span>
            <strong>Artificial Intelligence &amp; Data Science</strong>
          </div>
          <div className="landing-header-actions">
            {canInstall && !isInstalled && (
              <button className="landing-install" type="button" onClick={triggerInstall}
                aria-label="Install AVSEC-SALEM app" title="Install AVSEC-SALEM app">
                <Download size={16} aria-hidden="true" /><span>Install App</span>
              </button>
            )}
            <ThemeToggle className="landing-theme-toggle" />
            <details className="landing-menu" onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}>
              <summary aria-label="Portal navigation menu"><Menu size={20} aria-hidden="true" /></summary>
              <nav aria-label="Portal navigation">
                {PORTALS.map((portal) => (
                  <Link key={portal.id} to={portal.route}>{portal.name} Portal</Link>
                ))}
                {canInstall && !isInstalled && (
                  <button type="button" onClick={triggerInstall}>
                    <Download size={16} aria-hidden="true" /> Install App
                  </button>
                )}
              </nav>
            </details>
          </div>
        </div>
      </header>
      <main className="landing-main">
        <div className="landing-campus">
          <img src="/images/avsec-college-front.jpg"
            alt="Original front view of AVS Engineering College, showing its white and blue building and landscaped entrance"
            width="594" height="334" loading="eager" fetchPriority="high" decoding="async" />
        </div>
        <section className="landing-content" aria-labelledby="landing-title">
          <div className="landing-intro">
            <p className="landing-eyebrow">AI &amp; DS Department</p>
            <h1 id="landing-title" className="landing-title">Department Portal</h1>
            <p className="landing-subtitle">
              A unified digital platform for students, faculty, HOD and administrators.
            </p>
          </div>
          <nav id="portal-selection" className="landing-portals" aria-label="Choose your portal" tabIndex={-1}>
            {PORTALS.map((portal) => {
              const Icon = portal.icon;
              return (
                <Link className={`landing-portal landing-portal-${portal.id}`}
                  key={portal.id} to={portal.route}
                  aria-labelledby={`${portal.id}-portal-title`}
                  aria-describedby={`${portal.id}-portal-description`}>
                  <span className="landing-portal-icon"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span>
                  <div className="landing-portal-copy">
                    <h2 id={`${portal.id}-portal-title`} className="landing-portal-title">{portal.name} Portal</h2>
                    <p id={`${portal.id}-portal-description`} className="landing-portal-description">
                      <span className="landing-description-full">{portal.description}</span>
                      <span className="landing-description-short">{portal.mobileDescription}</span>
                    </p>
                  </div>
                  <span className="landing-portal-login" aria-hidden="true">
                    <span>Login as {portal.name}</span><ArrowRight size={17} />
                  </span>
                  <ArrowRight className="landing-portal-mobile-arrow" size={19} aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
          <p className="landing-access-note">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Secure access. One connected department.</span>
          </p>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <p className="landing-footer-college">AVS Engineering College <span>(Autonomous)</span></p>
          <p>Department of Artificial Intelligence &amp; Data Science</p>
        </div>
        <div className="landing-footer-meta">
          <p>&copy; {new Date().getFullYear()} AVSEC Salem. All rights reserved.</p>
          <p className="landing-photo-credit">Campus photograph: FreeApply.com</p>
        </div>
      </footer>
    </div>
  );
};

export default UniversalPortalHub;
