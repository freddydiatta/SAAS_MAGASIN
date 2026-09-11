import { startOfDay, startOfToday } from './dates';

// Filtre par date partagé entre Historique des ventes et Sécurité (logs
// d'audit) : mêmes préréglages (7 jours / 30 jours / période personnalisée),
// une seule implémentation. `getDate` extrait la date de chaque élément
// (created_at, souvent), pour rester générique entre receipts et logs.
const DAY_MS = 24 * 60 * 60 * 1000;

export const filterByDateRange = (items, getDate, { dateFilter, customFrom, customTo }) => {
    if (!dateFilter || dateFilter === 'all') return items;

    // Toutes les bornes sont des minuits en heure de Dakar (voir lib/dates) :
    // sinon "7 derniers jours" démarrait à 22h ou 23h la veille pour un
    // appareil réglé sur Paris, et incluait des ventes du jour d'avant.
    if (dateFilter === '7d' || dateFilter === '30d') {
        const days = dateFilter === '7d' ? 7 : 30;
        const cutoff = startOfDay(startOfToday() - (days - 1) * DAY_MS);
        return items.filter((item) => new Date(getDate(item)).getTime() >= cutoff);
    }

    if (dateFilter === 'custom') {
        if (!customFrom && !customTo) return items;
        // customFrom/customTo viennent d'un <input type="date"> : "2026-09-11"
        // désigne la journée entière, du minuit de Dakar au minuit suivant.
        const from = customFrom ? startOfDay(`${customFrom}T12:00:00Z`) : null;
        const to = customTo ? startOfDay(`${customTo}T12:00:00Z`) + DAY_MS : null;
        return items.filter((item) => {
            const time = new Date(getDate(item)).getTime();
            if (from !== null && time < from) return false;
            if (to !== null && time >= to) return false;
            return true;
        });
    }

    return items;
};
