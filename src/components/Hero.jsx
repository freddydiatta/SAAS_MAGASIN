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
        <section className="pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-surface relative border-b-4 border-primary">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    
                    {/* Left Column - Text */}
                    <div className="text-center md:text-left z-10">
                        <div className="inline-block px-4 py-1.5 border-4 border-primary bg-white font-black uppercase tracking-widest text-sm mb-6 shadow-neo-sm transform -rotate-2">
                            Pour les commerçants ambitieux
                        </div>
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-primary mb-6 leading-tight uppercase">
                            Gérez votre business <br className="hidden md:block" />
                            <span className="inline-block mt-2 px-2 bg-accent border-4 border-primary transform rotate-1 shadow-neo">sans prise de tête.</span>
                        </h1>
                        <p className="text-xl text-primary font-bold mb-10 max-w-2xl mx-auto md:mx-0 leading-relaxed bg-white border-4 border-primary p-4 shadow-neo-sm">
                            Vente de motos, pièces détachées, ou location de villas. Abandonnez les carnets de notes. Suivez vos ventes et vos stocks en temps réel.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                            <button className="neo-button bg-primary text-white px-8 py-4 text-lg uppercase flex items-center justify-center gap-2 group">
                                Commencer l'essai
                                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                            </button>
                            <button className="neo-button bg-white text-primary px-8 py-4 text-lg uppercase">
                                Voir la démo
                            </button>
                        </div>
                        <div className="mt-8 flex items-center justify-center md:justify-start gap-4">
                            <div className="flex -space-x-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`w-10 h-10 rounded-full border-4 border-primary bg-yellow-${i*100+100} z-${40-i*10}`}></div>
                                ))}
                            </div>
                            <div className="text-sm font-bold text-primary">Rejoint par +500 commerçants</div>
                        </div>
                    </div>

                    {/* Right Column - Illustration/App UI */}
                    <div className="relative mt-12 md:mt-0 perspective-1000">
                        <div className="absolute inset-0 bg-accentHover rounded-full blur-3xl opacity-20 transform scale-150 -translate-y-1/4"></div>
                        
                        {/* Main App Window */}
                        <div className="relative bg-white border-4 border-primary shadow-neo p-4 sm:p-6 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                            <div className="flex items-center gap-2 border-b-4 border-primary pb-4 mb-4">
                                <div className="w-4 h-4 rounded-full border-4 border-primary bg-red-400"></div>
                                <div className="w-4 h-4 rounded-full border-4 border-primary bg-yellow-400"></div>
                                <div className="w-4 h-4 rounded-full border-4 border-primary bg-green-400"></div>
                            </div>
                            
                            {/* Dashboard Mockup */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-surface border-4 border-primary p-4 shadow-neo-sm">
                                    <div>
                                        <div className="text-sm font-black uppercase text-primary">Caisse du jour</div>
                                        <div className="text-3xl font-black text-primary">1 245 000 F</div>
                                    </div>
                                    <div className="w-12 h-12 border-4 border-primary bg-green-400 flex items-center justify-center">
                                        <IconBox />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-accent border-4 border-primary p-4 shadow-neo-sm">
                                        <IconLayers />
                                        <div className="mt-2 font-black text-primary">Stocks</div>
                                        <div className="text-xl font-bold">+12 alertes</div>
                                    </div>
                                    <div className="bg-accentHover border-4 border-primary p-4 shadow-neo-sm text-white">
                                        <IconSmile />
                                        <div className="mt-2 font-black">Clients</div>
                                        <div className="text-xl font-bold">+5 ajouts</div>
                                    </div>
                                </div>

                                {/* Live Transactions */}
                                <div className="mt-6 border-4 border-primary bg-white p-4">
                                    <div className="text-sm font-black uppercase border-b-4 border-primary pb-2 mb-2 flex items-center justify-between">
                                        <span>Dernières Ventes</span>
                                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-primary"></span>
                                    </div>
                                    <div className="space-y-2">
                                        {transactions.map(t => (
                                            <div key={t.id} className="flex justify-between text-sm font-bold bg-surface p-2 border-2 border-primary animate-fade-in-up">
                                                <span>{t.type}</span>
                                                <span>{t.amount.toLocaleString()} F</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Element */}
                        <div className="absolute -bottom-10 -left-10 bg-green-400 border-4 border-primary p-4 shadow-neo transform -rotate-6 animate-bounce">
                            <p className="font-black text-primary uppercase">Simple & Rapide !</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
