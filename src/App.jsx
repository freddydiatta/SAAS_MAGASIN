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
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/caisse" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><Caisse /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/stock" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><Stock /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/historique" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><HistoriqueVentes /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/motos" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><PlaceholderPage title="Gestion des Motos" /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/calendrier" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><PlaceholderPage title="Calendrier des Villas" /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/villas" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><Villas /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/reservations" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><Reservations /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/commandes" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><Commandes /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/menu" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><Menu /></DashboardLayout>
              </ProtectedRoute>
            } />
            </Routes>
          </Router>
        </BusinessProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;