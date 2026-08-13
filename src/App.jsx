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
                <DashboardLayout><PlaceholderPage title="Caisse / Point de Vente" /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/stock" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><PlaceholderPage title="Gestion de Stock" /></DashboardLayout>
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
                <DashboardLayout><PlaceholderPage title="Gestion des Villas" /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/reservations" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><PlaceholderPage title="Historique des Réservations" /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/commandes" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><PlaceholderPage title="Gestion des Commandes" /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/menu" element={
              <ProtectedRoute requireBusiness={true}>
                <DashboardLayout><PlaceholderPage title="Gestion du Menu" /></DashboardLayout>
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