import { Reveal } from './animations';
import { IconX, IconCheck } from './icons';

export const ProblemSolution = () => {
    return (
        <section className="py-20 bg-surface">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal>
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Le business avance, vos outils aussi.</h2>
                        <p className="text-lg text-gray-600">Faites la différence entre un commerce qui survit et une entreprise qui prospère.</p>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-stretch">
                    <Reveal delay={200} direction="left">
                        <div className="bg-white rounded-3xl p-8 border border-red-100 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-125"></div>
                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-100 text-red-700 font-bold mb-6">
                                    <IconX />
                                    <span>Avant (Carnet de notes)</span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-6">Brouillon et pertes de temps</h3>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3 text-gray-600">
                                        <div className="mt-1 group-hover:rotate-12 transition-transform"><IconX /></div>
                                        <span className="leading-relaxed">Erreurs de calcul en fin de journée</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-gray-600">
                                        <div className="mt-1 group-hover:rotate-12 transition-transform delay-75"><IconX /></div>
                                        <span className="leading-relaxed">Vous ne savez pas exactement ce qui reste en stock</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-gray-600">
                                        <div className="mt-1 group-hover:rotate-12 transition-transform delay-150"><IconX /></div>
                                        <span className="leading-relaxed">Oublis fréquents des avances payées par les clients</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </Reveal>

                    <Reveal delay={400} direction="right">
                        <div className="bg-white rounded-3xl p-8 border border-green-100 shadow-xl relative overflow-hidden transform md:-translate-y-4 group hover:shadow-2xl transition-all hover:-translate-y-6">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-125"></div>
                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-100 text-green-700 font-bold mb-6">
                                    <IconCheck />
                                    <span>Après (Avec GestionPro)</span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-6">Stocks à jour & vue claire</h3>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3 text-gray-700 font-medium">
                                        <div className="mt-1 group-hover:scale-125 transition-transform"><IconCheck /></div>
                                        <span className="leading-relaxed">Caisse calculée automatiquement, sans stress</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-gray-700 font-medium">
                                        <div className="mt-1 group-hover:scale-125 transition-transform delay-75"><IconCheck /></div>
                                        <span className="leading-relaxed">Inventaire à jour : sachez quand réapprovisionner</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-gray-700 font-medium">
                                        <div className="mt-1 group-hover:scale-125 transition-transform delay-150"><IconCheck /></div>
                                        <span className="leading-relaxed">Vue claire sur vos bénéfices réels</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
};
