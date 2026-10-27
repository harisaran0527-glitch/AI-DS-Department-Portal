import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UniversalPortalHub } from './pages/hub/UniversalPortalHub';
import { StudentLogin } from './pages/logins/StudentLogin';
import { FacultyLogin } from './pages/logins/FacultyLogin';
import { HODLogin } from './pages/logins/HODLogin';
import { AdminLogin } from './pages/logins/AdminLogin';
import { DisciplineLogin } from './pages/logins/DisciplineLogin';

import { StudentDashboard } from './pages/student/StudentDashboard';
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { DisciplineIssuePage } from './pages/faculty/DisciplineIssuePage';
import { HODDashboard } from './pages/hod/HODDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginRoute } from './components/auth/LoginRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { ThemeProvider } from './context/ThemeContext';

// Dynamic title syncer preserving canonical AVSEC-SALEM manifest
const PwaManifestSyncer: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname.toLowerCase();
    let title = 'AVSEC-SALEM — AI & DS Department Portal';

    if (path.startsWith('/student')) {
      title = 'AVSEC-SALEM — Student Portal';
    } else if (path.startsWith('/faculty')) {
      title = 'AVSEC-SALEM — Faculty Workspace';
    } else if (path.startsWith('/hod')) {
      title = 'AVSEC-SALEM — HOD Executive Portal';
    } else if (path.startsWith('/admin')) {
      title = 'AVSEC-SALEM — Department Administrator';
    } else if (path.startsWith('/discipline')) {
      title = 'AVS Engineering College — Discipline System';
    }

    document.title = title;
    const manifestEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (manifestEl) {
      manifestEl.href = '/manifest.webmanifest';
    }
  }, [location.pathname]);

  return null;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <PwaManifestSyncer />
        <ErrorBoundary fallbackTitle="Department Portal Application Error">
          <Routes>
            {/* Common Entry Point: AVSEC Salem Splash + Futuristic Universal Portal Hub */}
            <Route path="/" element={<UniversalPortalHub />} />

            {/* Four Completely Separate Portal Login Routes */}
            <Route path="/student" element={<LoginRoute role="STUDENT"><StudentLogin /></LoginRoute>} />
            <Route path="/faculty" element={<LoginRoute role="FACULTY"><FacultyLogin /></LoginRoute>} />
            <Route path="/hod" element={<LoginRoute role="HOD"><HODLogin /></LoginRoute>} />
            <Route path="/admin" element={<LoginRoute role="ADMIN"><AdminLogin /></LoginRoute>} />

            {/* Dashboard Routes with Protected Role Access & Isolated Error Boundaries */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']} loginRoute="/student">
                  <ErrorBoundary fallbackTitle="Student Dashboard Error" loginRoute="/student">
                    <StudentDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/faculty/dashboard"
              element={
                <ProtectedRoute allowedRoles={['FACULTY']} loginRoute="/faculty">
                  <ErrorBoundary fallbackTitle="Faculty Dashboard Error" loginRoute="/faculty">
                    <FacultyDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hod/dashboard"
              element={
                <ProtectedRoute allowedRoles={['HOD']} loginRoute="/hod">
                  <ErrorBoundary fallbackTitle="HOD Executive Dashboard Error" loginRoute="/hod">
                    <HODDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']} loginRoute="/admin">
                  <ErrorBoundary fallbackTitle="Admin Dashboard Error" loginRoute="/admin">
                    <AdminDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

            {/* Independent Discipline Isolated Routes */}
            <Route path="/discipline/login" element={<DisciplineLogin />} />
            <Route path="/discipline-issues" element={<Navigate to="/discipline/login" replace />} />
            <Route path="/discipline" element={<DisciplineIssuePage />} />

            {/* Fallback for Unknown Paths */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
