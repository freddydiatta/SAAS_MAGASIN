import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { BusinessProvider } from './contexts/BusinessContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { BusinessList } from './pages/businesses/BusinessList';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { Stock } from './pages/retail/Stock';
import { Caisse } from './pages/retail/Caisse';
import { HistoriqueVentes } from './pages/retail/HistoriqueVentes';
import { AuditLogs } from './pages/retail/AuditLogs';
import { Villas } from './pages/villas/Villas';
import { Reservations } from './pages/villas/Reservations';
import { Menu } from './pages/restaurant/Menu';
import { Commandes } from './pages/restaurant/Commandes';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BusinessProvider>
          <Router>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected Routes */}
            <Route path="/businesses" element={
              <ProtectedRoute requireBusiness={false}>
                <BusinessList />
              </ProtectedRoute>
            } />
            
            {/* Dashboard Routes (wrapped in Layout) */}
            <Route path="/dashboard" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="caisse" element={<Caisse />} />
              <Route path="stock" element={<Stock />} />
              <Route path="historique" element={<HistoriqueVentes />} />
              <Route path="securite" element={<AuditLogs />} />
              <Route path="motos" element={<PlaceholderPage title="Gestion des Motos" />} />
              <Route path="calendrier" element={<PlaceholderPage title="Calendrier des Villas" />} />
              <Route path="villas" element={<Villas />} />
              <Route path="reservations" element={<Reservations />} />
              <Route path="commandes" element={<Commandes />} />
              <Route path="menu" element={<Menu />} />
            </Route>
            </Routes>
          </Router>
        </BusinessProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;