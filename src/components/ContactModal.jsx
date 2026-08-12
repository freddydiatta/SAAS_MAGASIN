import { useState, useEffect } from 'react';
import { IconX } from './icons';

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            
            <div className="relative bg-white rounded-2xl shadow-premium-lg w-full max-w-lg p-6 sm:p-8 animate-fade-in-up">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 text-secondary hover:bg-slate-200 hover:text-primary flex items-center justify-center transition-colors"
                >
                    <IconX />
                </button>

                {isSubmitted ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl font-bold">✓</span>
                        </div>
                        <h3 className="text-2xl font-bold text-primary mb-3">Message Envoyé !</h3>
                        <p className="text-secondary mb-8 text-sm leading-relaxed">
                            Nous avons bien reçu votre message. Notre équipe vous recontactera très prochainement.
                        </p>
                        <button 
                            onClick={() => {
                                onClose();
                                setTimeout(() => setIsSubmitted(false), 300); // reset after close
                            }}
                            className="btn-primary w-full py-3.5"
                        >
                            Fermer
                        </button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-2xl font-bold text-primary mb-2">Nous Contacter</h3>
                        <p className="text-secondary text-sm mb-8">
                            Une question sur nos tarifs ? Besoin d'une démo personnalisée ? Écrivez-nous !
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-primary mb-1.5">Votre Nom / Entreprise</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="Ex: Magasin Auto Mermoz"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-primary mb-1.5">Numéro de téléphone ou Email</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="Ex: +221 76 ... ou email@..."
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-primary mb-1.5">Comment pouvons-nous aider ?</label>
                                <textarea 
                                    required
                                    rows="4"
                                    className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                                    placeholder="Décrivez votre besoin..."
                                    value={formData.message}
                                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                                ></textarea>
                            </div>

                            <button type="submit" className="btn-primary w-full py-3.5 mt-2 flex items-center justify-center gap-2 group">
                                Envoyer le message
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};
