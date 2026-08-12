import { Reveal } from './animations';
import { IconX, IconCheck } from './icons';

export const ProblemSolution = () => {
    return (
        <section className="py-20 bg-accent border-b-4 border-primary relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <Reveal>
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-4xl md:text-5xl font-black text-primary mb-6 uppercase">Le business avance, vos outils aussi.</h2>
                        <p className="text-lg md:text-xl text-primary font-bold bg-white border-4 border-primary inline-block px-6 py-2 shadow-neo-sm transform rotate-1">L'ancienne méthode vous fait perdre du temps et de l'argent.</p>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-stretch mt-12">
                    <Reveal delay={200} direction="left">
                        <div className="bg-white border-4 border-primary p-8 relative transform -rotate-1 hover:rotate-0 transition-transform shadow-neo h-full flex flex-col">
                            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-12 h-12 bg-red-500 border-4 border-primary flex items-center justify-center text-white shadow-neo-sm rotate-12">
                                <IconX />
                            </div>
                            <h3 className="text-2xl font-black text-primary mb-6 uppercase border-b-4 border-primary pb-2 inline-block">Le passé (Carnets)</h3>
                            <ul className="space-y-4 flex-grow">
                                {[
                                    "Carnets perdus, abîmés ou illisibles.",
                                    "Impossible de savoir le stock exact instantanément.",
                                    "Oublis sur la caisse en fin de journée.",
                                    "Pas de suivi sur les employés ou les vendeurs."
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="mt-1 text-red-500 font-black">×</div>
                                        <p className="text-primary font-bold text-lg">{item}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>

                    <Reveal delay={400} direction="right">
                        <div className="bg-surface border-4 border-primary p-8 relative transform rotate-1 hover:rotate-0 transition-transform shadow-neo h-full flex flex-col">
                            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-12 h-12 bg-green-400 border-4 border-primary flex items-center justify-center text-primary shadow-neo-sm -rotate-6">
                                <IconCheck />
                            </div>
                            <h3 className="text-2xl font-black text-primary mb-6 uppercase border-b-4 border-primary pb-2 inline-block">Avec GestionPro</h3>
                            <ul className="space-y-4 flex-grow">
                                {[
                                    "Caisse du jour calculée automatiquement.",
                                    "Alertes sur les pièces ou motos en rupture de stock.",
                                    "Statistiques claires (bénéfices, ventes).",
                                    "Comptes sécurisés pour chaque employé."
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="mt-1 text-green-500 font-black">✓</div>
                                        <p className="text-primary font-bold text-lg">{item}</p>
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
