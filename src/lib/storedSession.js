import { AUTH_STORAGE_KEY } from './supabase';

/**
 * Session encore enregistrée sur l'appareil, lue sans passer par le réseau.
 *
 * L'accès expire au bout d'une heure et se renouvelle par internet. Sans
 * réseau, supabase-js ne peut pas le renouveler : getSession() répond « pas de
 * session », alors qu'il GARDE la session en stockage — il ne l'efface que sur
 * une vraie déconnexion ou un jeton révoqué. Ouvrir l'app le matin sans réseau
 * renvoyait donc à l'écran de connexion, impossible à franchir hors-ligne.
 * Si la session est toujours là, on la reprend : les écritures partent dans la
 * file d'attente, et supabase-js renouvelle l'accès au retour du réseau.
 */
export const readStoredSession = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
        return stored?.user && stored?.refresh_token ? stored : null;
    } catch {
        return null;
    }
};
