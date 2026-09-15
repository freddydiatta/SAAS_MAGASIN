// Comparaison de la journée en cours avec la veille, pour l'aperçu.
//
// On compare à HIER À LA MÊME HEURE, jamais à la journée d'hier entière :
// à 8h du matin, la caisse du jour ne peut pas rivaliser avec une journée
// complète, et l'aperçu affichait « -100 % vs hier » en rouge vif à chaque
// ouverture — un signal d'alarme sans aucun problème derrière.
//
// Et même à heure égale, un pourcentage n'a de sens que si les deux côtés ont
// déjà vendu : « -100 % » tant qu'aucun client n'est passé ce matin ne dit rien
// d'autre que « il est tôt ». Dans ce cas on montre simplement le repère d'hier.

/**
 * @param {object} p
 * @param {number} p.today           montant (ou nombre) de la journée en cours
 * @param {number} p.yesterdaySoFar  même mesure, hier, jusqu'à la même heure
 * @param {(n: number) => string} p.format  mise en forme de la valeur d'hier
 * @param {'percent' | 'difference'} [p.mode]  écart en % (montants) ou en unités (nombres)
 * @returns {{ tone: 'up' | 'down' | 'neutral', value: string | null, label: string }}
 *   tone : 'down' ne doit jamais s'afficher en rouge — une journée n'est pas
 *   terminée, un retard n'est pas une anomalie.
 */
export const describeDayTrend = ({ today, yesterdaySoFar, format, mode = 'percent' }) => {
    if (today <= 0 && yesterdaySoFar <= 0) {
        return { tone: 'neutral', value: null, label: 'Hier à la même heure : rien non plus' };
    }

    if (today <= 0) {
        return { tone: 'neutral', value: null, label: `Hier à la même heure : ${format(yesterdaySoFar)}` };
    }

    if (yesterdaySoFar <= 0) {
        return { tone: 'up', value: null, label: 'Hier à la même heure : aucune vente' };
    }

    // Un nombre de ventes se compare en écart (« +2 »), un montant en
    // pourcentage : « +40 % de ventes » sur 5 contre 7 parle moins que « -2 ».
    const delta = mode === 'difference'
        ? today - yesterdaySoFar
        : Math.round(((today - yesterdaySoFar) / yesterdaySoFar) * 100);
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    return {
        tone: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
        value: `${sign}${Math.abs(delta)}${mode === 'difference' ? '' : ' %'}`,
        label: 'vs hier à la même heure',
    };
};

/** Même heure qu'à l'instant `now`, mais la veille (bornes en heure du commerce). */
export const sameTimeYesterday = ({ now, todayStart, yesterdayStart }) => yesterdayStart + (now - todayStart);
