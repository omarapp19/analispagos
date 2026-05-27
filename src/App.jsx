import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import DashboardFlow from './pages/DashboardFlow';
import Analytics from './pages/Analytics';
import CalendarPage from './pages/Calendar';
import Configuration from './pages/Configuration';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import Login from './pages/Login'; // Standalone login page

// Safe route protector component
const ProtectedRoute = () => {
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Layout and Admin Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardFlow />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="billing" element={<Billing />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="settings" element={<Configuration />} />
          </Route>
        </Route>

        {/* Fallback Catch-All Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
