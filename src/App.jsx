import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { BusinessProvider } from './contexts/BusinessContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequireOwner } from './components/RequireOwner';
import { Landing } from './pages/Landing';
import { syncOfflineSales } from './services/syncService';

// Chargées à la demande : App.jsx importait jusqu'ici toutes les pages du
// tableau de bord (graphiques recharts, génération PDF jspdf/html2canvas,
// tous les verticaux métier) de façon statique — la page d'accueil publique
// devait donc télécharger tout le bundle de l'appli entière (1.7 Mo) avant
// de pouvoir s'afficher, d'où des chargements de 5-10s sur mobile. Seule
// Landing reste importée normalement : c'est la toute première page vue,
// pas de flash de chargement à lui imposer.
const named = (importer, name) => lazy(() => importer().then(m => ({ default: m[name] })));

const DashboardLayout = named(() => import('./layouts/DashboardLayout'), 'DashboardLayout');
const Dashboard = named(() => import('./pages/Dashboard'), 'Dashboard');
const Login = named(() => import('./pages/auth/Login'), 'Login');
const Register = named(() => import('./pages/auth/Register'), 'Register');
const BusinessList = named(() => import('./pages/businesses/BusinessList'), 'BusinessList');
const Stock = named(() => import('./pages/retail/Stock'), 'Stock');
const Caisse = named(() => import('./pages/retail/Caisse'), 'Caisse');
const HistoriqueVentes = named(() => import('./pages/retail/HistoriqueVentes'), 'HistoriqueVentes');
const AuditLogs = named(() => import('./pages/retail/AuditLogs'), 'AuditLogs');
const Villas = named(() => import('./pages/villas/Villas'), 'Villas');
const Reservations = named(() => import('./pages/villas/Reservations'), 'Reservations');
const Menu = named(() => import('./pages/restaurant/Menu'), 'Menu');
const Commandes = named(() => import('./pages/restaurant/Commandes'), 'Commandes');
const Motos = named(() => import('./pages/retail/Motos'), 'Motos');
const Calendrier = named(() => import('./pages/villas/Calendrier'), 'Calendrier');
const AffiliateDashboard = named(() => import('./pages/affiliate/AffiliateDashboard'), 'AffiliateDashboard');
const Parametres = named(() => import('./pages/settings/Parametres'), 'Parametres');
const Depenses = named(() => import('./pages/Depenses'), 'Depenses');

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
    </div>
  );
}

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

    // Filet de sécurité : l'événement 'online' ne se déclenche pas de façon
    // fiable partout (certains navigateurs mobiles, reprise après veille) —
    // sans ce minuteur, une vente hors-ligne pouvait rester bloquée jusqu'au
    // prochain rechargement complet de l'app. syncOfflineSales sort tout de
    // suite si hors-ligne ou déjà en cours, donc ce tick est sans coût la
    // plupart du temps.
    const retryInterval = setInterval(() => syncOfflineSales(queryClient), 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(retryInterval);
    };
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
      <Toaster position="top-right" toastOptions={{ className: 'font-sans' }} />
      <SyncAndLoadingGate>
        <AuthProvider>
          <BusinessProvider>
            <Router>
              <Suspense fallback={<RouteFallback />}>
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
                <Route path="securite" element={
                  <RequireOwner>
                    <AuditLogs />
                  </RequireOwner>
                } />
                <Route path="motos" element={<Motos />} />
                <Route path="calendrier" element={<Calendrier />} />
                <Route path="villas" element={<Villas />} />
                <Route path="reservations" element={<Reservations />} />
                <Route path="commandes" element={<Commandes />} />
                <Route path="menu" element={<Menu />} />
                <Route path="affiliation" element={<AffiliateDashboard />} />
                <Route path="depenses" element={<Depenses />} />
                <Route path="parametres" element={
                  <RequireOwner>
                    <Parametres />
                  </RequireOwner>
                } />
              </Route>
              </Routes>
              </Suspense>
            </Router>
          </BusinessProvider>
        </AuthProvider>
      </SyncAndLoadingGate>
    </PersistQueryClientProvider>
  );
}

export default App;