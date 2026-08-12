import { Reveal } from './animations';

export const PartnerProgram = () => {
    return (
        <section id="partner" className="py-20 relative overflow-hidden bg-accent border-b-4 border-primary">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="bg-white border-4 border-primary shadow-neo p-8 md:p-12 lg:p-16 relative">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <Reveal direction="left">
                            <div className="inline-block px-4 py-1.5 border-4 border-primary bg-accentHover text-primary font-black uppercase tracking-widest text-sm mb-6 shadow-neo-sm">
                                Programme Partenaire
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black text-primary mb-6 leading-tight uppercase">
                                L'application vous plaît ? <br />
                                Gagnez de l'argent en la recommandant !
                            </h2>
                            <p className="text-primary font-bold text-lg mb-8 leading-relaxed">
                                Partagez l'outil avec vos collègues commerçants. Si l'abonnement est à 5 000 FCFA, vous touchez <strong className="bg-primary text-white px-2">1 000 FCFA tous les mois</strong> pour chaque utilisateur que vous ramenez.
                            </p>

                            <div className="bg-surface border-4 border-primary p-6 mb-8 hover:bg-accent transition-colors cursor-pointer group shadow-neo-sm">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl group-hover:scale-110 group-hover:rotate-6 transition-transform">💰</div>
                                    <div>
                                        <p className="text-primary font-black text-xl uppercase">100 utilisateurs = 100 000 FCFA / mois</p>
                                        <p className="text-primary font-medium mt-1">De revenus passifs, sans rien faire.</p>
                                    </div>
                                </div>
                            </div>

                            <button className="neo-button bg-primary text-white hover:bg-secondary px-8 py-4 font-black text-lg uppercase flex items-center gap-2 group">
                                Découvrir l'affiliation
                                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                            </button>
                        </Reveal>

                        <Reveal delay={200} direction="right" className="hidden lg:flex justify-center">
                            <div className="relative bg-white p-8 border-4 border-primary shadow-neo transform rotate-3 hover:rotate-0 transition-transform duration-200 w-full max-w-sm">
                                <div className="absolute -top-6 -right-6 w-12 h-12 border-4 border-primary bg-accent flex items-center justify-center text-white text-2xl shadow-neo-sm">✨</div>
                                <div className="text-center mb-6">
                                    <p className="text-primary font-bold text-sm mb-1 uppercase">Vos commissions du mois</p>
                                    <p className="text-5xl font-black text-primary">100 000 <span className="text-xl">FCFA</span></p>
                                </div>
                                <div className="bg-green-400 border-4 border-primary p-4 flex justify-center items-center gap-2 group cursor-pointer hover:bg-green-300 transition-colors shadow-neo-sm">
                                    <svg className="w-6 h-6 text-primary group-hover:scale-125 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                    <span className="font-black text-primary uppercase">Paiement prêt à être retiré</span>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </div>
        </section>
    );
};
