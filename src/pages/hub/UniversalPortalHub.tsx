import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  Compass,
  ShieldCheck,
  ArrowRight,
  Download,
  CheckCircle2,
  Cpu,
  Binary
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SplashScreen } from '../../components/common/SplashScreen';
import { NeuralBackground } from '../../components/common/NeuralBackground';
import { usePortalPwa } from '../../hooks/usePortalPwa';

interface PortalCardConfig {
  id: 'student' | 'faculty' | 'hod' | 'admin';
  name: string;
  badge: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  glowColor: string;
  badgeBg: string;
  buttonGradient: string;
  description: string;
  features: string[];
}

const PORTALS: PortalCardConfig[] = [
  {
    id: 'student',
    name: 'STUDENT PORTAL',
    badge: 'ACADEMIC 360°',
    route: '/student',
    icon: GraduationCap,
    accentColor: 'text-cyan-400',
    glowColor: 'group-hover:border-cyan-400/60 group-hover:shadow-[0_0_28px_rgba(34,211,238,0.25)]',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    buttonGradient: 'from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950',
    description: 'Access complete student performance analytics, attendance insights, internal marks, and automated AI recognition rewards.',
    features: ['360° Profile & CGPA', 'Daily Attendance Logs', 'SkillEdge Benchmarks']
  },
  {
    id: 'faculty',
    name: 'FACULTY PORTAL',
    badge: 'CLASS WORKSPACE',
    route: '/faculty',
    icon: Users,
    accentColor: 'text-blue-400',
    glowColor: 'group-hover:border-blue-400/60 group-hover:shadow-[0_0_28px_rgba(59,130,246,0.25)]',
    badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    buttonGradient: 'from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white',
    description: 'Manage assigned student cohorts, perform bulk attendance & marks upload (CSV, XLSX, PNG OCR), and verify achievements.',
    features: ['Bulk Attendance & OCR', 'Internal Marks Import', 'Section Rank Telemetry']
  },
  {
    id: 'hod',
    name: 'HOD PORTAL',
    badge: 'EXECUTIVE SUITE',
    route: '/hod',
    icon: Compass,
    accentColor: 'text-indigo-400',
    glowColor: 'group-hover:border-indigo-400/60 group-hover:shadow-[0_0_28px_rgba(129,140,248,0.25)]',
    badgeBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    buttonGradient: 'from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white',
    description: 'Departmental leadership oversight, curriculum progress, faculty allocations, student 360 monitoring, and automated AI recognition approvals.',
    features: ['Department Analytics', 'Faculty Workload Matrix', 'AI Reward Approvals']
  },
  {
    id: 'admin',
    name: 'ADMIN PORTAL',
    badge: 'GOVERNANCE',
    route: '/admin',
    icon: ShieldCheck,
    accentColor: 'text-teal-400',
    glowColor: 'group-hover:border-teal-400/60 group-hover:shadow-[0_0_28px_rgba(45,212,191,0.25)]',
    badgeBg: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    buttonGradient: 'from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950',
    description: 'Master institutional configuration, user access governance, subject master catalogue, and tamper-evident audit logs.',
    features: ['Master Subject Control', 'Role Access Management', 'System Audit Telemetry']
  }
];

export const UniversalPortalHub: React.FC = () => {
  const navigate = useNavigate();
  const { canInstall, isInstalled, triggerInstall } = usePortalPwa();

  // Splash Screen State
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hasSeenSplash = sessionStorage.getItem('avsec_splash_shown');
    return !hasSeenSplash;
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('avsec_splash_shown', 'true');
    setShowSplash(false);
  };

  const handleNavigate = (route: string) => {
    navigate(route);
  };

  return (
    <>
      {/* PHASE 3: White Splash Screen */}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} durationMs={2000} />}

      {/* PHASE 4 & 5: Futuristic AI & Robotics Universal Portal Hub */}
      <div className="relative min-h-screen bg-[#060B18] text-slate-100 flex flex-col justify-between overflow-x-hidden select-none font-sans">
        <NeuralBackground />

        {/* TOP BRANDING & NAVIGATION HEADER */}
        <header className="relative z-10 w-full border-b border-cyan-500/15 bg-[#060B18]/75 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            
            {/* College Logo + Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white/95 p-1 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)] border border-cyan-400/30 flex-shrink-0">
                <img
                  src="/images/avsec-salem-logo.png"
                  alt="AVSEC Salem College Logo"
                  className="w-full h-full object-contain"
                  loading="eager"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-wider text-xs sm:text-sm text-white font-mono">
                    AVSEC SALEM
                  </span>
                  <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-400/30">
                    AUTONOMOUS
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-cyan-300 font-medium tracking-wide">
                  AI & DS DEPARTMENT PORTAL
                </span>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-cyan-500/20 text-[11px] font-mono text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>NETWORK CORE ONLINE</span>
              </div>

              {canInstall && !isInstalled && (
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 hover:text-white text-xs font-mono transition-all duration-200 cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.15)]"
                  title="Install AVSEC-SALEM App on your device"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-semibold">Install App</span>
                  <span className="sm:hidden font-semibold">Install</span>
                </button>
              )}
            </div>

          </div>
        </header>

        {/* MAIN HERO & PORTAL SELECTION CONTENT */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 w-full flex-1 flex flex-col justify-center">
          
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center max-w-3xl mx-auto mb-10 sm:mb-12"
          >
            {/* Department Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono mb-4 shadow-[0_0_14px_rgba(34,211,238,0.15)]">
              <Binary className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>DEPARTMENT OF ARTIFICIAL INTELLIGENCE & DATA SCIENCE</span>
            </div>

            {/* Main Title */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white uppercase font-sans">
              AI & DS DEPARTMENT PORTAL
            </h1>

            {/* Subtitle */}
            <p className="mt-2 text-sm sm:text-base font-semibold text-slate-300 tracking-wide">
              AVS Engineering College (Autonomous), Salem
            </p>

            <p className="mt-3 text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Institutional Intelligence Gateway connecting Students, Faculty, Department Leadership, and Administrators. Select your authorized portal node below to proceed.
            </p>
          </motion.div>

          {/* FOUR PORTAL SELECTION CARDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
            {PORTALS.map((portal, idx) => {
              const Icon = portal.icon;
              return (
                <motion.div
                  key={portal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * idx }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${portal.name}`}
                  onClick={() => handleNavigate(portal.route)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigate(portal.route);
                    }
                  }}
                  className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#0B132B]/80 hover:bg-[#0E1A3D]/90 border border-slate-700/60 transition-all duration-300 backdrop-blur-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${portal.glowColor}`}
                >
                  {/* Subtle Top Ambient Gradient */}
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-500/5 to-transparent rounded-t-2xl pointer-events-none" />

                  {/* Card Header: Icon + Badge */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                        <Icon className={`w-6 h-6 ${portal.accentColor}`} />
                      </div>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${portal.badgeBg}`}>
                        {portal.badge}
                      </span>
                    </div>

                    {/* Portal Title */}
                    <h2 className="text-lg font-extrabold text-white tracking-wide group-hover:text-cyan-300 transition-colors">
                      {portal.name}
                    </h2>

                    {/* Description */}
                    <p className="mt-2 text-xs text-slate-300 leading-relaxed min-h-[56px]">
                      {portal.description}
                    </p>

                    {/* Key Capabilities */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
                      {portal.features.map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-cyan-400/70 flex-shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enter Button */}
                  <div className="mt-6 pt-2">
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg bg-gradient-to-r transition-all duration-200 group-hover:shadow-[0_0_18px_rgba(34,211,238,0.3)] pointer-events-none ${portal.buttonGradient}`}
                    >
                      <span>Enter Portal</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Quick Technical Specs Strip */}
          <div className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>PostgreSQL Resilient Cloud Storage</span>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Isolated Role-Based Authentication</span>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-teal-400" />
              <span>Automated Academic 360 & Recognition</span>
            </span>
          </div>

        </main>

        {/* FOOTER */}
        <footer className="relative z-10 w-full border-t border-slate-800/80 bg-[#040812]/90 backdrop-blur-md px-4 sm:px-6 py-5 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:text-left text-center">
              <p className="font-semibold text-slate-300">
                AVS Engineering College (Autonomous), Salem — 636 106
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Department of Artificial Intelligence & Data Science • Approved by AICTE & Affiliated to Anna University
              </p>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              © {new Date().getFullYear()} AVSEC-SALEM. All Rights Reserved.
            </div>
          </div>
        </footer>

      </div>
    </>
  );
};

export default UniversalPortalHub;
