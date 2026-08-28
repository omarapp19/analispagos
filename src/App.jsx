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
import Login from './pages/Login'; 
import Investments from './pages/Investments';

// Import new pages
import Providers from './pages/Providers';
import Kardex from './pages/Kardex';
import InventoryAdjustments from './pages/InventoryAdjustments';
import NewPurchase from './pages/NewPurchase';
import ClientManagement from './pages/ClientManagement';
import CuentasPorCobrar from './pages/CuentasPorCobrar';
import CuentasPorPagar from './pages/CuentasPorPagar';

// Route protector for authentication
const ProtectedRoute = () => {
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

// Route protector for roles
const RoleProtectedRoute = ({ allowedRoles }) => {
  const role = localStorage.getItem('userRole') || 'cajero';
  
  if (!allowedRoles.includes(role)) {
    // If not allowed, redirect to their home page
    return <Navigate to={role === 'cajero' ? '/pos' : '/'} replace />;
  }
  return <Outlet />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            
            {/* 1. Dashboard (Admin and Supervisor) */}
            <Route element={<RoleProtectedRoute allowedRoles={['administrador', 'supervisor']} />}>
              <Route index element={<DashboardFlow />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="investments" element={<Investments />} />
              <Route path="calendar" element={<CalendarPage />} />
            </Route>

            {/* 2. POS (All Roles) */}
            <Route element={<RoleProtectedRoute allowedRoles={['administrador', 'supervisor', 'cajero']} />}>
              <Route path="pos" element={<Billing />} />
            </Route>

            {/* 3. Inventory (Admin and Supervisor) */}
            <Route path="inventory">
              <Route element={<RoleProtectedRoute allowedRoles={['administrador', 'supervisor']} />}>
                <Route index element={<Inventory />} />
                <Route path="kardex" element={<Kardex />} />
              </Route>
              <Route element={<RoleProtectedRoute allowedRoles={['administrador']} />}>
                <Route path="adjustments" element={<InventoryAdjustments />} />
              </Route>
            </Route>

            {/* 4. Compras (Admin and Supervisor) */}
            <Route path="compras" element={<RoleProtectedRoute allowedRoles={['administrador', 'supervisor']} />}>
              <Route path="proveedores" element={<Providers />} />
              <Route path="facturas" element={<Invoices />} />
              <Route path="nueva" element={<NewPurchase />} />
            </Route>

            {/* 5. Ventas (Admin and Supervisor) */}
            <Route path="ventas" element={<RoleProtectedRoute allowedRoles={['administrador', 'supervisor']} />}>
              <Route path="clientes" element={<ClientManagement />} />
            </Route>

            {/* 6. Finanzas (Admin and Supervisor) */}
            <Route path="finanzas" element={<RoleProtectedRoute allowedRoles={['administrador', 'supervisor']} />}>
              <Route path="cuentas-por-cobrar" element={<CuentasPorCobrar />} />
              <Route path="cuentas-por-pagar" element={<CuentasPorPagar />} />
            </Route>

            {/* 7. Configuration (Only Admin) */}
            <Route element={<RoleProtectedRoute allowedRoles={['administrador']} />}>
              <Route path="settings" element={<Configuration />} />
            </Route>

          </Route>
        </Route>

        {/* Fallback Catch-All Redirect */}
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
