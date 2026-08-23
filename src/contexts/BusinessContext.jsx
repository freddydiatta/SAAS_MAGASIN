import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { cacheCashierCredentials, verifyPinOffline, restoreSessionLocally, findCachedCashierByUserId } from '../services/offlineCashierAuth';

const BusinessContext = createContext({});

// Email du propriétaire mis de côté pendant qu'un caissier est actif, pour
// pré-remplir/valider le retour au compte propriétaire (qui redemande le
// mot de passe — cf. switchBackToOwner). En sessionStorage : effacé à la
// fermeture de l'onglet, pas persisté entre appareils. On ne stocke plus
// les jetons de session ici : le retour au propriétaire ré-authentifie
// réellement plutôt que de restaurer un jeton en mémoire.
const OWNER_SESSION_KEY = 'gestionpro_owner_session';

export const BusinessProvider = ({ children }) => {
    const { user, refreshSession } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentMember, setCurrentMember] = useState(null); // { role: 'owner' | 'cashier', name }
    // `currentMember` reste `null` à la fois pendant la résolution ET quand
    // elle aboutit à "aucune appartenance" (ex: caissier désactivé en cours
    // de session) — sans ce flag distinct, RequireOwner ne pouvait pas
    // différencier les deux et affichait un spinner infini dans le second cas.
    const [memberResolved, setMemberResolved] = useState(false);
    // Erreur réseau/RLS lors du chargement des commerces : jusqu'ici seulement
    // journalisée en console, donc un échec faisait afficher "Créer votre
    // premier magasin" à un propriétaire qui a pourtant déjà un commerce en
    // base — indiscernable d'un compte réellement vide sans ce champ.
    const [fetchError, setFetchError] = useState('');

    const fetchBusinesses = async () => {
        if (!user) {
            setBusinesses([]);
            setSelectedBusiness(null);
            setFetchError('');
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

            setFetchError('');
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
            setFetchError(error.message || 'Impossible de charger vos commerces.');
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
            setMemberResolved(false);
            if (!user || !selectedBusiness) {
                setCurrentMember(null);
                setMemberResolved(true);
                return;
            }
            if (selectedBusiness.user_id === user.id) {
                setCurrentMember({ role: 'owner', name: null });
                setMemberResolved(true);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('business_members_safe')
                    .select('name, role')
                    .eq('business_id', selectedBusiness.id)
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (error) throw error;
                setCurrentMember(data ? { role: data.role, name: data.name } : null);
            } catch (error) {
                // Cette requête réseau échoue systématiquement hors-ligne — sans
                // ce repli, un switchToCashierOffline réussi laissait quand même
                // l'app bloquée sur memberResolved=false (spinner infini sur les
                // pages RequireOwner) ou sur l'ancien rôle, puisque cet effet ne
                // pouvait jamais aboutir. Le cache local du switch hors-ligne
                // connaît déjà ce caissier par son user id.
                console.error('Impossible de résoudre le rôle en ligne, repli sur le cache hors-ligne:', error.message);
                const cachedMember = await findCachedCashierByUserId(user.id);
                setCurrentMember(cachedMember);
            }
            setMemberResolved(true);
        };
        resolveMembership();
    }, [user, selectedBusiness]);

    const selectBusiness = (business) => {
        setSelectedBusiness(business);
        localStorage.setItem('gestionpro_selected_business', business.id);
    };

    // Bascule la session vers le vrai compte du caissier (obtenu via
    // cashierLogin) après vérification du PIN côté serveur. L'email du
    // propriétaire est mis de côté pour permettre le retour (qui redemande
    // le mot de passe, cf. switchBackToOwner). La tentative de connexion
    // (succès/échec de PIN) est déjà journalisée côté Edge Function
    // cashier-login, pas besoin de le refaire ici.
    // memberId/name/pinHash (présents seulement pour un vrai caissier, pas
    // pour switchBackToOwner qui réutilise indirectement ce chemin) mettent
    // ce caissier en cache pour switchToCashierOffline.
    const switchToCashier = async ({ email, password, memberId, name, pinHash }) => {
        // Ne jamais écraser un email déjà mis de côté : un caissier peut
        // maintenant basculer directement vers un autre caissier (sans
        // repasser par le propriétaire), et currentSession serait alors
        // celle du premier caissier, pas celle du propriétaire — l'écraser
        // ferait perdre définitivement l'email du vrai propriétaire.
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user?.email && !sessionStorage.getItem(OWNER_SESSION_KEY)) {
            sessionStorage.setItem(OWNER_SESSION_KEY, currentSession.user.email);
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (memberId && pinHash && data?.session) {
            try {
                await cacheCashierCredentials(memberId, { name, pinHash, session: data.session });
            } catch (cacheError) {
                // La connexion elle-même a déjà réussi (onAuthStateChange a
                // déjà basculé l'app vers ce caissier) — un souci de mise en
                // cache (ex: quota IndexedDB, navigation privée) ne doit pas
                // faire remonter d'erreur ici, sinon SwitchUserModal
                // afficherait un échec pour une bascule qui a en fait marché.
                // Conséquence : ce caissier ne sera simplement pas
                // disponible hors-ligne tant qu'un switch ne réussit pas à
                // se mettre en cache.
                console.error('Impossible de mettre ce caissier en cache pour un usage hors-ligne:', cacheError.message);
            }
        }
    };

    // Même bascule, mais sans réseau : le PIN est vérifié contre le hash mis
    // en cache lors d'un précédent switchToCashier réussi EN LIGNE pour ce
    // même caissier sur cet appareil (cf. offlineCashierAuth.js). Si ce
    // caissier n'a jamais été utilisé en ligne ici, ou que le PIN est faux,
    // on échoue proprement plutôt que de laisser l'utilisateur bloqué.
    //
    // Volontairement PAS supabase.auth.setSession() ici : cette méthode fait
    // toujours un aller-retour réseau (vérification du jeton côté serveur,
    // ou rafraîchissement s'il est expiré) même pour un jeton encore valide
    // — elle échouait donc systématiquement hors-ligne ("Load failed").
    // restoreSessionLocally() écrit directement la session dans le storage
    // que supabase-js lit lui-même, sans jamais appeler le réseau.
    const switchToCashierOffline = async (memberId, pin) => {
        const result = await verifyPinOffline(memberId, pin);
        if (!result.success) {
            if (result.reason === 'not_cached') {
                throw new Error("Ce caissier n'a jamais été utilisé sur cet appareil en étant en ligne — connectez-vous une fois en ligne avec lui pour l'activer hors-ligne.");
            }
            if (result.reason === 'locked') {
                throw new Error('Trop de tentatives. Réessayez dans quelques minutes.');
            }
            throw new Error('PIN invalide.');
        }

        // Un jeton en cache réellement expiré (session mise en cache il y a
        // plus d'~1h, la durée de vie par défaut d'un access_token Supabase)
        // ne peut pas être rafraîchi sans réseau — mieux vaut le dire
        // clairement ici que de laisser getSession() essayer, échouer, et
        // vider tout l'état d'authentification de l'app.
        const expiresAt = result.session?.expires_at;
        if (expiresAt && expiresAt * 1000 <= Date.now()) {
            throw new Error('La session mise en cache pour ce caissier a expiré. Reconnectez-le une fois en ligne pour la renouveler.');
        }

        // Même précaution que dans switchToCashier : ne jamais écraser un
        // email de propriétaire déjà mis de côté par un switch caissier ->
        // caissier direct.
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user?.email && !sessionStorage.getItem(OWNER_SESSION_KEY)) {
            sessionStorage.setItem(OWNER_SESSION_KEY, currentSession.user.email);
        }

        restoreSessionLocally(result.session);
        await refreshSession();
    };

    // Redemande le mot de passe du propriétaire : ré-authentification
    // réelle (pas de restauration silencieuse d'un jeton mis de côté), pour
    // qu'un appareil laissé en mode caissier ne permette pas de revenir au
    // compte propriétaire sans preuve d'identité.
    const switchBackToOwner = async (password) => {
        const ownerEmail = sessionStorage.getItem(OWNER_SESSION_KEY);
        if (!ownerEmail) {
            await supabase.auth.signOut();
            return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: ownerEmail, password });
        if (error) {
            // supabase.rpc() est un thenable, pas une vraie Promise (voir
            // Login.jsx) — et surtout, s'il échoue (ex: hors-ligne), il ne
            // doit jamais remplacer l'erreur réelle (mauvais mot de passe,
            // ou panne réseau) qu'on s'apprête à relancer juste après.
            supabase.rpc('log_failed_login', { p_email: ownerEmail }).then(undefined, () => {});
            throw error;
        }
        sessionStorage.removeItem(OWNER_SESSION_KEY);
        supabase.rpc('log_login_success').then(undefined, () => {});
    };

    const hasOwnerSessionStashed = () => !!sessionStorage.getItem(OWNER_SESSION_KEY);
    const getStashedOwnerEmail = () => sessionStorage.getItem(OWNER_SESSION_KEY);

    return (
        <BusinessContext.Provider value={{
            businesses,
            selectedBusiness,
            selectBusiness,
            loading,
            fetchError,
            refreshBusinesses: fetchBusinesses,
            currentMember,
            memberResolved,
            isCashier: currentMember?.role === 'cashier',
            switchToCashier,
            switchToCashierOffline,
            switchBackToOwner,
            hasOwnerSessionStashed,
            getStashedOwnerEmail
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
