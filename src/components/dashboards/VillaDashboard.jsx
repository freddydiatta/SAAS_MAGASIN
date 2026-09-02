import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useVillaDashboardStats } from '../../hooks/useVillaDashboardStats';
import { Home, Calendar, DollarSign, Users, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatusBadge } from '../StatusBadge';

export const VillaDashboard = () => {
    const { selectedBusiness } = useBusiness();
    const navigate = useNavigate();

    const {
        villasCount,
        activeBookingsCount,
        monthlyRevenue,
        upcomingBookings,
        isLoading,
        formatFCFA,
    } = useVillaDashboardStats(selectedBusiness);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Aperçu Réservations (Villas)</h1>
                    <p className="text-secondary text-sm">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/dashboard/reservations')} className="btn-primary px-5 py-2.5 text-sm">
                        + Nouvelle Réservation
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors"
                >
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors"></div>
                    <div className="flex items-center gap-4 mb-4 relative">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Home className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Villas Gérées</p>
                            <h3 className="text-2xl font-bold text-primary">{isLoading ? "..." : villasCount}</h3>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => navigate('/dashboard/reservations')}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Calendar className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Réservations Actives</p>
                            <h3 className="text-2xl font-bold text-primary">{isLoading ? "..." : activeBookingsCount}</h3>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <DollarSign className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Revenus Mensuels</p>
                            <h3 className="text-2xl font-bold text-primary">
                                {isLoading ? "..." : `${formatFCFA(monthlyRevenue)} F`}
                            </h3>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* List of upcoming bookings */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden mt-8"
            >
                <div className="p-6 border-b border-slate-100 dark:border-border-theme flex items-center justify-between">
                    <h2 className="text-lg font-bold text-primary">Prochaines Arrivées</h2>
                </div>
                <div className="p-0">
                    {isLoading ? (
                        <div className="p-8 text-center text-secondary">Chargement...</div>
                    ) : upcomingBookings.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-secondary font-medium">Aucune réservation à venir.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-border-theme">
                            {upcomingBookings.map((booking, i) => (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + (i * 0.1) }}
                                    key={booking.id}
                                    onClick={() => navigate('/dashboard/reservations')}
                                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between group cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                            <Home className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-primary group-hover:text-accent transition-colors">{booking.villas?.name}</p>
                                            <div className="flex items-center gap-2 text-sm text-secondary">
                                                <Users className="w-4 h-4" /> {booking.customer_name}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-primary">
                                                {new Date(booking.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                            </p>
                                            <StatusBadge
                                                label={booking.status}
                                                tone={booking.status === 'confirmé' ? 'emerald' : 'amber'}
                                                rounded="md"
                                                uppercase
                                                className="px-2 py-0.5 text-[10px]"
                                            />
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-accent transition-colors" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
