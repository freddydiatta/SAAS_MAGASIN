import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch current session
        const fetchSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
                
                if (session) {
                    // Valider cryptographiquement la session auprès du serveur
                    const { data: { user }, error } = await supabase.auth.getUser();
                    if (error) {
                        console.error("Session invalide ou expirée:", error.message);
                        setUser(null);
                    } else {
                        setUser(user ?? null);
                    }
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération de la session", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const value = {
        session,
        user,
        signOut: () => supabase.auth.signOut(),
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
