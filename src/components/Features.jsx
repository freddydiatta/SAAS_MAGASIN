import { Reveal } from './animations';

export const Features = () => {
    const features = [
        {
            title: "Gestion des Pièces",
            description: "Ajoutez, modifiez et suivez vos pièces détachées. Recevez des alertes avant la rupture de stock.",
            icon: "🔧",
            color: "bg-amber-100 text-amber-600"
        },
        {
            title: "Vente de Motos",
            description: "Gérez votre inventaire de motos, avec les numéros de châssis et les papiers associés.",
            icon: "🏍️",
            color: "bg-blue-100 text-blue-600"
        },
        {
            title: "Location de Villas",
            description: "Un calendrier visuel pour vos villas. Sachez quand c'est libre ou occupé en un clin d'œil.",
            icon: "🏠",
            color: "bg-emerald-100 text-emerald-600"
        },
        {
            title: "Caisse & Compta",
            description: "Votre caisse se calcule toute seule à chaque vente. Plus d'erreurs en fin de journée.",
            icon: "💵",
            color: "bg-indigo-100 text-indigo-600"
        }
    ];

    return (
        <section id="features" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal>
                    <div className="text-center mb-20">
                        <div className="text-accent font-semibold uppercase text-sm tracking-wider mb-4">Toutes vos activités</div>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-primary mt-2 tracking-tight">Un seul outil pour tout gérer.</h2>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {features.map((feature, idx) => (
                        <Reveal key={idx} delay={idx * 150}>
                            <div className="group bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-premium transition-all duration-300 h-full">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-6 ${feature.color}`}>
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg font-bold text-primary mb-3">{feature.title}</h3>
                                <p className="text-secondary text-sm leading-relaxed">{feature.description}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
