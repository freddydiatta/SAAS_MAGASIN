import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOutboxCount } from '../services/outbox';

// État de connectivité + nombre d'écritures en attente de synchronisation :
// avant, rien dans l'interface n'indiquait à l'utilisateur qu'il travaillait
// hors-ligne ou qu'il avait du travail non encore envoyé à Supabase.
// Ce n'est plus réservé aux ventes : dépenses, dettes, produits et
// fournisseurs passent par la même file (voir outbox.js), donc le badge
// compte toutes les opérations en attente, pas seulement les ventes.
// Le compte est en poll (React Query) plutôt qu'en événement, car la file
// écrit directement dans IndexedDB sans mécanisme de notification —
// invalidateQueries(['offlineSalesPending']) est appelé aux endroits qui
// l'alimentent pour rafraîchir ce badge sans attendre le prochain poll.
export function useOfflineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    const { data: pendingCount = 0 } = useQuery({
        queryKey: ['offlineSalesPending'],
        queryFn: getOutboxCount,
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
    });

    return { isOnline, pendingCount };
}
