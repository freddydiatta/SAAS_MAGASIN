import { useState } from 'react';
import { Reveal } from './animations';
import { IconCheck } from './icons';

export const Pricing = () => {
    const [isAnnual, setIsAnnual] = useState(false);

    const plans = [
        {
            name: "Pack Essentiel",
            monthlyPrice: "5 000",
            annualPrice: "50 000",
            description: "L'essentiel pour démarrer sereinement.",
            features: [
                "Gestion des stocks de base (pièces détachées)",
                "Calcul de la caisse du jour",
                "1 utilisateur"
            ],
            popular: false
        },
        {
            name: "Pack Business",
            monthlyPrice: "9 000",
            annualPrice: "90 000",
            description: "Pour les commerces qui voient grand.",
            features: [
                "Le multi-activités (Pièces + Motos + Calendrier Villas)",
                "Possibilité d'ajouter des comptes pour ses employés ou gérants",
                "Support prioritaire",
                "Statistiques avancées"
            ],
            popular: true
        }
    ];

    return (
        <section id="pricing" className="py-24 bg-surface relative border-b-4 border-primary">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal>
                    <div className="text-center mb-16">
                        <h2 className="text-primary font-black tracking-widest uppercase mb-3 border-4 border-primary inline-block px-3 py-1 bg-accent shadow-neo-sm">Tarifs</h2>
                        <h3 className="text-4xl md:text-5xl font-black text-primary mt-4 uppercase">Des offres adaptées à votre croissance.</h3>
                        
                        <div className="flex items-center justify-center mt-8">
                            <div className="inline-flex border-4 border-primary bg-white shadow-neo-sm">
                                <button 
                                    onClick={() => setIsAnnual(false)} 
                                    className={`px-6 py-3 font-bold uppercase transition-colors ${!isAnnual ? 'bg-primary text-white' : 'text-primary hover:bg-gray-100'}`}
                                >
                                    Mensuel
                                </button>
                                <button 
                                    onClick={() => setIsAnnual(true)} 
                                    className={`px-6 py-3 font-bold uppercase flex items-center gap-2 transition-colors ${isAnnual ? 'bg-primary text-white' : 'text-primary hover:bg-gray-100'}`}
                                >
                                    Annuel 
                                    <span className="text-xs bg-green-400 text-primary px-2 py-1 border-2 border-primary font-black uppercase tracking-wide">
                                        -2 mois
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto mt-12">
                    {plans.map((plan, idx) => (
                        <Reveal key={idx} delay={idx * 200}>
                            <div className={`relative bg-white p-8 md:p-10 border-4 border-primary shadow-neo flex flex-col h-full transition-all duration-200 hover:-translate-y-2 ${plan.popular ? 'bg-yellow-50' : ''}`}>
                                {plan.popular && (
                                    <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 bg-accentHover text-primary border-4 border-primary px-6 py-2 text-sm font-black uppercase shadow-neo-sm rotate-3">
                                        Recommandé
                                    </div>
                                )}
                                <div className="mb-8 border-b-4 border-primary pb-6">
                                    <h4 className="text-3xl font-black text-primary mb-3 uppercase">{plan.name}</h4>
                                    <p className="text-primary font-bold h-12 leading-relaxed">{plan.description}</p>
                                </div>
                                <div className="mb-10">
                                    <div className="flex items-end gap-1">
                                        <span className="text-5xl md:text-6xl font-black text-primary">
                                            {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                                        </span>
                                        <span className="text-primary font-bold mb-2"> FCFA / {isAnnual ? 'an' : 'mois'}</span>
                                    </div>
                                    {isAnnual && (
                                        <div className="mt-4 text-sm text-primary border-2 border-primary bg-green-400 inline-block px-3 py-1 font-bold">
                                            Revient à {(parseInt(plan.annualPrice.replace(' ', '')) / 12).toFixed(0)} FCFA / mois
                                        </div>
                                    )}
                                </div>
                                
                                <ul className="space-y-4 mb-10 flex-grow">
                                    {plan.features.map((feat, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className="mt-1 text-primary"><IconCheck /></div>
                                            <span className="text-primary font-bold leading-relaxed">{feat}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button className={`neo-button w-full py-4 text-lg uppercase ${plan.popular ? 'bg-accentHover text-primary' : 'bg-primary text-white'}`}>
                                    Démarrer l'essai gratuit
                                </button>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
