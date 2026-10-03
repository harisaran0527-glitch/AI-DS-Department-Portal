import React, { useState } from 'react';
import { Menu, X, LogOut, ShieldCheck, UserCheck, GraduationCap, Crown, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';

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
    <div className="min-h-screen bg-[#080A0F] text-[#94A3B8] flex flex-col md:flex-row antialiased selection:bg-[#A78BFA] selection:text-[#080A0F]">
      {/* MOBILE TOP NAVBAR HEADER */}
      <div className="md:hidden bg-[#0D1017] border-b border-[#252B36] px-4 py-3 flex items-center justify-between z-40 sticky top-0">
        <div className="flex items-center space-x-3">
          <img 
            src="/images/avsec-salem-logo.png" 
            alt="AVSEC Salem Logo" 
            className="h-8 w-auto object-contain shrink-0 drop-shadow-[0_0_8px_rgba(167,139,250,0.3)]" 
          />
          <div>
            <div className="text-xs font-bold text-[#F1F5F9] tracking-wide">AVSEC - SALEM</div>
            <div className="text-[10px] text-[#A78BFA] font-mono font-semibold">{portalRole} WORKSPACE</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-[#12161F] text-[#F1F5F9] hover:bg-[#202633]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* DESKTOP SIDEBAR NAVIGATION */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0D1017] border-r border-[#252B36] flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header Brand */}
        <div className="p-4 border-b border-[#252B36] flex items-center space-x-3 bg-[#0D1017]">
          <img 
            src="/images/avsec-salem-logo.png" 
            alt="AVSEC Salem Logo" 
            className="h-9 w-auto object-contain shrink-0 drop-shadow-[0_0_10px_rgba(167,139,250,0.35)]" 
          />
          <div className="overflow-hidden">
            <div className="text-xs font-extrabold text-[#F1F5F9] tracking-wider truncate">AVSEC - SALEM</div>
            <div className="text-[10px] text-[#22D3EE] font-mono font-bold tracking-wider uppercase truncate">
              AI & DS {portalRole}
            </div>
          </div>
        </div>

        {/* User Identity Profile Card inside Sidebar */}
        <div className="p-4 border-b border-[#252B36] bg-[#12161F]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#171C26] border border-[#252B36] flex items-center justify-center text-xs font-bold text-[#A78BFA] shadow-md">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-[#F1F5F9] truncate">{userName}</div>
              <span className={`inline-block text-[9px] px-2 py-0.2 rounded-full font-bold border ${getRoleBadgeColor()}`}>
                {userRoleTitle}
              </span>
            </div>
          </div>
          {subtitle && (
            <p className="text-[10px] text-[#94A3B8] font-mono mt-2 leading-tight">
              {subtitle}
            </p>
          )}
        </div>

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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'sidebar-nav-active bg-[#171C26] text-[#F1F5F9] font-bold border-l-2 border-[#A78BFA] shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#12161F]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#A78BFA]' : 'text-[#64748B]'}`} />
                    <span className="truncate font-bold">{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-[#202633] text-[#A78BFA] border border-[#A78BFA]/30 font-bold' : 'bg-[#12161F] text-[#94A3B8]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isCollapsible && (
                      <span className="text-[#64748B] p-0.5">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#A78BFA]" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </div>
                </button>

                {/* Render Collapsible Children Submenu */}
                {isCollapsible && isExpanded && item.childrenItems && (
                  <div className="pl-4 pr-1 py-1 space-y-1 border-l border-[#252B36] ml-3">
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
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            isChildActive
                              ? 'sidebar-nav-active bg-[#171C26] text-[#F1F5F9] font-bold border-l-2 border-[#A78BFA]'
                              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#12161F]'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <ChildIcon className={`w-3.5 h-3.5 shrink-0 ${isChildActive ? 'text-[#A78BFA]' : 'text-[#64748B]'}`} />
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
        <div className="p-3 border-t border-[#252B36] bg-[#0D1017]">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 bg-[#12161F] hover:bg-rose-950/80 hover:text-white border border-[#252B36] text-[#94A3B8] py-2 rounded-xl text-xs font-bold transition-all btn-action"
          >
            <LogOut className="w-4 h-4" />
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
        <header className="hidden md:flex bg-[#0D1017] border-b border-[#252B36] px-6 py-3.5 items-center justify-between z-30 sticky top-0">
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
              onClick={onLogout}
              className="flex items-center space-x-2 bg-[#12161F] hover:bg-rose-950/80 hover:text-white border border-[#252B36] text-[#94A3B8] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all btn-action"
            >
              <LogOut className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0 bg-[#080A0F] text-[#94A3B8]">
          {children}
        </main>
      </div>
    </div>
  );
};
