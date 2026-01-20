import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import DashboardFlow from './pages/DashboardFlow';
import Analytics from './pages/Analytics';
import CalendarPage from './pages/Calendar';
import Configuration from './pages/Configuration';
import Invoices from './pages/Invoices';
import DailySales from './pages/DailySales';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardFlow />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="daily-sales" element={<DailySales />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<Configuration />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
