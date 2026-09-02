import { supabase } from '../lib/supabase';

// Un endpoint (= un abonnement navigateur) est unique en base : un même
// appareil ne peut être rattaché qu'à un seul business à la fois. On upsert
// donc sur endpoint pour à la fois créer un nouvel abonnement et re-rattacher
// un abonnement existant au business actuellement sélectionné.
export const savePushSubscription = async ({ businessId, userId, subscription }) => {
    const json = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({
        business_id: businessId,
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
    }, { onConflict: 'endpoint' });
    if (error) throw error;
};

export const deletePushSubscriptionByEndpoint = async (endpoint) => {
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) throw error;
};
