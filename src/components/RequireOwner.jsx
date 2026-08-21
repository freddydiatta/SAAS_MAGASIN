import { Navigate } from 'react-router-dom';
import { useBusiness } from '../contexts/BusinessContext';

// Bloque l'accès aux pages réservées au propriétaire (Paramètres : gestion
// des caissiers, facturation...) quand la session active est celle d'un
// caissier. isCashier reste `false` tant que le rôle n'est pas résolu, donc
// on n'autorise l'affichage qu'une fois currentMember chargé pour éviter un
// flash de contenu avant redirection.
export const RequireOwner = ({ children }) => {
    const { currentMember, isCashier } = useBusiness();

    if (!currentMember) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (isCashier) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};
