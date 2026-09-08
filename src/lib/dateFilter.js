// Filtre par date partagé entre Historique des ventes et Sécurité (logs
// d'audit) : mêmes préréglages (7 jours / 30 jours / période personnalisée),
// une seule implémentation. `getDate` extrait la date de chaque élément
// (created_at, souvent), pour rester générique entre receipts et logs.
export const filterByDateRange = (items, getDate, { dateFilter, customFrom, customTo }) => {
    if (!dateFilter || dateFilter === 'all') return items;

    if (dateFilter === '7d' || dateFilter === '30d') {
        const days = dateFilter === '7d' ? 7 : 30;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        cutoff.setHours(0, 0, 0, 0);
        return items.filter((item) => new Date(getDate(item)) >= cutoff);
    }

    if (dateFilter === 'custom') {
        if (!customFrom && !customTo) return items;
        const from = customFrom ? new Date(customFrom) : null;
        const to = customTo ? new Date(customTo) : null;
        if (to) to.setHours(23, 59, 59, 999);
        return items.filter((item) => {
            const d = new Date(getDate(item));
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });
    }

    return items;
};
