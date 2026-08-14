import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, ShieldCheck, Lock } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export const BillingModal = ({ isExpired }) => {
    const { selectedBusiness } = useBusiness();
    const [isLoading, setIsLoading] = useState(false);

    if (!isExpired) return null;

    const handlePayment = async () => {
        setIsLoading(true);
        try {
            // Demander un lien de paiement via l'Edge Function PayDunya
            const { data, error } = await supabase.functions.invoke('paydunya-checkout', {
                body: { business_id: selectedBusiness.id }
            });

            if (error) throw error;
            if (data?.invoice_url) {
                // Rediriger vers la page de paiement PayDunya
                window.location.href = data.invoice_url;
            } else {
                throw new Error("Lien de paiement non reçu");
            }
        } catch (error) {
            console.error('Erreur de paiement:', error);
            toast.error("Impossible d'initialiser le paiement pour le moment.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="bg-surface dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
                >
                    <div className="p-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Lock className="w-10 h-10" />
                        </div>
                        
                        <div>
                            <h2 className="text-2xl font-bold text-primary mb-2">Abonnement Expiré</h2>
                            <p className="text-secondary text-base">
                                L'accès au magasin <span className="font-bold text-primary">{selectedBusiness?.name}</span> est suspendu car votre abonnement est arrivé à expiration.
                            </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-left space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
                                <span className="text-secondary font-medium">Forfait Mensuel</span>
                                <span className="text-lg font-bold text-primary">15 000 FCFA</span>
                            </div>
                            
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-sm text-secondary">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                    Accès complet à la gestion du magasin
                                </li>
                                <li className="flex items-center gap-3 text-sm text-secondary">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                    Synchronisation hors-ligne sécurisée
                                </li>
                                <li className="flex items-center gap-3 text-sm text-secondary">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                    Sauvegarde cloud automatique
                                </li>
                            </ul>
                        </div>

                        <button 
                            onClick={handlePayment}
                            disabled={isLoading}
                            className="w-full bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-premium"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <CreditCard className="w-6 h-6" />
                                    Payer avec PayDunya
                                </>
                            )}
                        </button>
                        
                        <p className="text-xs text-slate-400 font-medium">
                            Paiement sécurisé via Wave, Orange Money ou Free Money.
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
