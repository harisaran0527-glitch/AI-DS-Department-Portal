import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  durationMs = 2000
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(false);
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onComplete]);

  const handleSkip = () => {
    setIsVisible(false);
  };

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          key="avsec-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          onClick={handleSkip}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white cursor-pointer select-none"
          role="presentation"
          aria-label="AVSEC Salem Splash Screen"
        >
          {/* Centered Logo Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.7,
              ease: [0.16, 1, 0.3, 1],
              scale: {
                repeat: 0,
                duration: 1.8,
                ease: 'easeInOut'
              }
            }}
            className="flex flex-col items-center justify-center p-4"
          >
            <img
              src="/images/avsec-salem-logo.png"
              alt="AVS Engineering College (Autonomous), Salem"
              className="w-[120px] sm:w-[150px] h-auto object-contain max-h-[160px] drop-shadow-sm"
              loading="eager"
            />
          </motion.div>

          {/* Subtle Institutional Identity Subtext (minimal, elegant) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-6 flex flex-col items-center text-center px-4"
          >
            <h1 className="text-xs sm:text-sm font-semibold tracking-widest text-slate-800 uppercase font-sans">
              AVS Engineering College
            </h1>
            <p className="text-[10px] sm:text-[11px] font-medium tracking-wider text-slate-500 uppercase mt-0.5 font-mono">
              (Autonomous) • Salem
            </p>
          </motion.div>

          {/* Minimal Loading Pulse Bar */}
          <motion.div
            className="absolute bottom-12 w-28 h-0.5 bg-slate-100 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <motion.div
              className="h-full bg-blue-600 rounded-full"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
