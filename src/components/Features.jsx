import { Reveal } from './animations';
import { Settings, Wrench, Bike, Home, Calculator, Users, Bell, FileText } from 'lucide-react';

export const Features = () => {
    return (
        <section id="features" className="py-24 bg-surface relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <Reveal>
                    <div className="text-center mb-16 max-w-2xl mx-auto">
                        <div className="text-accent font-extrabold uppercase text-xs tracking-[0.2em] mb-4 bg-accent/10 inline-block px-4 py-1.5 rounded-full">Tout-en-un</div>
                        <h2 className="text-4xl md:text-5xl font-black text-primary tracking-tight">Un seul outil pour tout gérer.</h2>
                    </div>
                </Reveal>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
                    
                    {/* Feature 1: Large */}
                    <div className="md:col-span-2 bg-white dark:bg-panel rounded-3xl p-8 border border-slate-100 dark:border-border-theme shadow-premium hover:shadow-premium-lg transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-transform group-hover:scale-110"></div>
                        <Reveal delay={100} className="h-full flex flex-col relative z-10">
                            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-6">
                                <Wrench className="w-7 h-7" />
                            </div>
                            <h3 className="text-2xl font-bold text-primary mb-3">Gestion des Pièces</h3>
                            <p className="text-secondary font-medium max-w-md">Ajoutez, modifiez et suivez vos pièces détachées. Recevez des alertes avant la rupture de stock pour ne jamais manquer une vente.</p>
                        </Reveal>
                    </div>

                    {/* Feature 2: Small */}
                    <div className="bg-white dark:bg-panel rounded-3xl p-8 border border-slate-100 dark:border-border-theme shadow-premium hover:shadow-premium-lg transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-transform group-hover:scale-110"></div>
                        <Reveal delay={200} className="h-full flex flex-col relative z-10">
                            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                                <Bike className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-3">Vente de Motos</h3>
                            <p className="text-secondary font-medium">Gérez votre inventaire de motos avec les numéros de châssis.</p>
                        </Reveal>
                    </div>

                    {/* Feature 3: Small */}
                    <div className="bg-white dark:bg-panel rounded-3xl p-8 border border-slate-100 dark:border-border-theme shadow-premium hover:shadow-premium-lg transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-transform group-hover:scale-110"></div>
                        <Reveal delay={300} className="h-full flex flex-col relative z-10">
                            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                                <Home className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-3">Location de Villas</h3>
                            <p className="text-secondary font-medium">Calendrier visuel pour vos villas. Sachez quand c'est libre.</p>
                        </Reveal>
                    </div>

                    {/* Feature 4: Large */}
                    <div className="md:col-span-2 bg-white dark:bg-panel rounded-3xl p-8 border border-slate-100 dark:border-border-theme shadow-premium hover:shadow-premium-lg transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-transform group-hover:scale-110"></div>
                        <Reveal delay={400} className="h-full flex flex-col relative z-10">
                            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
                                <Calculator className="w-7 h-7" />
                            </div>
                            <h3 className="text-2xl font-bold text-primary mb-3">Caisse & Compta</h3>
                            <p className="text-secondary font-medium max-w-md">Votre caisse se calcule toute seule à chaque vente. Plus d'erreurs en fin de journée, statistiques claires de vos bénéfices.</p>
                        </Reveal>
                    </div>

                </div>
            </div>
        </section>
    );
};
