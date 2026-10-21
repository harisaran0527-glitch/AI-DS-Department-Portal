import React, { useState, useEffect } from 'react';
import { Menu, X, LogOut, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';

export type MenuItem = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  childrenItems?: MenuItem[];
};

import { ThemeToggle } from '../common/ThemeToggle';
import { useTheme } from '../../context/ThemeContext';

interface DashboardLayoutProps {
  portalRole: 'STUDENT' | 'FACULTY' | 'HOD' | 'ADMIN';
  userName: string;
  userRoleTitle: string;
  subtitle?: string;
  menuItems: MenuItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  onLogout: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  portalRole,
  userName,
  userRoleTitle,
  subtitle,
  menuItems,
  activeTab,
  onSelectTab,
  onLogout,
  headerActions,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();

  // Apply dashboard theme while mounted inside portal dashboard, and reset to fixed dark on exit
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
    }

    return () => {
      // Clean up when unmounting (leaving dashboard for any reason): restore fixed dark mode
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
    };
  }, [theme]);

  const handleLogoutWithThemeReset = () => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
    onLogout();
  };

  // Lock body scroll when mobile navigation drawer is active
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Dynamic role badges
  const getRoleBadgeColor = () => {
    switch (portalRole) {
      case 'ADMIN':
        return 'bg-purple-950/70 text-purple-300 border-purple-800/60';
      case 'HOD':
        return 'bg-amber-950/70 text-amber-300 border-amber-800/60';
      case 'FACULTY':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60';
      default:
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60';
    }
  };

  return (
    <div className="min-h-screen bg-[#080A0F] text-[#94A3B8] flex flex-col md:flex-row antialiased selection:bg-[#A78BFA] selection:text-[#080A0F] overflow-x-hidden portal-dashboard-root">
      {/* MOBILE TOP NAVBAR HEADER */}
      <div className="md:hidden bg-[#0D1017] border-b border-[#252B36] px-3 sm:px-4 py-2.5 pt-safe flex items-center justify-between z-40 sticky top-0 shadow-lg">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <img
            src="/images/avsec-salem-logo.png"
            alt="AVSEC Salem Logo"
            className="h-7 w-auto max-h-7 max-w-[28px] object-contain shrink-0 drop-shadow-[0_0_8px_rgba(167,139,250,0.3)]"
          />
          <div className="overflow-hidden truncate">
            <div className="text-xs font-bold text-[#F1F5F9] tracking-wide truncate">AVSEC SALEM</div>
            <div className="text-[10px] text-[#A78BFA] font-mono font-semibold flex items-center space-x-1 truncate">
              <span>{portalRole}</span>
              <span className="text-[#64748B]">•</span>
              <span className="text-[#22D3EE] font-sans truncate">{activeTab}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="touch-target p-2 rounded-xl bg-[#12161F] text-[#F1F5F9] hover:bg-[#202633] active:scale-95 border border-[#252B36] transition-all"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5 text-[#A78BFA]" />}
          </button>
        </div>
      </div>

      {/* MOBILE / DESKTOP SIDEBAR NAVIGATION */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0D1017] border-r border-[#252B36] flex flex-col transition-transform duration-300 ease-in-out md:static md:w-64 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header Brand */}
        <div className="p-4 pt-safe border-b border-[#252B36] flex items-center justify-between bg-[#0D1017]">
          <div className="flex items-center space-x-3 overflow-hidden">
            <img
              src="/images/avsec-salem-logo.png"
              alt="AVSEC Salem Logo"
              className="h-8 w-auto max-h-8 max-w-[32px] object-contain shrink-0 drop-shadow-[0_0_10px_rgba(167,139,250,0.35)]"
            />
            <div className="overflow-hidden">
              <div className="text-xs font-extrabold text-[#F1F5F9] tracking-wider truncate">AVSEC - SALEM</div>
              <div className="text-[10px] text-[#22D3EE] font-mono font-bold tracking-wider uppercase truncate">
                AI & DS {portalRole}
              </div>
            </div>
          </div>
          {/* Mobile close button inside drawer */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
            className="md:hidden touch-target p-1.5 rounded-lg bg-[#12161F] text-[#94A3B8] hover:text-white border border-[#252B36]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Identity Profile Card inside Sidebar */}
        <div className="p-3.5 sm:p-4 border-b border-[#252B36] bg-[#12161F]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#171C26] border border-[#252B36] flex items-center justify-center text-xs font-bold text-[#A78BFA] shadow-md shrink-0">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden min-w-0">
              <div className="text-xs font-bold text-[#F1F5F9] truncate">{userName}</div>
              <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full font-bold border ${getRoleBadgeColor()}`}>
                {userRoleTitle}
              </span>
            </div>
          </div>
          {subtitle && (
            <p className="text-[10px] text-[#94A3B8] font-mono mt-2 leading-tight truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Mobile Header Actions inside Drawer */}
        {headerActions && (
          <div className="md:hidden p-3 border-b border-[#252B36] bg-[#080A0F]/60">
            {headerActions}
          </div>
        )}

        {/* Menu Items List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-[#171C26]">
          <div className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-widest px-3 py-1.5">
            Navigation Menu
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon || Sparkles;
            const isAnyChildActive = Boolean(item.childrenItems?.some((c) => c.id === activeTab));
            const isActive = activeTab === item.id || isAnyChildActive;
            const isCollapsible = Boolean(item.isCollapsible);
            const isExpanded = Boolean(item.isExpanded || (isCollapsible && isAnyChildActive));

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => {
                    if (isCollapsible && item.onToggleExpand) {
                      item.onToggleExpand();
                    } else {
                      onSelectTab(item.id);
                      setMobileMenuOpen(false);
                    }
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'sidebar-nav-active bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-indigo-950/60 text-white font-extrabold border-l-4 border-indigo-400 shadow-md ring-1 ring-indigo-500/20'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#12161F] active:bg-[#171C26]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-[#64748B]'}`} />
                    <span className="truncate font-bold">{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-indigo-900/80 text-indigo-200 border border-indigo-400/30 font-bold' : 'bg-[#12161F] text-[#94A3B8]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isCollapsible && (
                      <span className="text-[#64748B] p-0.5">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </div>
                </button>

                {/* Render Collapsible Children Submenu */}
                {isCollapsible && isExpanded && item.childrenItems && (
                  <div className="pl-3 pr-1 py-1 space-y-1 border-l border-[#252B36] ml-3">
                    {item.childrenItems.map((child) => {
                      const ChildIcon = child.icon || Sparkles;
                      const isChildActive = activeTab === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => {
                            onSelectTab(child.id);
                            setMobileMenuOpen(false);
                          }}
                          aria-current={isChildActive ? 'page' : undefined}
                          className={`w-full flex items-center justify-between px-2.5 py-2 min-h-[44px] rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                            isChildActive
                              ? 'sidebar-child-active bg-cyan-950/60 text-cyan-200 font-extrabold border-l-4 border-cyan-400 shadow-sm'
                              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#12161F] active:bg-[#171C26]'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <ChildIcon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isChildActive ? 'text-cyan-400' : 'text-[#64748B]'}`} />
                            <span className="truncate">{child.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-3 pb-safe border-t border-[#252B36] bg-[#0D1017]">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogoutWithThemeReset();
            }}
            className="w-full min-h-[44px] flex items-center justify-center space-x-2 bg-[#12161F] hover:bg-rose-950/80 hover:text-white border border-[#252B36] hover:border-rose-800 text-[#94A3B8] py-2.5 rounded-xl text-xs font-bold transition-all btn-action active:scale-95"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Logout Portal</span>
          </button>
        </div>
      </aside>

      {/* MOBILE BACKDROP OVERLAY */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-[#080A0F]/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#080A0F]">
        {/* Top Desktop Header Bar */}
        <header className="hidden md:flex bg-[#0D1017] border-b border-[#252B36] px-6 py-3.5 items-center justify-between z-30 sticky top-0 shadow-md">
          <div className="flex items-center space-x-3">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getRoleBadgeColor()}`}>
              {portalRole} PORTAL
            </span>
            <div className="text-xs text-[#94A3B8] font-mono">
              Active Section: <strong className="text-[#F1F5F9] capitalize font-bold">{activeTab}</strong>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            {headerActions}
            <button
              onClick={handleLogoutWithThemeReset}
              className="flex items-center space-x-2 bg-[#12161F] hover:bg-rose-950/80 hover:text-white border border-[#252B36] hover:border-rose-800 text-[#94A3B8] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all btn-action"
            >
              <LogOut className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-safe overflow-y-auto overflow-x-hidden min-w-0 max-w-full bg-[#080A0F] text-[#94A3B8]">
          {children}
        </main>
      </div>
    </div>
  );
};
