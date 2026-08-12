import { useState, useEffect } from 'react';
import { IconBox, IconLayers, IconSmile } from './icons';

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

    return (
        <section className="pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-surface relative border-b border-slate-200">
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-accent/5 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    
                    {/* Left Column - Text */}
                    <div className="text-center md:text-left z-10">
                        <div className="inline-block px-4 py-1.5 bg-accent/10 text-accent font-semibold rounded-full text-sm mb-6 border border-accent/20">
                            Pour les commerçants ambitieux
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary mb-6 leading-tight tracking-tight">
                            Gérez votre business <br className="hidden md:block" />
                            <span className="text-accent">sans prise de tête.</span>
                        </h1>
                        <p className="text-lg text-secondary mb-10 max-w-2xl mx-auto md:mx-0 leading-relaxed">
                            Vente de motos, pièces détachées, ou location de villas. Abandonnez les carnets de notes. Suivez vos ventes et vos stocks en temps réel avec un outil conçu pour le terrain.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                            <button className="btn-primary px-8 py-3.5 text-lg flex items-center justify-center gap-2 group">
                                Commencer l'essai
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                            </button>
                            <button className="btn-secondary px-8 py-3.5 text-lg">
                                Voir la démo
                            </button>
                        </div>
                        <div className="mt-10 flex items-center justify-center md:justify-start gap-4">
                            <div className="flex -space-x-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User avatar" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                            <div className="text-sm font-medium text-secondary">Rejoint par <span className="font-bold text-primary">+500 commerçants</span></div>
                        </div>
                    </div>

                    {/* Right Column - Illustration/App UI */}
                    <div className="relative mt-12 md:mt-0 perspective-1000">
                        {/* Main App Window */}
                        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-premium-lg p-6">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                            </div>
                            
                            {/* Dashboard Mockup */}
                            <div className="space-y-5">
                                <div className="flex justify-between items-center bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div>
                                        <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Caisse du jour</div>
                                        <div className="text-3xl font-bold text-primary">1 245 000 <span className="text-lg text-secondary">F</span></div>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <IconBox />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                                        <div className="text-amber-500 mb-2"><IconLayers /></div>
                                        <div className="font-semibold text-primary">Stocks</div>
                                        <div className="text-sm text-amber-600 font-medium bg-amber-50 inline-block px-2 py-0.5 rounded-full mt-1">12 alertes</div>
                                    </div>
                                    <div className="bg-accent rounded-xl p-4 shadow-sm text-white">
                                        <div className="text-white/80 mb-2"><IconSmile /></div>
                                        <div className="font-semibold">Clients</div>
                                        <div className="text-sm text-white/90 font-medium bg-white/20 inline-block px-2 py-0.5 rounded-full mt-1">+5 ajouts</div>
                                    </div>
                                </div>

                                {/* Live Transactions */}
                                <div className="mt-4 bg-white border border-slate-100 rounded-xl p-4">
                                    <div className="text-xs font-semibold text-secondary uppercase tracking-wider pb-3 mb-3 border-b border-slate-100 flex items-center justify-between">
                                        <span>Dernières Ventes</span>
                                        <span className="flex h-2 w-2 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {transactions.map(t => (
                                            <div key={t.id} className="flex justify-between items-center text-sm font-medium animate-fade-in-up">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-secondary text-xs">🛍️</div>
                                                    <span className="text-primary">{t.type}</span>
                                                </div>
                                                <span className="font-bold text-primary">{t.amount.toLocaleString()} F</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Element */}
                        <div className="absolute -bottom-6 -left-6 bg-white rounded-xl p-4 shadow-premium border border-slate-100 animate-bounce">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    ✓
                                </div>
                                <div>
                                    <p className="font-bold text-primary text-sm">Simple & Rapide</p>
                                    <p className="text-xs text-secondary">Prise en main immédiate</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
