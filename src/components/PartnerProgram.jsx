import { Reveal } from './animations';

export const PartnerProgram = () => {
    return (
        <section id="partner" className="py-24 relative overflow-hidden bg-slate-900 text-white">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-accent/20 blur-3xl"></div>
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 lg:p-16 relative backdrop-blur-sm">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <Reveal direction="left">
                            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent font-semibold rounded-full text-sm mb-6 border border-accent/30">
                                Programme Partenaire
                            </div>
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight tracking-tight">
                                L'application vous plaît ? <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-amber-500">Gagnez de l'argent</span> en la recommandant !
                            </h2>
                            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                                Partagez l'outil avec vos collègues commerçants. Si l'abonnement est à 5 000 FCFA, vous touchez <strong className="text-white bg-white/10 px-2 py-0.5 rounded">1 000 FCFA tous les mois</strong> pour chaque utilisateur que vous ramenez.
                            </p>

                            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8 hover:bg-slate-800 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl p-3 bg-slate-800 rounded-xl group-hover:scale-110 group-hover:rotate-6 transition-transform">💰</div>
                                    <div>
                                        <p className="font-bold text-lg text-white">100 utilisateurs = 100 000 FCFA / mois</p>
                                        <p className="text-slate-400 text-sm mt-1">De revenus passifs, sans rien faire.</p>
                                    </div>
                                </div>
                            </div>

                            <button className="bg-accent hover:bg-accentHover text-white px-8 py-3.5 rounded-xl font-bold text-lg flex items-center gap-2 group transition-all shadow-lg shadow-accent/20">
                                Découvrir l'affiliation
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                            </button>
                        </Reveal>

                        <Reveal delay={200} direction="right" className="hidden lg:flex justify-center">
                            <div className="relative bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm transform hover:-translate-y-2 transition-transform duration-300">
                                <div className="absolute -top-4 -right-4 w-12 h-12 bg-accent rounded-full flex items-center justify-center text-white text-xl shadow-lg shadow-accent/40">✨</div>
                                <div className="text-center mb-6">
                                    <p className="text-secondary font-semibold text-sm mb-1 uppercase tracking-wider">Vos commissions du mois</p>
                                    <p className="text-5xl font-black text-primary tracking-tight">100 000 <span className="text-xl text-secondary font-medium">FCFA</span></p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex justify-center items-center gap-3 cursor-pointer hover:bg-emerald-100 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                    </div>
                                    <span className="font-bold text-emerald-700 text-sm uppercase tracking-wide">Paiement prêt à être retiré</span>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </div>
        </section>
    );
};
