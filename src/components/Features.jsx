import { Reveal } from './animations';
import { IconBox, IconLayers, IconSmile } from './icons';

export const Features = () => {
    const features = [
        {
            title: "Gestion des stocks",
            description: "Suivez précisément chaque pièce détachée ou véhicule. Soyez alerté avant la rupture de stock.",
            icon: <IconBox />
        },
        {
            title: "Multi-activités",
            description: "Passez de la vente de biens à la gestion de vos locations de villas en un seul clic.",
            icon: <IconLayers />
        },
        {
            title: "Simplicité extrême",
            description: "Pas besoin d'être un expert en informatique. C'est aussi simple à utiliser qu'une application de messagerie.",
            icon: <IconSmile />
        }
    ];

    return (
        <section id="features" className="py-24 bg-white relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <Reveal>
                    <div className="text-center mb-16">
                        <h2 className="text-accent font-bold tracking-wide uppercase mb-3">Fonctionnalités</h2>
                        <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900">Pensé pour votre réalité.</h3>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-3 gap-8">
                    {features.map((feature, idx) => (
                        <Reveal key={idx} delay={idx * 150}>
                            <div className="bg-surface rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 group cursor-pointer hover:-translate-y-2 h-full">
                                <div className="w-16 h-16 rounded-xl bg-white shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                    {feature.icon}
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h4>
                                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
