import { useState } from 'react';
import { Reveal } from './animations';
import { IconCheck } from './icons';
import { Link } from 'react-router-dom';

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
                "Comptes supplémentaires (employés/gérants)",
                "Support prioritaire",
                "Statistiques avancées"
            ],
            popular: true
        }
    ];

    return (
        <section id="pricing" className="py-24 bg-surface">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal>
                    <div className="text-center mb-16">
                        <div className="text-accent font-semibold uppercase text-sm tracking-wider mb-4">Tarifs</div>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-primary mt-2 tracking-tight">Des offres adaptées à votre croissance.</h2>
                        
                        <div className="flex items-center justify-center mt-8">
                            <div className="inline-flex bg-slate-200/50 p-1 rounded-xl">
                                <button 
                                    onClick={() => setIsAnnual(false)} 
                                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isAnnual ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
                                >
                                    Mensuel
                                </button>
                                <button 
                                    onClick={() => setIsAnnual(true)} 
                                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${isAnnual ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
                                >
                                    Annuel 
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
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
                            <div className={`relative bg-white p-8 md:p-10 rounded-3xl border transition-all duration-300 hover:shadow-premium-lg flex flex-col h-full ${plan.popular ? 'border-accent shadow-premium ring-1 ring-accent/10' : 'border-slate-200 shadow-sm'}`}>
                                {plan.popular && (
                                    <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-accent text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                                        Recommandé
                                    </div>
                                )}
                                <div className="mb-8 border-b border-slate-100 pb-6">
                                    <h3 className="text-2xl font-bold text-primary mb-2">{plan.name}</h3>
                                    <p className="text-secondary text-sm h-10">{plan.description}</p>
                                </div>
                                <div className="mb-10">
                                    <div className="flex items-end gap-1">
                                        <span className="text-5xl font-extrabold text-primary tracking-tight">
                                            {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                                        </span>
                                        <span className="text-secondary font-medium mb-1"> FCFA / {isAnnual ? 'an' : 'mois'}</span>
                                    </div>
                                    {isAnnual && (
                                        <div className="mt-3 text-xs text-emerald-600 bg-emerald-50 inline-block px-3 py-1 rounded-full font-semibold">
                                            Revient à {(parseInt(plan.annualPrice.replace(' ', '')) / 12).toFixed(0)} FCFA / mois
                                        </div>
                                    )}
                                </div>
                                
                                <ul className="space-y-4 mb-10 flex-grow">
                                    {plan.features.map((feat, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className="mt-0.5 text-emerald-500"><IconCheck /></div>
                                            <span className="text-secondary font-medium">{feat}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link to={`/register?plan=${plan.name === 'Pack Essentiel' ? 'essentiel' : 'business'}`} className={`w-full py-3.5 rounded-xl font-semibold transition-all inline-block text-center ${plan.popular ? 'bg-accent text-white shadow-md hover:bg-accentHover hover:shadow-lg' : 'bg-slate-50 text-primary border border-slate-200 hover:bg-slate-100'}`}>
                                    Démarrer l'essai gratuit
                                </Link>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
