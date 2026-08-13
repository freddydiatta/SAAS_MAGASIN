import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, TrendingUp, Users, ShieldCheck, ArrowRight, Activity } from 'lucide-react';

export const Hero = () => {
    const [transactions, setTransactions] = useState([]);

    // Simuler des transactions en temps réel
    useEffect(() => {
        const timer = setTimeout(() => {
            setTransactions(prev => [
                { id: Date.now(), amount: Math.floor(Math.random() * 50000) + 1000, type: 'Vente' },
                ...prev
            ].slice(0, 3));
        }, 3000);

        return () => clearTimeout(timer);
    }, [transactions]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <section className="pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-surface relative">
            {/* Background glowing effects */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    
                    {/* Left Column - Text */}
                    <motion.div 
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="text-center lg:text-left z-10"
                    >
                        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-panel rounded-full shadow-sm border border-slate-100 dark:border-border-theme mb-8">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                            </span>
                            <span className="text-sm font-semibold text-primary">Nouveau : Gestion Multi-Boutiques</span>
                        </motion.div>
                        
                        <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary mb-6 leading-[1.1] tracking-tight">
                            Gérez votre business <br className="hidden md:block" />
                            <span className="text-accent relative inline-block mt-2">
                                sans prise de tête.
                                <svg className="absolute w-full h-3 -bottom-1 left-0 text-accent/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                                    <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="3" />
                                </svg>
                            </span>
                        </motion.h1>
                        
                        <motion.p variants={itemVariants} className="text-lg md:text-xl text-secondary mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                            Vente de motos, pièces détachées, ou location de villas. Abandonnez les carnets de notes. Suivez vos ventes et vos stocks en temps réel avec un outil conçu pour le terrain.
                        </motion.p>
                        
                        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                            <Link to="/register" className="btn-primary px-8 py-4 text-lg flex items-center justify-center gap-2 group shadow-lg shadow-accent/20">
                                Commencer l'essai
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link to="/login" className="px-8 py-4 text-lg font-bold text-primary bg-white dark:bg-panel border-2 border-slate-200 dark:border-border-theme hover:border-accent hover:text-accent rounded-xl transition-all flex items-center justify-center shadow-sm">
                                Voir la démo
                            </Link>
                        </motion.div>
                        
                        <motion.div variants={itemVariants} className="mt-12 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                            <div className="flex -space-x-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="w-12 h-12 rounded-full border-4 border-surface bg-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User avatar" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                            <div className="text-sm font-medium text-secondary text-center sm:text-left">
                                Rejoint par <span className="font-bold text-primary">+500 commerçants</span><br/>
                                <span className="text-amber-500">★★★★★</span> 4.9/5 sur Trustpilot
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Right Column - Illustration/App UI */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, rotateX: 10 }}
                        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
                        className="relative mt-12 lg:mt-0 perspective-1000"
                    >
                        {/* Main App Window */}
                        <div className="relative bg-white dark:bg-panel rounded-[2rem] border border-slate-200/50 dark:border-border-theme shadow-premium-lg p-6 overflow-hidden">
                            
                            {/* Window controls */}
                            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-border-theme pb-4 mb-6">
                                <div className="w-3.5 h-3.5 rounded-full bg-red-400/90 shadow-sm"></div>
                                <div className="w-3.5 h-3.5 rounded-full bg-amber-400/90 shadow-sm"></div>
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-400/90 shadow-sm"></div>
                            </div>
                            
                            {/* Dashboard Mockup */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-center bg-surface rounded-2xl p-5 border border-slate-100 dark:border-border-theme">
                                    <div>
                                        <div className="text-sm font-bold text-secondary uppercase tracking-wider mb-2">Caisse du jour</div>
                                        <div className="text-4xl font-extrabold text-primary tracking-tight">1 245 000 <span className="text-xl text-secondary font-medium">FCFA</span></div>
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                                        <Activity className="w-7 h-7" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-panel border border-slate-100 dark:border-border-theme rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-amber-500 mb-3 bg-amber-50 dark:bg-amber-500/10 w-10 h-10 flex items-center justify-center rounded-xl">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div className="font-bold text-primary text-lg">Stocks</div>
                                        <div className="text-sm text-amber-600 font-bold bg-amber-100 dark:bg-amber-500/20 inline-block px-3 py-1 rounded-full mt-2">12 alertes</div>
                                    </div>
                                    <div className="bg-accent rounded-2xl p-5 shadow-sm shadow-accent/20 text-white relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                                        <div className="text-white mb-3 bg-white/20 w-10 h-10 flex items-center justify-center rounded-xl backdrop-blur-sm relative z-10">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div className="font-bold text-lg relative z-10">Clients</div>
                                        <div className="text-sm text-accent font-bold bg-white inline-block px-3 py-1 rounded-full mt-2 relative z-10">+5 ajouts</div>
                                    </div>
                                </div>

                                {/* Live Transactions */}
                                <div className="mt-4 bg-white dark:bg-panel border border-slate-100 dark:border-border-theme rounded-2xl p-5">
                                    <div className="text-sm font-bold text-secondary uppercase tracking-wider pb-4 mb-4 border-b border-slate-100 dark:border-border-theme flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" />
                                            Dernières Ventes
                                        </span>
                                        <span className="flex h-2.5 w-2.5 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                        </span>
                                    </div>
                                    <div className="space-y-4">
                                        {transactions.map((t, index) => (
                                            <motion.div 
                                                key={t.id} 
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="flex justify-between items-center text-sm font-medium"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-surface border border-slate-100 dark:border-border-theme flex items-center justify-center text-secondary">
                                                        <Package className="w-5 h-5 opacity-50" />
                                                    </div>
                                                    <span className="text-primary font-bold">{t.type}</span>
                                                </div>
                                                <span className="font-extrabold text-primary text-base">{t.amount.toLocaleString('fr-FR')} F</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Badge */}
                        <motion.div 
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8, type: "spring" }}
                            className="absolute -top-6 -right-4 md:-right-8 bg-white dark:bg-panel rounded-2xl p-5 shadow-premium border border-slate-100 dark:border-border-theme z-20"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-primary">100% Sécurisé</p>
                                    <p className="text-sm font-medium text-secondary">Données cryptées</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};
