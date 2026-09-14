import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { StatusBadge } from './StatusBadge';

// N'affiche rien tant que tout va bien (en ligne, aucune vente en attente) —
// ne sert que de signal quand quelque chose mérite l'attention de
// l'utilisateur : hors-ligne, ou synchronisation en cours au retour du
// réseau.
export const OfflineStatusBadge = () => {
    const { isOnline, pendingCount } = useOfflineStatus();

    if (isOnline && pendingCount === 0) return null;

    // "opération" plutôt que "vente" : la file contient désormais aussi les
    // dépenses, les dettes, les produits et les fournisseurs saisis sans réseau.
    const label = !isOnline
        ? (pendingCount > 0
            ? `Hors-ligne · ${pendingCount} opération${pendingCount > 1 ? 's' : ''} en attente`
            : 'Hors-ligne')
        : `Synchronisation de ${pendingCount} opération${pendingCount > 1 ? 's' : ''}...`;

    return (
        <StatusBadge
            label={label}
            tone={!isOnline ? 'amber' : 'blue'}
            className="px-3 py-2 text-xs shadow-premium shrink-0"
        />
    );
};
