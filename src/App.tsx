import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

// Dynamic manifest & title syncer per route for four independent PWAs
const PwaManifestSyncer: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname.toLowerCase();
    let manifest = '/manifest.webmanifest';
    let title = 'AVSEC Salem — AI & Data Science Department Portal';

    if (path.startsWith('/discipline')) {
      title = 'AVS Engineering College — Discipline Monitoring System';
    } else if (path.startsWith('/student')) {
      manifest = '/manifest-student.webmanifest';
      title = 'AVSEC Salem — Student Portal';
    } else if (path.startsWith('/faculty')) {
      manifest = '/manifest-faculty.webmanifest';
      title = 'AVSEC Salem — Faculty Workspace';
    } else if (path.startsWith('/hod')) {
      manifest = '/manifest-hod.webmanifest';
      title = 'AVSEC Salem — HOD Executive Portal';
    } else if (path.startsWith('/admin')) {
      manifest = '/manifest-admin.webmanifest';
      title = 'AVSEC Salem — Department Administrator';
    }

    document.title = title;
    const manifestEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (manifestEl) {
      manifestEl.href = manifest;
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
            {/* Default root route redirects to Student Login */}
            <Route path="/" element={<Navigate to={import.meta.env.VITE_DISCIPLINE_PORTAL === 'true' ? '/discipline/login' : '/student'} replace />} />
            <Route path="/discipline/login" element={<DisciplineLogin />} />

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
            <Route path="/faculty/discipline" element={<Navigate to="/discipline/login" replace />} />
            <Route path="/discipline-issues" element={<Navigate to="/discipline/login" replace />} />
            <Route path="/discipline" element={<DisciplineIssuePage />} />
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

            {/* Fallback for Unknown Paths */}
            <Route path="*" element={<Navigate to={import.meta.env.VITE_DISCIPLINE_PORTAL === 'true' ? '/discipline/login' : '/student'} replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
