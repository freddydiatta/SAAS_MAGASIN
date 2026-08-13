import { Reveal } from './animations';
import { Sparkles, ArrowRight, Wallet, CheckCircle2, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PartnerProgram = () => {
    return (
        <section id="partner" className="py-24 relative overflow-hidden bg-primary text-white">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] rounded-full bg-accent/20 blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] rounded-full bg-emerald-500/10 blur-3xl -ml-32 -mb-32"></div>
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 md:p-12 lg:p-16 relative backdrop-blur-md shadow-2xl">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        <Reveal direction="left">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent font-bold rounded-full text-xs uppercase tracking-wider mb-8 border border-accent/30 shadow-inner">
                                <Sparkles className="w-4 h-4" />
                                Programme Partenaire
                            </div>
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-[1.1] tracking-tight">
                                L'application vous plaît ? <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-[#ff8c6b]">Gagnez de l'argent</span> en la recommandant !
                            </h2>
                            <p className="text-slate-300 text-lg md:text-xl mb-10 leading-relaxed max-w-xl font-medium">
                                Partagez l'outil avec vos collègues commerçants. Si l'abonnement est à 5 000 FCFA, vous touchez <strong className="text-white bg-white/10 px-3 py-1 rounded-lg border border-white/20 whitespace-nowrap">1 000 FCFA / mois</strong> pour chaque utilisateur que vous ramenez.
                            </p>

                            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-6 mb-10 hover:bg-slate-800 transition-all cursor-pointer group shadow-lg backdrop-blur-xl">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-slate-700/50 text-accent rounded-xl group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-inner">
                                        <Wallet className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="font-black text-xl text-white tracking-tight">100 utilisateurs = 100 000 FCFA / mois</p>
                                        <p className="text-slate-400 text-sm mt-1 font-medium">De revenus passifs, sans rien faire.</p>
                                    </div>
                                </div>
                            </div>

                            <Link to="/register" className="bg-accent hover:bg-accentHover text-white px-8 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 group transition-all shadow-xl shadow-accent/25 hover:shadow-2xl hover:shadow-accent/40 w-full sm:w-auto sm:inline-flex">
                                Découvrir l'affiliation
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Reveal>

                        <Reveal delay={200} direction="right" className="hidden lg:flex justify-center">
                            <div className="relative bg-white dark:bg-panel rounded-[2rem] p-8 shadow-2xl w-full max-w-md transform hover:-translate-y-2 transition-transform duration-500 border border-slate-100 dark:border-border-theme">
                                <div className="absolute -top-6 -right-6 w-14 h-14 bg-accent rounded-full flex items-center justify-center text-white shadow-lg shadow-accent/40 border-4 border-white dark:border-panel">
                                    <DollarSign className="w-7 h-7" />
                                </div>
                                
                                <div className="text-center mb-8 mt-2">
                                    <p className="text-secondary font-bold text-sm mb-2 uppercase tracking-widest">Vos commissions du mois</p>
                                    <p className="text-6xl font-black text-primary tracking-tighter">100 000 <span className="text-2xl text-secondary font-bold">FCFA</span></p>
                                </div>
                                
                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center justify-between text-sm p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                        <span className="text-secondary font-medium">Utilisateurs actifs</span>
                                        <span className="font-bold text-primary">100</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                        <span className="text-secondary font-medium">Prochain paiement</span>
                                        <span className="font-bold text-primary">01 Octobre</span>
                                    </div>
                                </div>

                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 flex justify-center items-center gap-3 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors group">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm uppercase tracking-wider">Paiement prêt</span>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </div>
        </section>
    );
};
