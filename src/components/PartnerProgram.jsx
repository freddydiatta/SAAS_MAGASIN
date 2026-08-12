import { Reveal } from './animations';

export const PartnerProgram = () => {
    return (
        <section id="partner" className="py-20 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary z-0"></div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="bg-secondary rounded-[2.5rem] p-8 md:p-12 lg:p-16 shadow-2xl relative overflow-hidden">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-accent opacity-20 rounded-full blur-3xl"></div>

                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <Reveal direction="left">
                            <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent font-bold text-sm mb-6">
                                Programme Partenaire
                            </div>
                            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6 leading-tight">
                                L'application vous plaît ? <br />
                                Gagnez de l'argent en la recommandant !
                            </h2>
                            <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                                Partagez l'outil avec vos collègues commerçants. Si l'abonnement est à 5 000 FCFA, vous touchez <strong className="text-white">1 000 FCFA tous les mois</strong> pour chaque utilisateur que vous ramenez.
                            </p>

                            <div className="bg-white/10 rounded-xl p-6 border border-white/5 mb-8 hover:bg-white/20 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl group-hover:scale-110 group-hover:rotate-6 transition-transform">💰</div>
                                    <div>
                                        <p className="text-white font-bold text-xl">100 utilisateurs = 100 000 FCFA / mois</p>
                                        <p className="text-blue-200 text-sm mt-1">De revenus passifs, sans rien faire.</p>
                                    </div>
                                </div>
                            </div>

                            <button className="bg-white text-primary hover:bg-gray-100 px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:-translate-y-1 shadow-lg group flex items-center gap-2">
                                Découvrir l'affiliation
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                            </button>
                        </Reveal>

                        <Reveal delay={200} direction="right" className="hidden lg:flex justify-center">
                            <div className="relative bg-white p-8 rounded-3xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500 w-full max-w-sm">
                                <div className="absolute -top-4 -right-4 w-12 h-12 bg-accent rounded-full flex items-center justify-center text-white text-2xl animate-bounce shadow-lg">✨</div>
                                <div className="text-center mb-6">
                                    <p className="text-gray-500 text-sm mb-1">Vos commissions du mois</p>
                                    <p className="text-4xl font-extrabold text-gray-900">100 000 <span className="text-lg text-gray-500">FCFA</span></p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-4 flex justify-center items-center gap-2 group cursor-pointer hover:bg-green-100 transition-colors">
                                    <svg className="w-5 h-5 text-green-600 group-hover:scale-125 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                    <span className="font-semibold text-green-700">Paiement prêt à être retiré</span>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </div>
        </section>
    );
};
