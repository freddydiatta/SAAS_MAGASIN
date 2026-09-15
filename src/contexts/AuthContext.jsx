import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { readStoredSession } from '../lib/storedSession';

const AuthContext = createContext({});

// Attente maximale de supabase-js quand une session est déjà sur l'appareil.
const SESSION_WAIT_MS = 3000;

/**
 * Session courante, sans laisser l'app sur un écran blanc faute de réseau.
 *
 * Accès expiré et pas de réseau : supabase-js retente le renouvellement
 * pendant ~25 s avant de répondre, et l'app n'affiche rien pendant ce temps.
 * Si une session est enregistrée, on n'attend pas (hors-ligne) ou peu (réseau
 * lent) : undefined renvoie alors à la session enregistrée, et
 * onAuthStateChange corrige ensuite (TOKEN_REFRESHED, ou SIGNED_OUT si le
 * compte a été déconnecté entre-temps).
 */
const loadSession = async () => {
    // then à deux arguments : un échec de lecture ne doit pas rester en rejet
    // non géré quand on n'attend pas la réponse
    const pending = supabase.auth.getSession().then(({ data }) => data.session, () => undefined);
    if (!readStoredSession()) return pending;
    if (!navigator.onLine) return undefined;
    return Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve(undefined), SESSION_WAIT_MS)),
    ]);
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    // Extraite de l'effet pour pouvoir être rappelée à la demande (voir
    // refreshSession ci-dessous) — nécessaire après une restauration de
    // session hors-ligne (offlineCashierAuth.restoreSessionLocally), qui
    // écrit directement dans le storage sans passer par une méthode
    // supabase.auth qui déclencherait onAuthStateChange.
    const fetchSession = async () => {
        try {
            const loadedSession = await loadSession();
            // Pas de session renvoyée mais toujours une en stockage : l'accès
            // n'a simplement pas pu être renouvelé faute de réseau.
            const session = loadedSession ?? readStoredSession();
            setSession(session);

            if (session) {
                if (!navigator.onLine || loadedSession === undefined) {
                    // Hors ligne, ou supabase-js n'a pas encore répondu : on utilise
                    // l'utilisateur de la session enregistrée (getUser attendrait
                    // lui aussi le renouvellement de l'accès)
                    setUser(session.user);
                } else {
                    // Valider cryptographiquement la session auprès du serveur
                    const { data: { user }, error } = await supabase.auth.getUser();
                    if (error) {
                        console.error("Session invalide ou expirée:", error.message);
                        // Fallback au cas où l'erreur est liée au réseau
                        if (error.message.includes('fetch') || error.message.includes('Network')) {
                            setUser(session.user);
                        } else {
                            setUser(null);
                        }
                    } else {
                        setUser(user ?? null);
                    }
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Erreur lors de la récupération de la session", error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, eventSession) => {
            // Même repli qu'au démarrage : sans réseau, supabase-js annonce
            // une session vide alors qu'elle est toujours enregistrée. Seule
            // une vraie déconnexion (SIGNED_OUT) vide l'utilisateur à coup sûr.
            const session = eventSession ?? (_event === 'SIGNED_OUT' ? null : readStoredSession());
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            // Check for referral code in localStorage upon sign in
            if (session?.user && _event === 'SIGNED_IN') {
                const refCode = localStorage.getItem('gestionpro_ref');
                if (refCode) {
                    try {
                        const { error } = await supabase.rpc('register_referral', { ref_code: refCode });
                        if (!error) {
                            localStorage.removeItem('gestionpro_ref');
                        }
                    } catch (e) {
                        console.error('Error registering referral:', e);
                    }
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const value = {
        session,
        user,
        signOut: () => supabase.auth.signOut(),
        // Force une relecture de la session courante (sans repasser `loading`
        // à true, l'app est déjà montée) : utilisé après
        // restoreSessionLocally() pour que le reste de l'app voie
        // immédiatement la nouvelle identité restaurée hors-ligne.
        refreshSession: fetchSession,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
