import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';

export const DashboardLayout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    });
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    });
    
    const location = useLocation();
    const { selectedBusiness } = useBusiness();
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    // Toggle Dark Mode
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // Save Sidebar State
    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
    }, [isSidebarCollapsed]);

    const getMenuItems = () => {
        const type = selectedBusiness?.type;
        const common = [{ path: '/dashboard', label: 'Aperçu', icon: '🏠' }];
        
        if (type === 'villa') {
            return [
                ...common,
                { path: '/dashboard/calendrier', label: 'Calendrier', icon: '📅' },
                { path: '/dashboard/villas', label: 'Villas', icon: '🏡' },
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
            { path: '/dashboard/caisse', label: 'Caisse', icon: '🛒' },
            { path: '/dashboard/stock', label: 'Stock / Articles', icon: '📦' },
            { path: '/dashboard/historique', label: 'Historique', icon: '🕒' },
            { path: '/dashboard/securite', label: 'Sécurité', icon: '🛡️' },
        ];
        
        if (type === 'pieces_moto') {
            retail.push({ path: '/dashboard/motos', label: 'Motos', icon: '🏍️' });
        }
        
        return retail;
    };

    const menuItems = getMenuItems();

    return (
        <div className="flex h-screen bg-surface font-sans text-primary transition-colors duration-200">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside 
                className={`${isSidebarCollapsed ? 'w-[88px]' : 'w-[280px]'} bg-panel border-r border-slate-100 dark:border-border-theme flex flex-col fixed md:relative z-40 transition-all duration-300 ease-in-out h-full print:hidden ${isMobileMenuOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full md:translate-x-0'}`}
            >
                {/* Logo & Toggle */}
                <div className={`h-20 flex items-center relative ${isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center' : 'justify-between px-6'}`}>
                    <Link to="/" className="flex items-center gap-3 cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-sm shrink-0">
                            <span className="text-white font-bold text-lg">G</span>
                        </div>
                        {(!isSidebarCollapsed || isMobileMenuOpen) && (
                            <span className="font-bold text-lg text-primary tracking-tight whitespace-nowrap">Gestion<span className="text-accent">Pro</span></span>
                        )}
                    </Link>
                    
                    {/* Floating Toggle Button */}
                    <button 
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                        className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-border-theme shadow-sm text-slate-400 hover:text-accent hover:border-accent transition-all hidden md:flex z-50`}
                    >
                        {isSidebarCollapsed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6"/>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6"/>
                            </svg>
                        )}
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
                    {menuItems.map((item, idx) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link 
                                key={idx} 
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                title={isSidebarCollapsed && !isMobileMenuOpen ? item.label : undefined}
                                className={`flex items-center ${isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : 'gap-4 px-4'} py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    isActive 
                                    ? 'bg-orange-50 dark:bg-accent/10 text-accent' 
                                    : 'text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary'
                                }`}
                            >
                                <span className={`text-xl ${isActive ? 'opacity-100' : 'opacity-60 grayscale'}`}>{item.icon}</span>
                                {(!isSidebarCollapsed || isMobileMenuOpen) && (
                                    <span className="whitespace-nowrap">{item.label}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Store Selector */}
                <div className="p-4">
                    <div className={`bg-surface dark:bg-slate-800 rounded-2xl p-4 flex flex-col gap-4 ${isSidebarCollapsed && !isMobileMenuOpen ? 'items-center px-2' : ''}`}>
                        <div className={`flex ${isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center' : 'items-center gap-3'}`}>
                            <div className="w-8 h-8 rounded-full bg-orange-100/50 dark:bg-accent/20 flex items-center justify-center text-accent text-sm shrink-0">
                                🏠
                            </div>
                            {(!isSidebarCollapsed || isMobileMenuOpen) && (
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-primary text-sm truncate">
                                        {selectedBusiness?.name || "Boutique Almadies"}
                                    </div>
                                    <div className="text-xs text-secondary truncate">
                                        {user?.user_metadata?.subscription_plan === 'business' ? 'Pack Business' : 'Pack Essentiel'}
                                    </div>
                                </div>
                            )}
                        </div>
                        {(!isSidebarCollapsed || isMobileMenuOpen) && (
                            <div className="flex flex-col gap-2">
                                <Link to="/businesses" className="w-full bg-panel border border-slate-200 dark:border-border-theme px-4 py-2 rounded-xl text-sm text-center font-medium text-primary hover:border-accent hover:text-accent transition-colors shadow-sm">
                                    Changer de magasin
                                </Link>
                                <button onClick={() => signOut()} className="text-xs text-center text-slate-400 hover:text-red-500 mt-1 transition-colors">
                                    Se déconnecter
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible relative">
                
                {/* Floating Topbar */}
                <header className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center print:hidden pointer-events-none">
                    {/* Mobile Menu Trigger & Search */}
                    <div className="flex items-center gap-4 pointer-events-auto w-full max-w-[400px]">
                        <button 
                            className="md:hidden w-12 h-12 bg-panel shadow-premium rounded-full flex items-center justify-center text-secondary hover:text-primary transition-colors focus:outline-none"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <span className="text-xl">☰</span>
                        </button>

                        <div className="relative w-full hidden sm:block">
                            <input 
                                type="text" 
                                placeholder="Rechercher une vente, un produit, un clie..."
                                className="w-full bg-panel shadow-premium rounded-full py-3.5 px-5 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all border border-slate-100/50 dark:border-border-theme text-primary placeholder:text-slate-400"
                            />
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        </div>
                    </div>

                    {/* Quick Nav Segmented Control */}
                    <div className="hidden lg:flex items-center pointer-events-auto bg-[#262423] dark:bg-slate-800 rounded-full p-1.5 shadow-premium-lg">
                        <Link to="/dashboard" className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${location.pathname === '/dashboard' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                            Aperçu
                        </Link>
                        <Link to="/dashboard/caisse" className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${location.pathname === '/dashboard/caisse' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                            Caisse
                        </Link>
                        <Link to="/dashboard/historique" className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${location.pathname === '/dashboard/historique' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                            Historique
                        </Link>
                        <button 
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="px-3 py-2 rounded-full text-slate-400 hover:text-white transition-colors ml-1 focus:outline-none"
                            title={isDarkMode ? "Passer au thème clair" : "Passer au thème sombre"}
                        >
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                    </div>
                </header>

                {/* Page Content (with top padding to account for absolute header) */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pt-28 md:pt-32">
                    <div className="max-w-6xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};
