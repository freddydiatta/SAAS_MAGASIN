// L'application sert des commerces au Sénégal : tout horodatage doit se lire
// en heure de Dakar, quel que soit le fuseau de l'appareil. Sans ça, un
// téléphone ou un ordinateur réglé sur Paris affichait une vente de 21h00
// comme faite à 23h00 — et, plus grave, la comptait dans la caisse du
// lendemain, puisque "minuit" y tombait deux heures trop tôt.
//
// Les dates sont stockées en UTC côté base (timezone('utc', now())) : c'est
// uniquement à l'affichage et au découpage des journées/mois qu'on repasse
// dans le fuseau du commerce.
export const BUSINESS_TIME_ZONE = 'Africa/Dakar';

const LOCALE = 'fr-FR';

const toDate = (value) => (value instanceof Date ? value : new Date(value));

// Décalage du fuseau du commerce par rapport à UTC, à un instant donné.
// Dérivé d'Intl plutôt qu'écrit en dur : le Sénégal est à UTC+0 toute
// l'année, mais rien dans ce module ne dépend de cette particularité.
const zoneOffsetMs = (date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: BUSINESS_TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    // hour12: false rend minuit "24" sur certains moteurs.
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    // Les parts n'ont pas les millisecondes : comparer à la seconde près.
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

export const formatDate = (value, options = {}) =>
    toDate(value).toLocaleDateString(LOCALE, { timeZone: BUSINESS_TIME_ZONE, ...options });

export const formatTime = (value, options = { hour: '2-digit', minute: '2-digit' }) =>
    toDate(value).toLocaleTimeString(LOCALE, { timeZone: BUSINESS_TIME_ZONE, ...options });

// Format court utilisé sur les factures et bons imprimés : "11/09/2026 21:30".
export const formatDateTime = (value) => `${formatDate(value)} ${formatTime(value)}`;

// Instant (en ms) de minuit, dans le fuseau du commerce, pour le jour qui
// contient `value`. Sert à borner "aujourd'hui" dans la caisse du jour.
export const startOfDay = (value = new Date()) => {
    const date = toDate(value);
    const offset = zoneOffsetMs(date);
    // Décalé dans le fuseau du commerce, on peut chercher minuit en UTC, puis
    // revenir à l'instant réel.
    const shifted = new Date(date.getTime() + offset);
    shifted.setUTCHours(0, 0, 0, 0);
    return shifted.getTime() - offset;
};

export const startOfToday = () => startOfDay(new Date());

// Année et mois (1-12) tels qu'ils se lisent dans le fuseau du commerce.
export const zonedYearMonth = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit',
    }).formatToParts(toDate(value));
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    return { year: get('year'), month: get('month') };
};

// Clé de regroupement mensuel "année-moisIndexéÀZéro", cohérente avec
// monthKeyFromParts ci-dessous pour que les deux se comparent directement.
export const monthKey = (value) => {
    const { year, month } = zonedYearMonth(value);
    return `${year}-${month - 1}`;
};

// Même clé, mais construite par arithmétique pure sur un décalage en mois.
// Passer par un objet Date pour reculer de N mois rouvrirait le bug de
// fuseau : le 1er septembre 00h00 à Paris, c'est encore le 31 août à Dakar.
export const monthKeyFromOffset = (monthsAgo, from = new Date()) => {
    const { year, month } = zonedYearMonth(from);
    const totalMonths = year * 12 + (month - 1) - monthsAgo;
    return { key: `${Math.floor(totalMonths / 12)}-${totalMonths % 12}`, monthIndex: totalMonths % 12, year: Math.floor(totalMonths / 12) };
};
