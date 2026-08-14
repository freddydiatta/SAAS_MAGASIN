import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { Utensils, DollarSign, Clock, Users, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const RestaurantDashboard = () => {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Aperçu Service (Restaurant)</h1>
                    <p className="text-secondary text-sm">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-primary px-5 py-2.5 text-sm">+ Nouvelle Commande</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors"
                >
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors"></div>
                    <div className="flex items-center gap-4 mb-4 relative">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Clock className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Commandes en cours</p>
                            <h3 className="text-2xl font-bold text-primary">0</h3>
                        </div>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <DollarSign className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Caisse du jour</p>
                            <h3 className="text-2xl font-bold text-primary">0 <span className="text-sm">FCFA</span></h3>
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
                            <Utensils className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Plats Servis</p>
                            <h3 className="text-2xl font-bold text-primary">0</h3>
                        </div>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Tables Ouvertes</p>
                            <h3 className="text-2xl font-bold text-primary">0</h3>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Recent Orders List placeholder */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden mt-8"
            >
                <div className="p-6 border-b border-slate-100 dark:border-border-theme flex items-center justify-between">
                    <h2 className="text-lg font-bold text-primary">Dernières Commandes</h2>
                    <button className="text-accent text-sm font-medium flex items-center gap-1 hover:underline">
                        Voir tout <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-12 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Utensils className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-secondary font-medium">Aucune commande pour le moment.</p>
                </div>
            </motion.div>
        </div>
    );
};
