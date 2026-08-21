import { useState } from 'react';
import { CreditCard, ShieldCheck, Lock } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { getPlanPrice } from '../config/pricing';
import { Modal } from './Modal';

export const BillingModal = ({ isExpired }) => {
    const { selectedBusiness } = useBusiness();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // Le montant affiché doit correspondre au plan réel du compte : avant ce
    // correctif, "15 000 FCFA" était codé en dur ici alors que le montant
    // effectivement facturé (paydunya-checkout) dépend du plan et pouvait
    // être différent.
    const price = getPlanPrice(user?.user_metadata?.subscription_plan);

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
            let errorMessage = "Impossible d'initialiser le paiement pour le moment.";
            
            // Try to extract the detailed error from Supabase Edge Function response
            if (error.context && typeof error.context.json === 'function') {
                try {
                    const errorData = await error.context.json();
                    if (errorData && errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    console.error("Could not parse error context", e);
                }
            } else if (error.message && error.message !== "Edge Function returned a non-2xx status code") {
                errorMessage = error.message;
            }

            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isExpired}
            onClose={() => {}}
            zIndexClassName="z-[100]"
            maxWidth="max-w-lg"
            panelClassName="bg-surface dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
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
                                <span className="text-lg font-bold text-primary">{price.toLocaleString('fr-FR')} FCFA</span>
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
        </Modal>
    );
};
