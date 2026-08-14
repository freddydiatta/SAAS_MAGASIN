import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
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
import { Motos } from './pages/retail/Motos';
import { Calendrier } from './pages/villas/Calendrier';
import { AffiliateDashboard } from './pages/affiliate/AffiliateDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 heures en cache
      staleTime: 1000 * 60 * 5, // Les données restent fraîches pendant 5 minutes
      refetchOnWindowFocus: false, // Ne pas recharger automatiquement quand on revient sur la fenêtre
      retry: 1, // Limiter les tentatives en cas d'erreur
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => await get(key),
    setItem: async (key, value) => await set(key, value),
    removeItem: async (key) => await del(key),
  },
});

function App() {
  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ persister: asyncStoragePersister }}
    >
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
              <Route path="motos" element={<Motos />} />
              <Route path="calendrier" element={<Calendrier />} />
              <Route path="villas" element={<Villas />} />
              <Route path="reservations" element={<Reservations />} />
              <Route path="commandes" element={<Commandes />} />
              <Route path="menu" element={<Menu />} />
              <Route path="affiliation" element={<AffiliateDashboard />} />
            </Route>
            </Routes>
          </Router>
        </BusinessProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;