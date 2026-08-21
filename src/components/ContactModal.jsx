import { useState, useEffect } from 'react';
import { X, CheckCircle2, Send } from 'lucide-react';
import { Modal } from './Modal';

export const ContactModal = ({ isOpen, onClose }) => {
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });

    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Simulation d'envoi
        setTimeout(() => setIsSubmitted(true), 500);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            closeOnBackdropClick
            zIndexClassName="z-[100]"
            maxWidth="max-w-lg"
            panelClassName="relative bg-white dark:bg-panel rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-100 dark:border-border-theme overflow-hidden"
        >
            {/* Decoration */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 rounded-full blur-3xl -mr-16 -mt-16 z-0"></div>

            <button
                onClick={onClose}
                aria-label="Fermer"
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 text-secondary hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary flex items-center justify-center transition-colors z-20 border border-slate-200 dark:border-slate-700"
            >
                <X className="w-5 h-5" />
            </button>

            {isSubmitted ? (
                <div className="text-center py-8 relative z-10">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center mx-auto mb-6 border-8 border-emerald-50 dark:border-emerald-900/10">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black text-primary mb-3">Message Envoyé !</h3>
                    <p className="text-secondary mb-8 text-sm font-medium leading-relaxed max-w-sm mx-auto">
                        Nous avons bien reçu votre message. Notre équipe vous recontactera très prochainement.
                    </p>
                    <button
                        onClick={() => {
                            onClose();
                            setTimeout(() => setIsSubmitted(false), 300); // reset after close
                        }}
                        className="bg-primary text-white w-full py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            ) : (
                <div className="relative z-10">
                    <h3 className="text-3xl font-black text-primary mb-2">Nous Contacter</h3>
                    <p className="text-secondary text-sm font-medium mb-8">
                        Une question sur nos tarifs ? Besoin d'une démo personnalisée ? Écrivez-nous !
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-primary mb-2">Votre Nom / Entreprise</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all dark:text-white"
                                placeholder="Ex: Magasin Auto Mermoz"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-primary mb-2">Numéro de téléphone ou Email</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all dark:text-white"
                                placeholder="Ex: +221 76 ... ou email@..."
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-primary mb-2">Comment pouvons-nous aider ?</label>
                            <textarea
                                required
                                rows="4"
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none dark:text-white"
                                placeholder="Décrivez votre besoin..."
                                value={formData.message}
                                onChange={(e) => setFormData({...formData, message: e.target.value})}
                            ></textarea>
                        </div>

                        <button type="submit" className="bg-accent hover:bg-accentHover text-white w-full py-4 rounded-xl font-bold mt-4 flex items-center justify-center gap-2 group transition-all shadow-lg shadow-accent/20">
                            Envoyer le message
                            <Send className="w-4 h-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                </div>
            )}
        </Modal>
    );
};
