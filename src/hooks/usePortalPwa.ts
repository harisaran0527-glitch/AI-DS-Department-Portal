import { useEffect, useState } from 'react';
import type { Role } from '../types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const PORTAL_META: Record<Role, { title: string; manifest: string; shortName: string }> = {
  STUDENT: {
    title: 'AVSEC Salem — Student Portal',
    manifest: '/manifest-student.webmanifest',
    shortName: 'Install Student App'
  },
  FACULTY: {
    title: 'AVSEC Salem — Faculty Workspace',
    manifest: '/manifest-faculty.webmanifest',
    shortName: 'Install Faculty App'
  },
  HOD: {
    title: 'AVSEC Salem — HOD Executive Portal',
    manifest: '/manifest-hod.webmanifest',
    shortName: 'Install HOD App'
  },
  ADMIN: {
    title: 'AVSEC Salem — Department Administrator',
    manifest: '/manifest-admin.webmanifest',
    shortName: 'Install Admin App'
  }
};

export function usePortalPwa(role: Role) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Dynamic Manifest & Title Switcher
    const meta = PORTAL_META[role];
    if (meta) {
      document.title = meta.title;
      let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = meta.manifest;
    }

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
    buttonLabel: PORTAL_META[role]?.shortName || 'Install Application'
  };
}
