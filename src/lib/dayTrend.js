// Comparaison d'une période en cours (la journée, le mois) avec la précédente.
//
// On compare toujours à la période précédente AU MÊME MOMENT, jamais à la
// période précédente entière : à 8h du matin, la journée ne peut pas rivaliser
// avec la veille complète, et l'aperçu affichait « -100 % vs hier » en rouge
// vif à chaque ouverture. Le 15 du mois, idem face à tout le mois dernier.
//
// Et même à moment égal, un pourcentage n'a de sens que si les deux côtés ont
// déjà vendu : « -100 % » tant qu'aucun client n'est passé ne dit rien d'autre
// que « il est tôt », et « +100 % » face à un mois vide n'est qu'un chiffre
// inventé. Dans ces cas on montre simplement le repère de la période d'avant.

/**
 * @param {object} p
 * @param {number} p.current     mesure de la période en cours
 * @param {number} p.reference   même mesure, période précédente, au même moment
 * @param {(n: number) => string} p.format  mise en forme de la valeur de référence
 * @param {string} p.referenceLabel   ce qu'est la référence, en tête de phrase
 *                                    (« Hier à la même heure », « Du 1er au 15 août »)
 * @param {string} p.comparisonLabel  suite de l'écart (« vs hier à la même heure »)
 * @param {'percent' | 'difference'} [p.mode]  écart en % (montants) ou en unités (nombres)
 * @returns {{ tone: 'up' | 'down' | 'neutral', value: string | null, label: string }}
 *   tone : 'down' ne doit jamais s'afficher en rouge — une période n'est pas
 *   terminée, un retard n'est pas une anomalie.
 */
export const describeTrend = ({ current, reference, format, referenceLabel, comparisonLabel, mode = 'percent' }) => {
    if (current <= 0 && reference <= 0) {
        return { tone: 'neutral', value: null, label: `${referenceLabel} : rien non plus` };
    }

    if (current <= 0) {
        return { tone: 'neutral', value: null, label: `${referenceLabel} : ${format(reference)}` };
    }

    if (reference <= 0) {
        return { tone: 'up', value: null, label: `${referenceLabel} : aucune vente` };
    }

    // Un nombre de ventes se compare en écart (« +2 »), un montant en
    // pourcentage : « +40 % de ventes » sur 5 contre 7 parle moins que « -2 ».
    const delta = mode === 'difference'
        ? current - reference
        : Math.round(((current - reference) / reference) * 100);
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    return {
        tone: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
        value: `${sign}${Math.abs(delta)}${mode === 'difference' ? '' : ' %'}`,
        label: comparisonLabel,
    };
};

/** La journée en cours face à hier, à la même heure. */
export const describeDayTrend = ({ today, yesterdaySoFar, format, mode }) => describeTrend({
    current: today,
    reference: yesterdaySoFar,
    format,
    mode,
    referenceLabel: 'Hier à la même heure',
    comparisonLabel: 'vs hier à la même heure',
});

/** Même heure qu'à l'instant `now`, mais la veille (bornes en heure du commerce). */
export const sameTimeYesterday = ({ now, todayStart, yesterdayStart }) => yesterdayStart + (now - todayStart);
