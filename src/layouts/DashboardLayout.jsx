import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';

export const DashboardLayout = ({ children }) => {
    const location = useLocation();
    const { selectedBusiness } = useBusiness();
    const { user } = useAuth();
    const navigate = useNavigate();

    const getMenuItems = () => {
        const type = selectedBusiness?.type;
        
        const common = [{ path: '/dashboard', label: 'Aperçu', icon: '📊' }];
        
        if (type === 'villa') {
            return [
                ...common,
                { path: '/dashboard/calendrier', label: 'Calendrier', icon: '📅' },
                { path: '/dashboard/villas', label: 'Villas', icon: '🏠' },
                { path: '/dashboard/reservations', label: 'Réservations', icon: '📝' },
            ];
        }
        
        if (type === 'restaurant') {
            return [
                ...common,
                { path: '/dashboard/caisse', label: 'Caisse', icon: '💵' },
                { path: '/dashboard/commandes', label: 'Commandes', icon: '🍽️' },
                { path: '/dashboard/menu', label: 'Menu', icon: '📋' },
            ];
        }
        
        // Default (Retail: pieces_moto, quincaillerie, boutique)
        const retail = [
            ...common,
            { path: '/dashboard/caisse', label: 'Caisse', icon: '💵' },
            { path: '/dashboard/stock', label: 'Stock / Articles', icon: '📦' },
        ];
        
        if (type === 'pieces_moto') {
            retail.push({ path: '/dashboard/motos', label: 'Motos', icon: '🏍️' });
        }
        
        return retail;
    };

    const menuItems = getMenuItems();

    return (
        <div className="flex h-screen bg-surface font-sans text-primary">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-slate-200 flex flex-col hidden md:flex z-20 print:hidden">
                {/* Logo */}
                <div className="h-20 border-b border-slate-200 flex items-center px-6">
                    <Link to="/" className="flex items-center gap-3 cursor-pointer">
                        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-xl">G</span>
                        </div>
                        <span className="font-bold text-xl text-primary tracking-tight">Gestion<span className="text-accent">Pro</span></span>
                    </Link>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-1 mt-4">
                    {menuItems.map((item, idx) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link 
                                key={idx} 
                                to={item.path}
                                className={`flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
                                    isActive 
                                    ? 'bg-orange-50 text-accent' 
                                    : 'text-secondary hover:bg-slate-50 hover:text-primary'
                                }`}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent text-xl">
                            🏢
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-primary text-sm truncate" title={selectedBusiness?.name}>
                                {selectedBusiness?.name || "Mon Magasin"}
                            </div>
                            <div className="text-xs text-secondary truncate">
                                {user?.user_metadata?.subscription_plan === 'business' ? 'Pack Business' : 'Pack Essentiel'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <Link to="/businesses" className="w-full btn-secondary bg-white border border-slate-200 px-4 py-2 text-sm text-center block text-slate-600 hover:text-accent">
                            Changer de magasin
                        </Link>
                        <Link to="/" onClick={() => supabase.auth.signOut()} className="w-full text-red-500 hover:bg-red-50 rounded-lg px-4 py-2 text-sm text-center font-medium transition-colors">
                            Se Déconnecter
                        </Link>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible">
                {/* Topbar */}
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 print:hidden">
                    <div className="flex items-center gap-4 flex-1">
                        {/* Search Bar */}
                        <div className="relative w-full max-w-md hidden sm:block">
                            <input 
                                type="text" 
                                placeholder="Rechercher une pièce, un client..."
                                className="w-full bg-slate-100 rounded-lg py-2.5 px-4 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">🔍</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-5 relative">
                        {/* Notifications */}
                        <div className="relative group">
                            <button className="relative p-2 text-secondary hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 rounded-full">
                                <span className="text-xl">🔔</span>
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                            </button>
                            
                            {/* Dropdown Notifications */}
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-top-right">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-bold text-primary">Notifications</h3>
                                    <span className="bg-accent/10 text-accent text-xs font-bold px-2 py-1 rounded-full">1 Nouvelle</span>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50">
                                        <div className="flex gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                                ✨
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-primary">Bienvenue sur GestionPro !</p>
                                                <p className="text-xs text-secondary mt-1">Configurez votre premier magasin pour commencer.</p>
                                                <p className="text-xs text-slate-400 mt-2">À l'instant</p>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Empty state (optional) */}
                                    {/* <div className="p-8 text-center text-secondary">
                                        <span className="text-4xl mb-3 block">📭</span>
                                        <p className="text-sm">Aucune notification pour le moment.</p>
                                    </div> */}
                                </div>
                                <div className="p-3 text-center border-t border-slate-100">
                                    <button className="text-sm font-medium text-accent hover:text-accentHover">Tout marquer comme lu</button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Quick Action */}
                        <button onClick={() => navigate('/dashboard/caisse')} className="btn-primary px-5 py-2.5 text-sm hidden sm:flex items-center gap-2">
                            <span>➕</span> Nouvelle Vente
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
};
