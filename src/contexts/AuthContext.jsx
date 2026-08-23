import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

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
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            if (session) {
                if (!navigator.onLine) {
                    // Si on est hors ligne, on utilise l'utilisateur de la session mise en cache
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
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
