import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';
import { BillingModal } from '../components/BillingModal';
import { SwitchUserModal } from '../components/SwitchUserModal';
import { ReturnToOwnerModal } from '../components/ReturnToOwnerModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineStatusBadge } from '../components/OfflineStatusBadge';
import { getPlanLabel } from '../config/pricing';

export const DashboardLayout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSwitchUserOpen, setIsSwitchUserOpen] = useState(false);
    const [isReturnToOwnerOpen, setIsReturnToOwnerOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    });

    const location = useLocation();
    const { selectedBusiness, currentMember, isCashier } = useBusiness();
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    // Save Sidebar State
    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
    }, [isSidebarCollapsed]);

    // Les accès du quotidien toujours visibles, le reste rangé dans un groupe
    // « Paramètres » replié : treize entrées à la suite noyaient les gestes de
    // tous les jours au milieu de pages qu'on ouvre rarement. Dépenses,
    // Inventaires et Fournisseurs restent dehors : on s'en sert chaque semaine
    // au dépôt, les cacher derrière un clic de plus ralentissait le travail.
    const getMenu = () => {
        const type = selectedBusiness?.type;
        const home = { path: '/dashboard', label: 'Aperçu', icon: '🏠' };
        const dettes = { path: '/dashboard/dettes', label: 'Dettes', icon: '🤝' };
        const depenses = { path: '/dashboard/depenses', label: 'Dépenses', icon: '💸' };
        let primary;
        const secondary = [];

        if (type === 'villa') {
            primary = [
                home,
                { path: '/dashboard/calendrier', label: 'Calendrier', icon: '📅' },
                { path: '/dashboard/villas', label: 'Villas', icon: '🏡' },
                { path: '/dashboard/reservations', label: 'Réservations', icon: '📝' },
                depenses,
                dettes,
            ];
        } else if (type === 'restaurant') {
            primary = [
                home,
                { path: '/dashboard/caisse', label: 'Caisse', icon: '💵' },
                { path: '/dashboard/commandes', label: 'Commandes', icon: '🍽️' },
                { path: '/dashboard/menu', label: 'Menu', icon: '📋' },
                depenses,
                dettes,
            ];
        } else {
            // Commerce (pieces_moto, quincaillerie, boutique)
            primary = [
                home,
                { path: '/dashboard/caisse', label: 'Caisse', icon: '🛒' },
                { path: '/dashboard/stock', label: 'Stock', icon: '📦' },
                depenses,
                dettes,
                { path: '/dashboard/historique', label: 'Historique', icon: '🕒' },
                { path: '/dashboard/inventaires', label: 'Inventaires', icon: '🧮' },
            ];
            if (type === 'pieces_moto') {
                secondary.push({ path: '/dashboard/motos', label: 'Motos', icon: '🏍️' });
            }
        }

        // Réservé au propriétaire : programme d'affiliation, logs de
        // sécurité et gestion du commerce/équipe. Un caissier n'a pas de
        // lien de parrainage ni de commissions à consulter — ce n'est pas
        // juste une histoire d'affichage : sans ce filtre, un caissier
        // visitant /dashboard/affiliation se voyait créer sa propre fiche
        // affilié (AffiliateDashboard crée le profil manquant pour
        // n'importe quel compte connecté), un artefact de données parasite.
        if (!isCashier) {
            if (type !== 'villa' && type !== 'restaurant') {
                // Fournisseurs : réservé au propriétaire comme Sécurité, les
                // prix d'achat négociés y sont visibles (marge par produit).
                // Visible en permanence, en dernier, comme avant le groupe.
                primary.push({ path: '/dashboard/fournisseurs', label: 'Fournisseurs', icon: '🚚' });
                // Finances : bénéfice net et chiffre d'affaires total, encore
                // plus sensible que les marges — réservé au propriétaire.
                secondary.push({ path: '/dashboard/finances', label: 'Finances', icon: '📈' });
                secondary.push({ path: '/dashboard/securite', label: 'Sécurité', icon: '🛡️' });
            }
            secondary.push({ path: '/dashboard/affiliation', label: 'Affiliation', icon: '💰' });
            secondary.push({ path: '/dashboard/parametres', label: 'Abonnement et équipe', icon: '👥' });
        }

        return { primary, secondary };
    };

    const { primary: primaryItems, secondary: secondaryItems } = getMenu();
    const isOnSecondaryPage = secondaryItems.some((item) => item.path === location.pathname);
    // Le groupe s'ouvre tout seul quand on est sur l'une de ses pages : sinon
    // l'entrée active serait cachée et on ne saurait plus où l'on se trouve.
    // Déduit de la page courante plutôt que synchronisé par un effet ; le
    // replier à la main sur une page du groupe reste possible, et ne vaut que
    // pour cette page.
    const [manuallyOpen, setManuallyOpen] = useState(false);
    const [collapsedOnPath, setCollapsedOnPath] = useState(null);
    const isSettingsOpen = manuallyOpen || (isOnSecondaryPage && collapsedOnPath !== location.pathname);

    const isCompact = isSidebarCollapsed && !isMobileMenuOpen;

    const renderLink = (item, { nested = false } = {}) => {
        const isActive = location.pathname === item.path;
        return (
            <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                title={isCompact ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center ${isCompact ? 'justify-center px-0' : `gap-4 ${nested ? 'pl-6 pr-4' : 'px-4'}`} ${nested ? 'py-2' : 'py-2.5'} rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                    ? 'bg-orange-50 dark:bg-accent/10 text-accent'
                    : 'text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary'
                }`}
            >
                <span className={`${nested ? 'text-lg' : 'text-xl'} ${isActive ? 'opacity-100' : 'opacity-60 grayscale'}`}>{item.icon}</span>
                {!isCompact && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
        );
    };

    const toggleSettings = () => {
        // Menu réduit à des icônes : ouvrir le groupe n'aurait rien à montrer,
        // on déploie d'abord le menu.
        if (isCompact) {
            setIsSidebarCollapsed(false);
            setManuallyOpen(true);
            setCollapsedOnPath(null);
            return;
        }
        if (isSettingsOpen) {
            setManuallyOpen(false);
            setCollapsedOnPath(location.pathname);
        } else {
            setManuallyOpen(true);
            setCollapsedOnPath(null);
        }
    };

    const isExpired = selectedBusiness?.subscription_end_date
        ? new Date(selectedBusiness.subscription_end_date) < new Date()
        : selectedBusiness?.subscription_status !== 'active';

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
                        aria-label={isSidebarCollapsed ? "Déployer le menu" : "Réduire le menu"}
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
                    {primaryItems.map((item) => renderLink(item))}

                    {secondaryItems.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-border-theme">
                            <button
                                type="button"
                                onClick={toggleSettings}
                                aria-expanded={isSettingsOpen && !isCompact}
                                aria-controls="sidebar-settings-group"
                                title={isCompact ? 'Paramètres' : undefined}
                                className={`w-full flex items-center ${isCompact ? 'justify-center px-0' : 'gap-4 px-4'} py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    isOnSecondaryPage && (!isSettingsOpen || isCompact)
                                    ? 'bg-orange-50 dark:bg-accent/10 text-accent'
                                    : 'text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary'
                                }`}
                            >
                                <span className={`text-xl ${isOnSecondaryPage ? 'opacity-100' : 'opacity-60 grayscale'}`}>⚙️</span>
                                {!isCompact && (
                                    <>
                                        <span className="whitespace-nowrap flex-1 text-left">Paramètres</span>
                                        <svg
                                            aria-hidden="true"
                                            xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                            className={`transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`}
                                        >
                                            <path d="m9 18 6-6-6-6" />
                                        </svg>
                                    </>
                                )}
                            </button>
                            {isSettingsOpen && !isCompact && (
                                <div id="sidebar-settings-group" className="mt-1 space-y-0.5">
                                    {secondaryItems.map((item) => renderLink(item, { nested: true }))}
                                </div>
                            )}
                        </div>
                    )}
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
                                        {isCashier
                                            ? `Caissier · ${currentMember?.name || ''}`
                                            : getPlanLabel(user?.user_metadata?.subscription_plan)}
                                    </div>
                                </div>
                            )}
                        </div>
                        {(!isSidebarCollapsed || isMobileMenuOpen) && (
                            <div className="flex flex-col gap-2">
                                <Link to="/businesses" className="w-full bg-panel border border-slate-200 dark:border-border-theme px-4 py-2 rounded-xl text-sm text-center font-medium text-primary hover:border-accent hover:text-accent transition-colors shadow-sm">
                                    Changer de magasin
                                </Link>
                                {/* Un caissier peut aussi basculer directement vers un
                                    autre caissier (SwitchUserModal liste tous les
                                    caissiers actifs, peu importe qui est connecté),
                                    sans devoir d'abord repasser par le propriétaire. */}
                                <button onClick={() => setIsSwitchUserOpen(true)} className="w-full bg-panel border border-slate-200 dark:border-border-theme px-4 py-2 rounded-xl text-sm text-center font-medium text-primary hover:border-accent hover:text-accent transition-colors shadow-sm">
                                    Changer d'utilisateur
                                </button>
                                {isCashier && (
                                    <button onClick={() => setIsReturnToOwnerOpen(true)} className="w-full bg-panel border border-slate-200 dark:border-border-theme px-4 py-2 rounded-xl text-sm text-center font-medium text-primary hover:border-accent hover:text-accent transition-colors shadow-sm">
                                        Revenir au propriétaire
                                    </button>
                                )}
                                <button onClick={() => signOut()} className="text-xs text-center text-slate-400 hover:text-red-500 mt-1 transition-colors">
                                    Se déconnecter
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <SwitchUserModal isOpen={isSwitchUserOpen} onClose={() => setIsSwitchUserOpen(false)} />
            <ReturnToOwnerModal isOpen={isReturnToOwnerOpen} onClose={() => setIsReturnToOwnerOpen(false)} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible relative">

                {/* Floating Topbar */}
                <header className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center print:hidden pointer-events-none">
                    {/* Mobile Menu Trigger & Search */}
                    <div className="flex items-center gap-4 pointer-events-auto w-full max-w-[400px]">
                        <button
                            className="md:hidden w-12 h-12 bg-panel shadow-premium rounded-full flex items-center justify-center text-secondary hover:text-primary transition-colors focus:outline-none"
                            onClick={() => setIsMobileMenuOpen(true)}
                            aria-label="Ouvrir le menu"
                        >
                            <span className="text-xl">☰</span>
                        </button>

                        <OfflineStatusBadge />
                    </div>

                    {/* Quick Nav Segmented Control */}
                    <div className="hidden lg:flex items-center pointer-events-auto bg-panel dark:bg-slate-800 border border-slate-200 dark:border-border-theme rounded-full p-1.5 shadow-premium-lg">
                        <Link to="/dashboard" className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${location.pathname === '/dashboard' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
                            Aperçu
                        </Link>
                        <Link to="/dashboard/caisse" className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${location.pathname === '/dashboard/caisse' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
                            Caisse
                        </Link>
                        <Link to="/dashboard/historique" className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${location.pathname === '/dashboard/historique' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
                            Historique
                        </Link>
                    </div>
                </header>

                {/* Page Content (with top padding to account for absolute header) */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pt-28 md:pt-32 print:p-0 print:overflow-visible print:block">
                    <div className="max-w-6xl mx-auto print:max-w-none">
                        {/* key={pathname} : si une page plante et qu'on répare en
                            naviguant ailleurs, on ne reste pas coincé sur l'écran
                            d'erreur (une frontière d'erreur ne se réinitialise pas
                            toute seule quand son contenu change). */}
                        <ErrorBoundary compact key={location.pathname}>
                            <Outlet />
                        </ErrorBoundary>
                    </div>
                </main>
            </div>

            <BillingModal isExpired={isExpired} />
        </div>
    );
};
