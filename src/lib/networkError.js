// Libellés des échecs réseau selon le navigateur : Chrome « Failed to fetch »,
// Safari (iPhone) « Load failed », Firefox « NetworkError when attempting to
// fetch resource ». supabase-js les renvoie préfixés du type (« TypeError: »).
const NETWORK_FAILURE = /failed to fetch|load failed|networkerror|network request failed/i;

/**
 * L'échec vient-il du réseau (requête pas partie, réponse jamais arrivée)
 * plutôt que d'un refus du serveur (stock insuffisant, droits...) ?
 *
 * Un Wi-Fi sans internet laisse navigator.onLine à true : seule l'erreur dit
 * que rien n'est passé par la faute de la connexion, pas de l'opération.
 */
export const isNetworkError = (error) => {
    if (!error) return false;
    if (error.name === 'AuthRetryableFetchError') return true;
    return NETWORK_FAILURE.test(String(error.message ?? error));
};
