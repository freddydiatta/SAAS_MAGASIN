import { Link, useLocation } from 'react-router-dom';

export const DashboardLayout = ({ children }) => {
    const location = useLocation();

    const menuItems = [
        { path: '/dashboard', label: 'Aperçu', icon: '📊' },
        { path: '/dashboard/caisse', label: 'Caisse', icon: '💵' },
        { path: '/dashboard/stock', label: 'Stock Pièces', icon: '🔧' },
        { path: '/dashboard/motos', label: 'Motos', icon: '🏍️' },
        { path: '/dashboard/villas', label: 'Calendrier Villas', icon: '🏠' },
    ];

    return (
        <div className="flex h-screen bg-surface font-sans text-primary">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-slate-200 flex flex-col hidden md:flex z-20">
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
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
                            OM
                        </div>
                        <div>
                            <div className="font-bold text-primary text-sm">Ousmane M.</div>
                            <div className="text-xs text-secondary">Gérant</div>
                        </div>
                    </div>
                    <Link to="/" className="w-full btn-secondary px-4 py-2 text-sm text-center block">
                        Se Déconnecter
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Topbar */}
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
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

                    <div className="flex items-center gap-5">
                        {/* Notifications */}
                        <button className="relative p-2 text-secondary hover:text-primary transition-colors">
                            <span className="text-xl">🔔</span>
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                        </button>
                        
                        {/* Quick Action */}
                        <button className="btn-primary px-5 py-2.5 text-sm hidden sm:flex items-center gap-2">
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
