import { useEffect, useState } from 'react';
import type { Role } from '../types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const PORTAL_TITLES: Record<Role, string> = {
  STUDENT: 'AVSEC-SALEM — Student Portal',
  FACULTY: 'AVSEC-SALEM — Faculty Workspace',
  HOD: 'AVSEC-SALEM — HOD Executive Portal',
  ADMIN: 'AVSEC-SALEM — Department Administrator'
};

export function usePortalPwa(role?: Role) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Unified Manifest & Title
    if (role && PORTAL_TITLES[role]) {
      document.title = PORTAL_TITLES[role];
    } else {
      document.title = 'AVSEC-SALEM — AI & DS Department Portal';
    }

    // Ensure link rel="manifest" always points to canonical /manifest.webmanifest
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = '/manifest.webmanifest';

    // 2. Check if already running in standalone PWA window
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // 3. Register Service Worker
    if ('serviceWorker' in navigator && !import.meta.env.DEV) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('PWA service worker registration notice:', err);
      });
    }

    // 4. Capture BeforeInstallPrompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [role]);

  const triggerInstall = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
      return true;
    }
    return false;
  };

  return {
    canInstall: Boolean(installPrompt) && !isInstalled,
    isInstalled,
    triggerInstall,
    buttonLabel: 'Install AVSEC-SALEM'
  };
}
