import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const BusinessContext = createContext({});

// Session propriétaire mise de côté pendant qu'un caissier est actif, pour
// pouvoir "revenir" sans ressaisir email/mot de passe. En sessionStorage :
// effacée à la fermeture de l'onglet, pas persistée entre appareils.
const OWNER_SESSION_KEY = 'gestionpro_owner_session';

export const BusinessProvider = ({ children }) => {
    const { user } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentMember, setCurrentMember] = useState(null); // { role: 'owner' | 'cashier', name }

    const fetchBusinesses = async () => {
        if (!user) {
            setBusinesses([]);
            setSelectedBusiness(null);
            setLoading(false);
            return;
        }

        try {
            // Pas de filtre .eq('user_id', ...) ici : la RLS (is_business_member)
            // scope déjà le résultat aux commerces possédés OU dont l'utilisateur
            // connecté (propriétaire ou caissier) est membre.
            const { data, error } = await supabase
                .from('businesses')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            
            setBusinesses(data || []);
            
            // Auto-select if a business was previously selected in localStorage
            const savedBusinessId = localStorage.getItem('gestionpro_selected_business');
            if (savedBusinessId && data?.find(b => b.id === savedBusinessId)) {
                setSelectedBusiness(data.find(b => b.id === savedBusinessId));
            } else if (data && data.length > 0) {
                // Otherwise auto-select the first one
                setSelectedBusiness(data[0]);
                localStorage.setItem('gestionpro_selected_business', data[0].id);
            } else {
                setSelectedBusiness(null);
            }
        } catch (error) {
            console.error('Error fetching businesses:', error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBusinesses();
    }, [user]);

    // Détermine si l'utilisateur connecté est le propriétaire du commerce
    // sélectionné, ou un caissier (business_members) — et son nom d'affichage.
    useEffect(() => {
        const resolveMembership = async () => {
            if (!user || !selectedBusiness) {
                setCurrentMember(null);
                return;
            }
            if (selectedBusiness.user_id === user.id) {
                setCurrentMember({ role: 'owner', name: null });
                return;
            }
            const { data } = await supabase
                .from('business_members_safe')
                .select('name, role')
                .eq('business_id', selectedBusiness.id)
                .eq('user_id', user.id)
                .maybeSingle();
            setCurrentMember(data ? { role: data.role, name: data.name } : null);
        };
        resolveMembership();
    }, [user, selectedBusiness]);

    const selectBusiness = (business) => {
        setSelectedBusiness(business);
        localStorage.setItem('gestionpro_selected_business', business.id);
    };

    // Bascule la session vers le vrai compte du caissier (obtenu via
    // cashierLogin) après vérification du PIN côté serveur. La session
    // propriétaire en cours est mise de côté pour permettre d'y revenir.
    const switchToCashier = async ({ email, password }) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            sessionStorage.setItem(OWNER_SESSION_KEY, JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            }));
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const switchBackToOwner = async () => {
        const stored = sessionStorage.getItem(OWNER_SESSION_KEY);
        sessionStorage.removeItem(OWNER_SESSION_KEY);
        if (!stored) {
            await supabase.auth.signOut();
            return;
        }
        const { access_token, refresh_token } = JSON.parse(stored);
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
    };

    const hasOwnerSessionStashed = () => !!sessionStorage.getItem(OWNER_SESSION_KEY);

    return (
        <BusinessContext.Provider value={{
            businesses,
            selectedBusiness,
            selectBusiness,
            loading,
            refreshBusinesses: fetchBusinesses,
            currentMember,
            isCashier: currentMember?.role === 'cashier',
            switchToCashier,
            switchBackToOwner,
            hasOwnerSessionStashed
        }}>
            {children}
        </BusinessContext.Provider>
    );
};

export const useBusiness = () => {
    const context = useContext(BusinessContext);
    if (!context) {
        throw new Error("useBusiness must be used within a BusinessProvider");
    }
    return context;
};
