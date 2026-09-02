import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Users, Ban, RotateCcw, Crown, CreditCard, Bell, BellOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { listCashiers, createCashier, setCashierActive } from '../../services/cashiersService';
import { savePushSubscription, deletePushSubscriptionByEndpoint } from '../../services/pushSubscriptionsService';
import { Modal } from '../../components/Modal';
import { cashierSchema, firstZodError } from '../../lib/validation';
import { DEFAULT_PLAN, SUBSCRIPTION_PLANS } from '../../config/pricing';
import { supabase } from '../../lib/supabase';
import { extractPaydunyaErrorMessage } from '../../lib/paydunyaError';
import { isPushSupported, urlBase64ToUint8Array } from '../../lib/webPush';

export const Parametres = () => {
    const { selectedBusiness } = useBusiness();
    const { user, refreshSession } = useAuth();
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [formError, setFormError] = useState('');
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [isDowngrading, setIsDowngrading] = useState(false);
    const [pushStatus, setPushStatus] = useState('checking'); // checking | unsupported | denied | subscribed | unsubscribed
    const [isTogglingPush, setIsTogglingPush] = useState(false);

    const currentPlan = user?.user_metadata?.subscription_plan || DEFAULT_PLAN;

    useEffect(() => {
        if (!selectedBusiness || !user) return;
        if (!isPushSupported()) {
            setPushStatus('unsupported');
            return;
        }
        if (Notification.permission === 'denied') {
            setPushStatus('denied');
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (cancelled) return;
                if (subscription) {
                    // Un abonnement navigateur n'est rattaché qu'à un seul
                    // business à la fois (unique sur endpoint côté base) — le
                    // re-rattacher au business actuellement sélectionné à
                    // chaque changement de contexte.
                    await savePushSubscription({ businessId: selectedBusiness.id, userId: user.id, subscription });
                    setPushStatus('subscribed');
                } else {
                    setPushStatus('unsubscribed');
                }
            } catch {
                if (!cancelled) setPushStatus('unsubscribed');
            }
        })();

        return () => { cancelled = true; };
    }, [selectedBusiness?.id, user?.id]);

    const handleEnablePush = async () => {
        setIsTogglingPush(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setPushStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
                return;
            }
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
            });
            await savePushSubscription({ businessId: selectedBusiness.id, userId: user.id, subscription });
            setPushStatus('subscribed');
            toast.success('Notifications activées !');
        } catch (error) {
            console.error('Erreur activation notifications:', error);
            toast.error("Impossible d'activer les notifications pour le moment.");
        } finally {
            setIsTogglingPush(false);
        }
    };

    const handleDisablePush = async () => {
        setIsTogglingPush(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await deletePushSubscriptionByEndpoint(subscription.endpoint);
                await subscription.unsubscribe();
            }
            setPushStatus('unsubscribed');
            toast.success('Notifications désactivées.');
        } catch (error) {
            console.error('Erreur désactivation notifications:', error);
            toast.error('Impossible de désactiver les notifications pour le moment.');
        } finally {
            setIsTogglingPush(false);
        }
    };

    const handleUpgrade = async () => {
        setIsUpgrading(true);
        try {
            const { data, error } = await supabase.functions.invoke('paydunya-checkout', {
                body: { business_id: selectedBusiness.id, target_plan: 'business' }
            });
            if (error) throw error;
            if (data?.invoice_url) {
                window.location.href = data.invoice_url;
            } else {
                throw new Error('Lien de paiement non reçu');
            }
        } catch (error) {
            console.error('Erreur de mise à niveau:', error);
            toast.error(await extractPaydunyaErrorMessage(error, "Impossible d'initialiser la mise à niveau pour le moment."));
        } finally {
            setIsUpgrading(false);
        }
    };

    // Repasser en Essentiel ne nécessite pas de paiement (le prix baisse au
    // prochain renouvellement, cf. BillingModal qui relit toujours le plan
    // courant) — juste une confirmation, puisque ça remet la limite d'1
    // magasin pour toute nouvelle création (les magasins déjà créés restent
    // accessibles, le trigger enforce_business_plan_limit ne s'applique
    // qu'aux nouvelles insertions).
    const handleDowngrade = async () => {
        if (!window.confirm(
            "Repasser au Pack Essentiel limite la création de nouveaux magasins à 1 seul. Vos magasins déjà créés restent accessibles. Continuer ?"
        )) {
            return;
        }
        setIsDowngrading(true);
        try {
            const { error } = await supabase.auth.updateUser({ data: { subscription_plan: 'essentiel' } });
            if (error) throw error;
            await refreshSession();
            toast.success('Vous êtes maintenant sur le Pack Essentiel.');
        } catch (error) {
            console.error('Erreur de changement de forfait:', error);
            toast.error(error.message || 'Impossible de changer de forfait pour le moment.');
        } finally {
            setIsDowngrading(false);
        }
    };

    const { data: cashiers = [], isLoading } = useQuery({
        queryKey: ['cashiers', selectedBusiness?.id],
        queryFn: () => listCashiers(selectedBusiness.id),
        enabled: !!selectedBusiness,
    });

    const invalidateCashiers = () => queryClient.invalidateQueries({ queryKey: ['cashiers', selectedBusiness?.id] });

    const createMutation = useMutation({
        mutationFn: () => createCashier({ businessId: selectedBusiness.id, name: name.trim(), pin }),
        onSuccess: () => {
            invalidateCashiers();
            toast.success('Caissier ajouté !');
            setIsAddOpen(false);
            setName('');
            setPin('');
            setFormError('');
        },
        onError: (error) => {
            setFormError(error.message || "Erreur lors de l'ajout du caissier.");
        },
    });

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, isActive }) => setCashierActive({ id, isActive }),
        onSuccess: (_, { isActive }) => {
            invalidateCashiers();
            toast.success(isActive ? 'Caissier réactivé.' : 'Caissier désactivé.');
        },
        onError: () => toast.error("Erreur lors de la mise à jour du caissier."),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError('');

        const result = cashierSchema.safeParse({ name, pin });
        if (!result.success) {
            setFormError(firstZodError(result));
            return;
        }

        createMutation.mutate();
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
            <div>
                <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Paramètres</h1>
                <p className="text-secondary text-sm">Gérez votre commerce et votre équipe.</p>
            </div>

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                            <Crown className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-primary">
                                Abonnement — {SUBSCRIPTION_PLANS[currentPlan].label}
                            </h2>
                            <p className="text-xs text-secondary">
                                {currentPlan === 'business'
                                    ? 'Magasins illimités.'
                                    : `1 magasin inclus · ${SUBSCRIPTION_PLANS[currentPlan].price.toLocaleString('fr-FR')} FCFA/mois`}
                            </p>
                        </div>
                    </div>
                    {currentPlan !== 'business' ? (
                        <button
                            onClick={handleUpgrade}
                            disabled={isUpgrading}
                            className="bg-accent hover:bg-accent-hover text-white font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-premium text-sm shrink-0 disabled:opacity-50"
                        >
                            <CreditCard className="w-4 h-4" />
                            {isUpgrading ? 'Redirection...' : `Passer au ${SUBSCRIPTION_PLANS.business.label} (${SUBSCRIPTION_PLANS.business.price.toLocaleString('fr-FR')} FCFA/mois)`}
                        </button>
                    ) : (
                        <button
                            onClick={handleDowngrade}
                            disabled={isDowngrading}
                            className="text-secondary hover:text-primary font-medium px-4 py-2.5 rounded-xl transition-colors text-sm shrink-0 disabled:opacity-50 underline decoration-dotted underline-offset-4"
                        >
                            {isDowngrading ? 'Changement...' : `Repasser au ${SUBSCRIPTION_PLANS.essentiel.label}`}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                            <Bell className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-primary">Notifications de stock bas</h2>
                            <p className="text-xs text-secondary">
                                {pushStatus === 'unsupported' && "Non disponible sur ce navigateur."}
                                {pushStatus === 'denied' && "Bloqué par le navigateur — réactivez les notifications dans les réglages du site."}
                                {pushStatus === 'checking' && 'Vérification...'}
                                {pushStatus === 'subscribed' && "Vous recevrez une alerte sur cet appareil quand un produit passe en stock bas."}
                                {pushStatus === 'unsubscribed' && "Recevez une alerte sur cet appareil quand un produit passe en stock bas."}
                            </p>
                        </div>
                    </div>
                    {(pushStatus === 'subscribed' || pushStatus === 'unsubscribed') && (
                        <button
                            onClick={pushStatus === 'subscribed' ? handleDisablePush : handleEnablePush}
                            disabled={isTogglingPush}
                            className={`font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 text-sm shrink-0 disabled:opacity-50 ${
                                pushStatus === 'subscribed'
                                    ? 'text-secondary hover:text-primary underline decoration-dotted underline-offset-4'
                                    : 'bg-accent hover:bg-accent-hover text-white shadow-premium'
                            }`}
                        >
                            {pushStatus === 'subscribed' ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                            {isTogglingPush ? 'Patientez...' : pushStatus === 'subscribed' ? 'Désactiver' : 'Activer les notifications'}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-border-theme flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-primary">Caissiers</h2>
                            <p className="text-xs text-secondary">Chaque caissier se connecte avec un code PIN à 4 chiffres. Ils ont accès à tout sauf cette page.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-premium text-sm shrink-0"
                    >
                        <UserPlus className="w-4 h-4" /> Nouveau caissier
                    </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-border-theme">
                    {isLoading ? (
                        <p className="p-6 text-center text-secondary text-sm">Chargement...</p>
                    ) : cashiers.length === 0 ? (
                        <p className="p-6 text-center text-secondary text-sm">Aucun caissier pour le moment.</p>
                    ) : (
                        cashiers.map(cashier => (
                            <div key={cashier.id} className="p-4 px-6 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-primary">{cashier.name}</p>
                                    <p className="text-xs text-secondary">
                                        {cashier.is_active ? 'Actif' : 'Désactivé'} · ajouté le {new Date(cashier.created_at).toLocaleDateString('fr-FR')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => toggleActiveMutation.mutate({ id: cashier.id, isActive: !cashier.is_active })}
                                    disabled={toggleActiveMutation.isPending}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        cashier.is_active
                                            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                    }`}
                                >
                                    {cashier.is_active ? <Ban className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                                    {cashier.is_active ? 'Désactiver' : 'Réactiver'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Nouveau caissier">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                            {formError}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Nom du caissier</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                            placeholder="Ex: Awa"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Code PIN (4 chiffres)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            required
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 tracking-[0.5em] font-bold text-lg"
                            placeholder="••••"
                        />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsAddOpen(false)}
                            className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover shadow-md transition-all disabled:opacity-50"
                        >
                            {createMutation.isPending ? 'Création...' : 'Créer'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
