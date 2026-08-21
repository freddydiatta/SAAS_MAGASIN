// Source unique des tarifs d'abonnement côté frontend. Le montant réellement
// facturé est calculé côté serveur (supabase/functions/paydunya-checkout),
// qui tourne sur Deno et ne peut pas importer ce fichier directement : il
// doit être maintenu en miroir manuellement là-bas (voir le commentaire dans
// ce fichier). Toute mise à jour de tarif doit changer les deux endroits.
export const DEFAULT_PLAN = 'essentiel';

export const SUBSCRIPTION_PLANS = {
    essentiel: { id: 'essentiel', label: 'Pack Essentiel', price: 5000 },
    business: { id: 'business', label: 'Pack Business', price: 9000 },
};

export const getPlan = (planId) => SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS[DEFAULT_PLAN];
export const getPlanPrice = (planId) => getPlan(planId).price;
export const getPlanLabel = (planId) => getPlan(planId).label;
