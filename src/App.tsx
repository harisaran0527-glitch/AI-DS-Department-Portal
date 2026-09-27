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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route redirects to Student Login */}
        <Route path="/" element={<Navigate to="/student" replace />} />

        {/* Four Completely Separate Portal Login Routes */}
        <Route path="/student" element={<StudentLogin />} />
        <Route path="/faculty" element={<FacultyLogin />} />
        <Route path="/hod" element={<HODLogin />} />
        <Route path="/admin" element={<AdminLogin />} />

        {/* Dashboard Routes */}
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
        <Route path="/hod/dashboard" element={<HODDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
