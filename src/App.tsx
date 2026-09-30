import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudentLogin } from './pages/logins/StudentLogin';
import { FacultyLogin } from './pages/logins/FacultyLogin';
import { HODLogin } from './pages/logins/HODLogin';
import { AdminLogin } from './pages/logins/AdminLogin';

import { StudentDashboard } from './pages/student/StudentDashboard';
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { HODDashboard } from './pages/hod/HODDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginRoute } from './components/auth/LoginRoute';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default root route redirects to Student Login */}
        <Route path="/" element={<Navigate to="/student" replace />} />

        {/* Four Completely Separate Portal Login Routes */}
        <Route path="/student" element={<LoginRoute role="STUDENT"><StudentLogin /></LoginRoute>} />
        <Route path="/faculty" element={<LoginRoute role="FACULTY"><FacultyLogin /></LoginRoute>} />
        <Route path="/hod" element={<LoginRoute role="HOD"><HODLogin /></LoginRoute>} />
        <Route path="/admin" element={<LoginRoute role="ADMIN"><AdminLogin /></LoginRoute>} />

        {/* Dashboard Routes with Protected Role Access */}
        <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['STUDENT']} loginRoute="/student"><StudentDashboard /></ProtectedRoute>} />
        <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['FACULTY']} loginRoute="/faculty"><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/hod/dashboard" element={<ProtectedRoute allowedRoles={['HOD']} loginRoute="/hod"><HODDashboard /></ProtectedRoute>} />
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['ADMIN']} loginRoute="/admin"><AdminDashboard /></ProtectedRoute>} />

        {/* Fallback for Unknown Paths */}
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
