import { useState } from 'react';
import { Reveal } from './animations';
import { ChevronDown, Send, CheckCircle2, MessageCircleQuestion } from 'lucide-react';
import { submitContactMessage } from '../services/contactService';

// Contenu de départ, à faire évoluer avec les vraies questions reçues via
// le formulaire ci-dessous (voir contact_messages côté Supabase).
const FAQ_ITEMS = [
    {
        q: "Est-ce que GestionPro fonctionne sans connexion internet ?",
        a: "Oui. La caisse continue de fonctionner hors-ligne : les ventes sont enregistrées sur l'appareil et se synchronisent automatiquement dès que la connexion revient.",
    },
    {
        q: "GestionPro convient-il à mon type de commerce ?",
        a: "GestionPro s'adapte à plusieurs activités : boutique/quincaillerie, pièces moto, restaurant et location de villas — chacune avec son propre tableau de bord.",
    },
    {
        q: "Mes employés peuvent-ils avoir un accès limité ?",
        a: "Oui, vous pouvez créer des comptes caissier avec un code PIN. Ils ont accès à la caisse et à l'historique, mais pas aux paramètres ni à la sécurité du compte.",
    },
    {
        q: "Combien coûte l'abonnement ?",
        a: "Consultez la section Tarifs ci-dessus pour le détail des offres. Un essai gratuit est disponible pour tester l'application avant de vous engager.",
    },
    {
        q: "Mes données sont-elles en sécurité ?",
        a: "Vos données sont hébergées de façon sécurisée et cloisonnées par commerce : personne d'autre que vous et votre équipe n'y a accès.",
    },
];

function FAQAccordion() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => {
                const isOpen = openIndex === i;
                return (
                    <div key={i} className="bg-panel border border-slate-100 dark:border-border-theme rounded-2xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setOpenIndex(isOpen ? -1 : i)}
                            className="w-full flex items-center justify-between gap-4 p-5 text-left"
                            aria-expanded={isOpen}
                        >
                            <span className="font-bold text-primary">{item.q}</span>
                            <ChevronDown className={`w-5 h-5 text-secondary shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                            <p className="px-5 pb-5 text-secondary text-sm leading-relaxed">{item.a}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ContactForm() {
    const [formData, setFormData] = useState({ name: '', contactInfo: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await submitContactMessage(formData);
            setIsSubmitted(true);
            setFormData({ name: '', contactInfo: '', message: '' });
        } catch (err) {
            setError(err.message || "Erreur lors de l'envoi. Réessayez ou écrivez-nous directement.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Message envoyé !</h3>
                <p className="text-secondary text-sm mb-6">Nous vous répondrons rapidement.</p>
                <button type="button" onClick={() => setIsSubmitted(false)} className="text-accent font-bold text-sm hover:underline">
                    Envoyer un autre message
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium">
                    {error}
                </div>
            )}
            <div>
                <label className="block text-sm font-bold text-primary mb-2">Votre nom</label>
                <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-primary"
                    placeholder="Ex: Awa Diop"
                />
            </div>
            <div>
                <label className="block text-sm font-bold text-primary mb-2">Téléphone ou email</label>
                <input
                    type="text"
                    required
                    value={formData.contactInfo}
                    onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                    className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-primary"
                    placeholder="Ex: +221 77 123 45 67"
                />
            </div>
            <div>
                <label className="block text-sm font-bold text-primary mb-2">Votre question</label>
                <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-none text-primary"
                    placeholder="Posez votre question..."
                />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60">
                {isSubmitting ? 'Envoi...' : (<>Envoyer <Send className="w-4 h-4" /></>)}
            </button>
        </form>
    );
}

export const FAQContact = () => {
    return (
        <section id="contact" className="py-24 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[30rem] h-[30rem] rounded-full bg-accent/5 blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <Reveal>
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent font-bold rounded-full text-xs uppercase tracking-wider mb-6">
                            <MessageCircleQuestion className="w-4 h-4" /> Questions fréquentes
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-primary mb-4 tracking-tight">
                            Une question ? On vous répond.
                        </h2>
                        <p className="text-secondary text-lg">
                            Consultez les réponses aux questions les plus courantes, ou écrivez-nous directement.
                        </p>
                    </div>
                </Reveal>

                <div className="grid lg:grid-cols-2 gap-12">
                    <Reveal direction="left">
                        <FAQAccordion />
                    </Reveal>
                    <Reveal direction="right">
                        <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme p-8">
                            <h3 className="text-xl font-bold text-primary mb-1">Nous contacter</h3>
                            <p className="text-secondary text-sm mb-6">Nous répondons généralement sous 24h.</p>
                            <ContactForm />
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
};
