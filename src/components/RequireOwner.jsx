import { Navigate } from 'react-router-dom';
import { useBusiness } from '../contexts/BusinessContext';

// Bloque l'accès aux pages réservées au propriétaire (Paramètres : gestion
// des caissiers, facturation...) quand la session active est celle d'un
// caissier. On attend `memberResolved` (pas juste `currentMember`) avant
// d'autoriser l'affichage : `currentMember` reste `null` à la fois pendant
// le chargement ET quand la résolution aboutit à "aucune appartenance"
// (ex: caissier désactivé en cours de session) — se baser sur lui seul
// laissait ce second cas bloqué sur un spinner infini au lieu d'être
// redirigé.
export const RequireOwner = ({ children }) => {
    const { currentMember, isCashier, memberResolved } = useBusiness();

    if (!memberResolved) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (isCashier || !currentMember) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};
