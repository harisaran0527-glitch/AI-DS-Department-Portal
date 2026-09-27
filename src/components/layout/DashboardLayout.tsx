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
        return 'bg-purple-950/80 text-purple-300 border-purple-800';
      case 'HOD':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'FACULTY':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800';
      default:
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800';
    }
  };

  const getRoleIcon = () => {
    switch (portalRole) {
      case 'ADMIN':
        return <ShieldCheck className="w-5 h-5 text-purple-400" />;
      case 'HOD':
        return <Crown className="w-5 h-5 text-amber-400" />;
      case 'FACULTY':
        return <UserCheck className="w-5 h-5 text-cyan-400" />;
      default:
        return <GraduationCap className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E1A] via-[#0E172A] to-[#0A101F] text-slate-100 flex flex-col md:flex-row antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* MOBILE TOP NAVBAR HEADER */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-40 sticky top-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 shadow-md">
            <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
              {getRoleIcon()}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide">AI & DS PORTAL</div>
            <div className="text-[10px] text-cyan-400 font-mono">{portalRole} WORKSPACE</div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* DESKTOP SIDEBAR NAVIGATION */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 shadow-lg shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              {getRoleIcon()}
            </div>
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-white tracking-wide truncate">AI & DS PORTAL</div>
            <div className="text-[10px] text-cyan-400 font-mono font-semibold tracking-wider uppercase truncate">
              {portalRole} CONTROL
            </div>
          </div>
        </div>

        {/* User Identity Profile Card inside Sidebar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-white">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">{userName}</div>
              <span className={`inline-block text-[9px] px-2 py-0.2 rounded-full font-bold border ${getRoleBadgeColor()}`}>
                {userRoleTitle}
              </span>
            </div>
          </div>
          {subtitle && (
            <p className="text-[10px] text-slate-400 font-mono mt-2 leading-tight">
              {subtitle}
            </p>
          )}
        </div>

        {/* Menu Items List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest px-3 py-1.5">
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
                      ? 'bg-gradient-to-r from-amber-500/20 via-indigo-600/30 to-amber-500/10 border border-amber-500/40 text-amber-300 font-bold shadow-lg shadow-amber-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="truncate font-bold">{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-amber-950 border border-amber-700 text-amber-300 font-bold' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isCollapsible && (
                      <span className="text-slate-400 p-0.5">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </div>
                </button>

                {/* Render Collapsible Children Submenu */}
                {isCollapsible && isExpanded && item.childrenItems && (
                  <div className="pl-4 pr-1 py-1 space-y-1 border-l-2 border-slate-800 ml-3">
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
                              ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <ChildIcon className={`w-3.5 h-3.5 shrink-0 ${isChildActive ? 'text-white' : 'text-slate-400'}`} />
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
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-red-950/80 hover:text-red-300 hover:border-red-800 border border-slate-700 text-slate-300 py-2 rounded-xl text-xs font-bold transition-all"
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
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Desktop Header Bar */}
        <header className="hidden md:flex bg-slate-900 border-b border-slate-800 px-6 py-4 items-center justify-between z-30 sticky top-0">
          <div className="flex items-center space-x-3">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getRoleBadgeColor()}`}>
              {portalRole} PORTAL
            </span>
            <div className="text-xs text-slate-400 font-mono">
              Active Section: <strong className="text-white capitalize">{activeTab}</strong>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {headerActions}
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-red-950/80 hover:text-red-300 hover:border-red-800 border border-slate-700 text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0 bg-gradient-to-br from-[#0A0E1A] via-[#0E172A] to-[#0A101F]">
          {children}
        </main>
      </div>
    </div>
  );
};
