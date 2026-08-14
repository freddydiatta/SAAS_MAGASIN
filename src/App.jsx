import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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
import { syncOfflineSales } from './services/syncService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 heures en cache
      staleTime: 1000 * 15, // 15 secondes au lieu de 5 minutes pour rafraîchir vite
      refetchOnWindowFocus: true, // Recharger automatiquement quand on revient sur la fenêtre
      refetchInterval: 15000, // Rafraîchissement automatique toutes les 15 secondes
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

function SyncAndLoadingGate({ children }) {
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Synchronisation au démarrage si on est en ligne
    syncOfflineSales(queryClient);

    // Écouteur pour le retour du réseau
    const handleOnline = () => {
      console.log('Réseau rétabli, synchronisation des données...');
      syncOfflineSales(queryClient);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Restauration des données hors-ligne...</p>
      </div>
    );
  }

  return children;
}

function App() {
  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <SyncAndLoadingGate>
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
      </SyncAndLoadingGate>
    </PersistQueryClientProvider>
  );
}

export default App;