import { Reveal } from './animations';
import { XCircle, CheckCircle2, TrendingDown, TrendingUp, AlertCircle, ShieldCheck, Users } from 'lucide-react';

export const ProblemSolution = () => {
    return (
        <section className="py-24 bg-surface dark:bg-slate-900 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <Reveal>
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-4xl md:text-5xl font-black text-primary mb-6 tracking-tight">Le business avance, <br className="hidden md:block"/>vos outils aussi.</h2>
                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-panel rounded-full border border-slate-100 dark:border-border-theme shadow-sm">
                            <span className="text-red-500"><TrendingDown className="w-5 h-5" /></span>
                            <p className="text-lg text-secondary font-medium">L'ancienne méthode vous fait perdre du temps et de l'argent.</p>
                        </div>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-stretch mt-12">
                    {/* The Problem */}
                    <Reveal delay={200} direction="left">
                        <div className="bg-white dark:bg-panel rounded-[2rem] border border-red-100 dark:border-red-900/30 p-10 shadow-sm hover:shadow-lg transition-shadow h-full flex flex-col relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-red-50 dark:bg-red-900/10 rounded-full blur-3xl -mr-16 -mt-16 z-0 transition-transform group-hover:scale-110"></div>
                            
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mb-8 relative z-10">
                                <XCircle className="w-8 h-8" />
                            </div>
                            
                            <h3 className="text-2xl font-bold text-primary mb-8 relative z-10">Le passé (Carnets & Stylos)</h3>
                            
                            <ul className="space-y-6 flex-grow relative z-10">
                                {[
                                    { icon: <AlertCircle className="w-5 h-5" />, text: "Carnets perdus, abîmés ou illisibles." },
                                    { icon: <TrendingDown className="w-5 h-5" />, text: "Impossible de connaître le stock exact instantanément." },
                                    { icon: <XCircle className="w-5 h-5" />, text: "Oublis sur la caisse en fin de journée." },
                                    { icon: <Users className="w-5 h-5" />, text: "Pas de suivi sur les employés ou les vendeurs." }
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-4">
                                        <div className="mt-1 text-red-400 dark:text-red-500 bg-red-50 dark:bg-red-900/20 p-1 rounded-lg">
                                            {item.icon}
                                        </div>
                                        <p className="text-secondary font-medium text-lg leading-relaxed">{item.text}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>

                    {/* The Solution */}
                    <Reveal delay={400} direction="right">
                        <div className="bg-white dark:bg-panel rounded-[2rem] border-2 border-accent/20 p-10 shadow-premium-lg h-full flex flex-col relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-50 dark:bg-emerald-900/20 rounded-full blur-3xl -mr-16 -mt-16 z-0 transition-transform group-hover:scale-110"></div>
                            <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/10 rounded-full blur-3xl -ml-16 -mb-16 z-0"></div>
                            
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-8 relative z-10 shadow-sm">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            
                            <h3 className="text-2xl font-bold text-primary mb-8 relative z-10 flex items-center gap-3">
                                Avec GestionPro
                                <span className="bg-accent/10 text-accent text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">Solution</span>
                            </h3>
                            
                            <ul className="space-y-6 flex-grow relative z-10">
                                {[
                                    { icon: <TrendingUp className="w-5 h-5" />, text: "Caisse du jour calculée et synchronisée automatiquement." },
                                    { icon: <AlertCircle className="w-5 h-5" />, text: "Alertes intelligentes avant les ruptures de stock." },
                                    { icon: <TrendingUp className="w-5 h-5" />, text: "Statistiques claires (bénéfices, meilleures ventes)." },
                                    { icon: <ShieldCheck className="w-5 h-5" />, text: "Comptes sécurisés et historiques pour chaque employé." }
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-4">
                                        <div className="mt-1 text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 p-1 rounded-lg">
                                            {item.icon}
                                        </div>
                                        <p className="text-secondary font-medium text-lg leading-relaxed">{item.text}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
};
