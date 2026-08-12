import { Reveal } from './animations';

export const Features = () => {
    const features = [
        {
            title: "Gestion des Pièces",
            description: "Ajoutez, modifiez et suivez vos pièces détachées. Recevez des alertes avant la rupture de stock.",
            icon: "🔧",
            color: "bg-yellow-400"
        },
        {
            title: "Vente de Motos",
            description: "Gérez votre inventaire de motos, avec les numéros de châssis et les papiers associés.",
            icon: "🏍️",
            color: "bg-red-400"
        },
        {
            title: "Location de Villas",
            description: "Un calendrier visuel pour vos villas. Sachez quand c'est libre ou occupé en un clin d'œil.",
            icon: "🏠",
            color: "bg-green-400"
        },
        {
            title: "Caisse & Compta",
            description: "Votre caisse se calcule toute seule à chaque vente. Plus d'erreurs en fin de journée.",
            icon: "💵",
            color: "bg-blue-400"
        }
    ];

    return (
        <section id="features" className="py-24 bg-white border-b-4 border-primary">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal>
                    <div className="text-center mb-20">
                        <h2 className="text-primary font-black uppercase text-sm tracking-widest mb-4 inline-block px-4 py-1 border-4 border-primary bg-accent shadow-neo-sm">Toutes vos activités</h2>
                        <h3 className="text-4xl md:text-5xl font-black text-primary mt-4 uppercase">Un seul outil pour tout gérer.</h3>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {features.map((feature, idx) => (
                        <Reveal key={idx} delay={idx * 150}>
                            <div className="group relative bg-surface border-4 border-primary p-6 shadow-neo hover:-translate-y-2 hover:shadow-neo transition-all duration-300 h-full">
                                <div className={`absolute top-0 right-0 transform translate-x-2 -translate-y-4 w-12 h-12 border-4 border-primary ${feature.color} flex items-center justify-center text-2xl shadow-neo-sm rotate-6 group-hover:rotate-12 transition-transform`}>
                                    {feature.icon}
                                </div>
                                <h4 className="text-xl font-black text-primary mt-4 mb-4 uppercase">{feature.title}</h4>
                                <p className="text-primary font-bold">{feature.description}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
