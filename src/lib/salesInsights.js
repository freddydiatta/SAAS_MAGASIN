import { startOfDay, zonedHour, zonedWeekday, zonedDayKey } from './dates';

// Analyses de ventes destinées à décider : quoi mettre en avant, quoi
// recommander, quand être là. Calcul pur (aucune requête) pour pouvoir le
// tester sur des jeux de données précis.

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIODS = [
    { key: '7d', label: '7 jours', days: 7 },
    { key: '30d', label: '30 jours', days: 30 },
    { key: 'all', label: 'Tout', days: null },
];

export const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Au-delà, un produit est « bientôt en rupture » : une semaine laisse le temps
// de passer commande et d'être livré.
export const RUNNING_OUT_DAYS = 7;

// Une paire vue une seule fois ensemble relève du hasard : il faut qu'elle se
// répète pour parler d'une habitude.
export const MIN_TIMES_TOGETHER = 2;

export const PAYMENT_LABELS = { cash: 'Espèces', mobile_money: 'Mobile Money', credit: 'Crédit' };

// Minuit du jour suivant, recalé dans le fuseau du commerce : avancer de 36 h
// puis revenir à minuit reste juste même si un fuseau changeait d'heure.
const nextDay = (dayStart) => startOfDay(dayStart + 1.5 * DAY_MS);

/** Nombre de fois où chaque jour de la semaine apparaît entre deux jours inclus. */
const weekdayOccurrences = (fromDayStart, toDayStart) => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let day = fromDayStart; day <= toDayStart; day = nextDay(day)) {
        counts[zonedWeekday(day)] += 1;
    }
    return counts;
};

const countDays = (fromDayStart, toDayStart) => {
    let count = 0;
    for (let day = fromDayStart; day <= toDayStart; day = nextDay(day)) count += 1;
    return count;
};

export const computeSalesInsights = ({ sales = [], products = [], period = '30d', now = new Date() }) => {
    const today = startOfDay(now);
    const periodDays = PERIODS.find((p) => p.key === period)?.days ?? null;

    const firstSaleAt = sales.reduce((min, s) => {
        const t = new Date(s.created_at).getTime();
        return t < min ? t : min;
    }, Infinity);
    const firstSaleDay = Number.isFinite(firstSaleAt) ? startOfDay(firstSaleAt) : today;

    // La période ne commence jamais avant la première vente enregistrée. Sans
    // ça, « 30 jours » sur un commerce suivi depuis 3 jours diviserait les
    // ventes par 30 : chaque produit semblerait se vendre dix fois moins vite
    // qu'en réalité, et aucune rupture ne serait jamais annoncée.
    const requestedStart = periodDays === null ? firstSaleDay : startOfDay(today - (periodDays - 1) * DAY_MS);
    const periodStart = Math.max(requestedStart, firstSaleDay);
    const daysCovered = countDays(periodStart, today);

    const inPeriod = sales.filter((s) => new Date(s.created_at).getTime() >= periodStart);

    // --- Chiffres clés ---
    const receipts = new Map();
    inPeriod.forEach((s) => {
        const receipt = receipts.get(s.receipt_id) || {
            at: s.created_at,
            total: 0,
            items: 0,
            method: s.receipts?.payment_method || 'cash',
            products: new Map(),
        };
        receipt.total += Number(s.total_price);
        receipt.items += Number(s.quantity);
        const productKey = s.product_id || `deleted:${s.products?.name || ''}`;
        receipt.products.set(productKey, s.products?.name || 'Produit supprimé');
        receipts.set(s.receipt_id, receipt);
    });
    const receiptsCount = receipts.size;
    const revenue = [...receipts.values()].reduce((sum, r) => sum + r.total, 0);
    const itemsSold = [...receipts.values()].reduce((sum, r) => sum + r.items, 0);

    // --- Produits ---
    const byProduct = new Map();
    inPeriod.forEach((s) => {
        const key = s.product_id || `deleted:${s.products?.name || ''}`;
        const entry = byProduct.get(key) || {
            productId: s.product_id,
            name: s.products?.name || 'Produit supprimé',
            quantity: 0,
            revenue: 0,
            margin: 0,
            // Une vente dont le coût d'achat n'était pas connu ne peut pas
            // entrer dans la marge : on le signale plutôt que de la compter 0.
            linesWithoutCost: 0,
        };
        entry.quantity += Number(s.quantity);
        entry.revenue += Number(s.total_price);
        if (s.total_cost === null || s.total_cost === undefined) {
            entry.linesWithoutCost += 1;
        } else {
            entry.margin += Number(s.total_price) - Number(s.total_cost);
        }
        byProduct.set(key, entry);
    });
    const productStats = [...byProduct.values()].map((p) => ({
        ...p,
        marginKnown: p.linesWithoutCost === 0,
    }));

    const topByQuantity = [...productStats].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
    // Classement par marge : ce qui rapporte vraiment. Un produit dont la marge
    // est inconnue passe en fin de liste plutôt que d'être classé à zéro.
    const topByMargin = [...productStats].sort((a, b) => {
        if (a.marginKnown !== b.marginKnown) return a.marginKnown ? -1 : 1;
        return b.margin - a.margin;
    });

    // --- Heures ---
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, receipts: 0, revenue: 0 }));
    receipts.forEach((r) => {
        const slot = byHour[zonedHour(r.at)];
        slot.receipts += 1;
        slot.revenue += r.total;
    });
    const peakHour = byHour.reduce((best, slot) => (slot.receipts > (best?.receipts ?? 0) ? slot : best), null);
    // Égalités comprises : ne montrer qu'une heure quand deux font jeu égal
    // ferait croire à un pic unique qui n'existe pas.
    const peakHours = peakHour ? byHour.filter((slot) => slot.receipts === peakHour.receipts) : [];

    // --- Jours de la semaine ---
    // Moyenne par occurrence, pas total : sur 30 jours, deux jours de la
    // semaine tombent cinq fois et les autres quatre. En total, ces deux-là
    // paraîtraient meilleurs de 25 % sans avoir vendu plus.
    const occurrences = weekdayOccurrences(periodStart, today);
    const weekdayTotals = Array.from({ length: 7 }, () => ({ receipts: 0, revenue: 0 }));
    receipts.forEach((r) => {
        const slot = weekdayTotals[zonedWeekday(r.at)];
        slot.receipts += 1;
        slot.revenue += r.total;
    });
    const byWeekday = weekdayTotals.map((totals, weekday) => ({
        weekday,
        label: WEEKDAY_LABELS[weekday],
        short: WEEKDAY_SHORT[weekday],
        occurrences: occurrences[weekday],
        averageReceipts: occurrences[weekday] ? totals.receipts / occurrences[weekday] : 0,
        averageRevenue: occurrences[weekday] ? totals.revenue / occurrences[weekday] : 0,
    }));
    const bestWeekday = byWeekday.reduce(
        (best, day) => (day.averageRevenue > (best?.averageRevenue ?? 0) ? day : best),
        null
    );

    // --- Achetés ensemble ---
    // Chaque paire de produits distincts présente dans une même vente. C'est
    // l'habitude la plus directement exploitable : ranger ces produits côte à
    // côte, ou les proposer en lot.
    const pairs = new Map();
    receipts.forEach((r) => {
        const items = [...r.products.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        for (let i = 0; i < items.length; i += 1) {
            for (let j = i + 1; j < items.length; j += 1) {
                const key = `${items[i][0]}|${items[j][0]}`;
                const pair = pairs.get(key) || { names: [items[i][1], items[j][1]], times: 0 };
                pair.times += 1;
                pairs.set(key, pair);
            }
        }
    });
    const boughtTogether = [...pairs.values()]
        .filter((pair) => pair.times >= MIN_TIMES_TOGETHER)
        .sort((a, b) => b.times - a.times || a.names.join().localeCompare(b.names.join()));
    const multiItemSales = [...receipts.values()].filter((r) => r.products.size > 1).length;

    // --- Moyens de paiement ---
    // Comment les clients paient, en nombre de ventes et en panier moyen : de
    // quoi prévoir la monnaie en caisse et savoir si Wave attire les gros
    // paniers.
    const paymentTotals = new Map();
    receipts.forEach((r) => {
        const entry = paymentTotals.get(r.method) || { method: r.method, receipts: 0, revenue: 0 };
        entry.receipts += 1;
        entry.revenue += r.total;
        paymentTotals.set(r.method, entry);
    });
    const paymentMix = [...paymentTotals.values()]
        .map((entry) => ({
            ...entry,
            label: PAYMENT_LABELS[entry.method] || entry.method,
            share: receiptsCount ? entry.receipts / receiptsCount : 0,
            averageBasket: entry.receipts ? entry.revenue / entry.receipts : 0,
        }))
        .sort((a, b) => b.receipts - a.receipts);

    // --- Stock ---
    const soldQuantity = new Map();
    inPeriod.forEach((s) => {
        if (!s.product_id) return;
        soldQuantity.set(s.product_id, (soldQuantity.get(s.product_id) || 0) + Number(s.quantity));
    });

    // Bientôt en rupture : au rythme de vente observé sur la période, combien de
    // jours avant de ne plus rien avoir à vendre.
    const runningOut = products
        .filter((p) => soldQuantity.has(p.id))
        .map((p) => {
            const perDay = soldQuantity.get(p.id) / daysCovered;
            const stock = Math.max(Number(p.stock_quantity), 0);
            return {
                productId: p.id,
                name: p.name,
                stock,
                perDay,
                daysLeft: perDay > 0 ? stock / perDay : Infinity,
            };
        })
        .filter((p) => p.daysLeft <= RUNNING_OUT_DAYS)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    // Stock qui dort : de l'argent immobilisé sur l'étagère. Classé par valeur
    // d'achat bloquée, parce que c'est elle qui manque en caisse.
    const sleepingStock = products
        .filter((p) => Number(p.stock_quantity) > 0 && !soldQuantity.has(p.id))
        .map((p) => ({
            productId: p.id,
            name: p.name,
            stock: Number(p.stock_quantity),
            tiedUp: p.cost_price === null || p.cost_price === undefined
                ? null
                : Number(p.stock_quantity) * Number(p.cost_price),
        }))
        .sort((a, b) => {
            if ((a.tiedUp === null) !== (b.tiedUp === null)) return a.tiedUp === null ? 1 : -1;
            return (b.tiedUp ?? b.stock) - (a.tiedUp ?? a.stock);
        });
    const sleepingValue = sleepingStock.reduce((sum, p) => sum + (p.tiedUp || 0), 0);

    return {
        periodStart,
        daysCovered,
        activeDays: new Set([...receipts.values()].map((r) => zonedDayKey(r.at))).size,
        receiptsCount,
        revenue,
        averageBasket: receiptsCount ? revenue / receiptsCount : 0,
        itemsPerSale: receiptsCount ? itemsSold / receiptsCount : 0,
        topByQuantity,
        topByMargin,
        byHour,
        peakHour: peakHour && peakHour.receipts > 0 ? peakHour : null,
        peakHours,
        byWeekday,
        bestWeekday: bestWeekday && bestWeekday.averageRevenue > 0 ? bestWeekday : null,
        boughtTogether,
        multiItemSales,
        paymentMix,
        runningOut,
        sleepingStock,
        sleepingValue,
    };
};
