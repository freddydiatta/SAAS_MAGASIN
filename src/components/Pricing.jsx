import { useState } from 'react';
import { Reveal } from './animations';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Pricing = () => {
    const [isAnnual, setIsAnnual] = useState(false);

    const plans = [
        {
            id: "essentiel",
            name: "Pack Essentiel",
            monthlyPrice: "5 000",
            annualPrice: "50 000",
            description: "L'essentiel pour démarrer sereinement votre digitalisation.",
            features: [
                "Gestion des stocks de base (pièces détachées)",
                "Calcul de la caisse du jour automatique",
                "1 utilisateur (accès admin)"
            ],
            popular: false
        },
        {
            id: "business",
            name: "Pack Business",
            monthlyPrice: "9 000",
            annualPrice: "90 000",
            description: "Pour les commerces qui voient grand et veulent tout contrôler.",
            features: [
                "Le multi-activités (Pièces + Motos + Villas)",
                "Comptes supplémentaires (employés/gérants)",
                "Support technique prioritaire 7j/7",
                "Statistiques avancées et rapports d'audit"
            ],
            popular: true
        }
    ];

    return (
        <section id="pricing" className="py-24 bg-surface dark:bg-slate-900 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <Reveal>
                    <div className="text-center mb-16">
                        <div className="text-accent font-extrabold uppercase text-xs tracking-[0.2em] mb-4 bg-accent/10 inline-block px-4 py-1.5 rounded-full">Tarifs</div>
                        <h2 className="text-4xl md:text-5xl font-black text-primary tracking-tight mt-2">Des offres adaptées à votre croissance.</h2>
                        
                        <div className="flex items-center justify-center mt-10">
                            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-border-theme">
                                <button 
                                    onClick={() => setIsAnnual(false)} 
                                    className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${!isAnnual ? 'bg-white dark:bg-panel text-primary shadow-sm ring-1 ring-slate-200 dark:ring-border-theme' : 'text-secondary hover:text-primary'}`}
                                >
                                    Mensuel
                                </button>
                                <button 
                                    onClick={() => setIsAnnual(true)} 
                                    className={`px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${isAnnual ? 'bg-white dark:bg-panel text-primary shadow-sm ring-1 ring-slate-200 dark:ring-border-theme' : 'text-secondary hover:text-primary'}`}
                                >
                                    Annuel 
                                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
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
                            <div className={`relative bg-white dark:bg-panel p-8 md:p-10 rounded-[2rem] border transition-all duration-300 hover:shadow-premium-lg flex flex-col h-full overflow-hidden group ${plan.popular ? 'border-accent/50 shadow-premium ring-4 ring-accent/10' : 'border-slate-100 dark:border-border-theme shadow-sm hover:border-slate-300'}`}>
                                
                                {plan.popular && (
                                    <>
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-20 -mt-20 z-0 transition-transform group-hover:scale-110"></div>
                                        <div className="absolute top-6 right-6 z-10 bg-gradient-to-r from-accent to-[#e66c4a] text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-md">
                                            Recommandé
                                        </div>
                                    </>
                                )}
                                
                                <div className="mb-8 border-b border-slate-100 dark:border-border-theme pb-8 relative z-10">
                                    <h3 className="text-2xl font-black text-primary mb-3">{plan.name}</h3>
                                    <p className="text-secondary text-sm font-medium h-10 pr-12">{plan.description}</p>
                                </div>
                                
                                <div className="mb-10 relative z-10">
                                    <div className="flex items-end gap-1">
                                        <span className="text-5xl font-black text-primary tracking-tight">
                                            {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                                        </span>
                                        <span className="text-secondary font-bold mb-1"> FCFA / {isAnnual ? 'an' : 'mois'}</span>
                                    </div>
                                    {isAnnual && (
                                        <div className="mt-4 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 inline-flex px-3 py-1.5 rounded-full font-bold border border-emerald-100 dark:border-emerald-900/30">
                                            Revient à {(parseInt(plan.annualPrice.replace(' ', '')) / 12).toFixed(0)} FCFA / mois
                                        </div>
                                    )}
                                </div>
                                
                                <ul className="space-y-5 mb-10 flex-grow relative z-10">
                                    {plan.features.map((feat, i) => (
                                        <li key={i} className="flex items-start gap-4">
                                            <div className="mt-0.5 text-accent dark:text-accent"><CheckCircle2 className="w-5 h-5" /></div>
                                            <span className="text-secondary font-medium leading-relaxed">{feat}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link to={`/register?plan=${plan.id}`} className={`relative z-10 w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 group/btn ${plan.popular ? 'bg-primary text-white shadow-lg hover:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50 text-primary border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                    Démarrer l'essai gratuit
                                    <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
