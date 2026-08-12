import { Reveal } from './animations';
import { IconX, IconCheck } from './icons';

export const ProblemSolution = () => {
    return (
        <section className="py-24 bg-slate-50 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <Reveal>
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-primary mb-6 tracking-tight">Le business avance, vos outils aussi.</h2>
                        <p className="text-lg text-secondary inline-block px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">L'ancienne méthode vous fait perdre du temps et de l'argent.</p>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-stretch mt-12">
                    {/* The Problem */}
                    <Reveal delay={200} direction="left">
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-premium transition-shadow h-full flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-16 -mt-16 z-0"></div>
                            
                            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-xl flex items-center justify-center mb-6 relative z-10">
                                <IconX />
                            </div>
                            
                            <h3 className="text-xl font-bold text-primary mb-6 relative z-10">Le passé (Carnets)</h3>
                            
                            <ul className="space-y-4 flex-grow relative z-10">
                                {[
                                    "Carnets perdus, abîmés ou illisibles.",
                                    "Impossible de savoir le stock exact instantanément.",
                                    "Oublis sur la caisse en fin de journée.",
                                    "Pas de suivi sur les employés ou les vendeurs."
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="mt-1 text-red-400 font-bold">×</div>
                                        <p className="text-secondary font-medium">{item}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>

                    {/* The Solution */}
                    <Reveal delay={400} direction="right">
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-premium h-full flex flex-col relative overflow-hidden ring-1 ring-accent/10">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-16 -mt-16 z-0"></div>
                            
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6 relative z-10">
                                <IconCheck />
                            </div>
                            
                            <h3 className="text-xl font-bold text-primary mb-6 relative z-10">Avec GestionPro</h3>
                            
                            <ul className="space-y-4 flex-grow relative z-10">
                                {[
                                    "Caisse du jour calculée automatiquement.",
                                    "Alertes sur les pièces ou motos en rupture de stock.",
                                    "Statistiques claires (bénéfices, ventes).",
                                    "Comptes sécurisés pour chaque employé."
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="mt-1 text-emerald-500 font-bold">✓</div>
                                        <p className="text-secondary font-medium">{item}</p>
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
