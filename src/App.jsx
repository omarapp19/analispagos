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
import { AuthProvider, useAuth } from './auth/AuthContext';

// Import new pages
import Providers from './pages/Providers';
import Kardex from './pages/Kardex';
import InventoryAdjustments from './pages/InventoryAdjustments';
import NewPurchase from './pages/NewPurchase';
import ClientManagement from './pages/ClientManagement';
import CuentasPorCobrar from './pages/CuentasPorCobrar';
import CuentasPorPagar from './pages/CuentasPorPagar';
import StoreCategories from './pages/store/StoreCategories';
import Vehicles from './pages/store/Vehicles';
import WebOrders from './pages/store/WebOrders';
import WholesaleCustomers from './pages/store/WholesaleCustomers';
import PricingRules from './pages/store/PricingRules';

// Pantalla mientras se resuelve la sesión
const AuthLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-secondary text-sm">Verificando sesión…</div>
);

// Route protector for authentication: sesión de Supabase Auth + perfil activo de staff_profiles
const ProtectedRoute = () => {
  const { session, profile, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!session || !profile) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

// Route protector for roles: el rol sale de staff_profiles (contexto), no de localStorage
const RoleProtectedRoute = ({ allowedRoles }) => {
  const { profile } = useAuth();
  const role = profile?.role;

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={role === 'cajero' ? '/pos' : '/'} replace />;
  }
  return <Outlet />;
};

function App() {
  return (
    <AuthProvider>
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

            {/* 7. Tienda web (Admin and Supervisor) */}
            <Route path="tienda" element={<RoleProtectedRoute allowedRoles={['administrador', 'supervisor']} />}>
              <Route path="pedidos" element={<WebOrders />} />
              <Route path="mayoristas" element={<WholesaleCustomers />} />
              <Route path="reglas" element={<PricingRules />} />
              <Route path="categorias" element={<StoreCategories />} />
              <Route path="vehiculos" element={<Vehicles />} />
            </Route>

            {/* 8. Configuration (Only Admin) */}
            <Route element={<RoleProtectedRoute allowedRoles={['administrador']} />}>
              <Route path="settings" element={<Configuration />} />
            </Route>

          </Route>
        </Route>

        {/* Fallback Catch-All Redirect */}
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;
