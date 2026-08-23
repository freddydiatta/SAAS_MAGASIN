// Un appel à supabase.functions.invoke('paydunya-checkout', ...) qui échoue
// renvoie une erreur générique ("Edge Function returned a non-2xx status
// code") — le vrai message (ex. l'erreur PayDunya elle-même) est dans le
// corps de la réponse, accessible seulement via error.context.json().
// Partagé entre BillingModal (renouvellement) et Parametres (changement de
// forfait), qui déclenchent tous les deux ce même appel.
export const extractPaydunyaErrorMessage = async (error, fallback = "Impossible d'initialiser le paiement pour le moment.") => {
    if (error.context && typeof error.context.json === 'function') {
        try {
            const errorData = await error.context.json();
            if (errorData && errorData.error) {
                return errorData.error;
            }
        } catch (e) {
            console.error('Could not parse error context', e);
        }
    } else if (error.message && error.message !== 'Edge Function returned a non-2xx status code') {
        return error.message;
    }
    return fallback;
};
