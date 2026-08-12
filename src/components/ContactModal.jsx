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
            <div className="fixed inset-0 bg-primary/90 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            
            <div className="relative bg-white border-4 border-primary shadow-neo w-full max-w-lg p-6 sm:p-8 animate-fade-in-up">
                <button 
                    onClick={onClose}
                    className="absolute -top-4 -right-4 w-10 h-10 bg-red-400 border-4 border-primary flex items-center justify-center shadow-neo-sm hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all z-10"
                >
                    <IconX />
                </button>

                {isSubmitted ? (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-green-400 border-4 border-primary flex items-center justify-center mx-auto mb-6 shadow-neo-sm transform -rotate-6">
                            <span className="text-4xl text-primary font-black">✓</span>
                        </div>
                        <h3 className="text-3xl font-black text-primary uppercase mb-4">Message Envoyé !</h3>
                        <p className="text-primary font-bold mb-8 text-lg">
                            Nous avons bien reçu votre message. Notre équipe vous recontactera très prochainement.
                        </p>
                        <button 
                            onClick={() => {
                                onClose();
                                setTimeout(() => setIsSubmitted(false), 300); // reset after close
                            }}
                            className="neo-button bg-primary text-white w-full py-4 uppercase"
                        >
                            Fermer
                        </button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-3xl font-black text-primary uppercase mb-2 inline-block border-b-4 border-primary pb-2">Nous Contacter</h3>
                        <p className="text-primary font-bold mb-8">
                            Une question sur nos tarifs ? Besoin d'une démo personnalisée ? Écrivez-nous !
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-primary font-black uppercase mb-2">Votre Nom / Entreprise</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full bg-surface border-4 border-primary p-4 font-bold text-primary focus:outline-none focus:bg-white focus:ring-4 focus:ring-accent/50 transition-all"
                                    placeholder="Ex: Magasin Auto Mermoz"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-primary font-black uppercase mb-2">Numéro de téléphone ou Email</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full bg-surface border-4 border-primary p-4 font-bold text-primary focus:outline-none focus:bg-white focus:ring-4 focus:ring-accent/50 transition-all"
                                    placeholder="Ex: +221 77 ... ou email@..."
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-primary font-black uppercase mb-2">Comment pouvons-nous aider ?</label>
                                <textarea 
                                    required
                                    rows="4"
                                    className="w-full bg-surface border-4 border-primary p-4 font-bold text-primary focus:outline-none focus:bg-white focus:ring-4 focus:ring-accent/50 transition-all resize-none"
                                    placeholder="Décrivez votre besoin..."
                                    value={formData.message}
                                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                                ></textarea>
                            </div>

                            <button type="submit" className="neo-button bg-accentHover text-primary w-full py-4 text-lg uppercase flex items-center justify-center gap-2 group">
                                Envoyer le message
                                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};
