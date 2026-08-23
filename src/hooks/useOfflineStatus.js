import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOfflineSalesCount } from '../services/syncService';

// État de connectivité + nombre de ventes en attente de synchronisation :
// avant, rien dans l'interface n'indiquait à l'utilisateur qu'il travaillait
// hors-ligne ou qu'il avait des ventes non encore envoyées à Supabase.
// Le compte est en poll (React Query) plutôt qu'en événement, car
// saveOfflineSale/syncOfflineSales écrivent directement dans IndexedDB sans
// mécanisme de notification — invalidateQueries(['offlineSalesPending'])
// est appelé aux deux endroits pour rafraîchir ce badge sans attendre le
// prochain poll.
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
        queryFn: getOfflineSalesCount,
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
    });

    return { isOnline, pendingCount };
}
