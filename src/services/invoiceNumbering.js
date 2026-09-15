import { get, set } from 'idb-keyval';
import { supabase } from '../lib/supabase';
import { zonedYearMonth } from '../lib/dates';

// Numéros de facture FAC-2026-00001 : une suite par commerce et par année.
//
// En ligne, c'est la base qui attribue le numéro (process_sale). Hors-ligne,
// l'appareil prend le numéro qui suit le dernier qu'il connaît, pour que la
// facture remise au client porte tout de suite son vrai numéro plutôt qu'un
// « #TEMP » identique pour toutes. À la synchronisation, la base l'accepte
// s'il est toujours le suivant ; sinon — un autre appareil a vendu pendant la
// coupure — elle en attribue un autre et garde la trace du numéro imprimé.

const lastKey = (businessId) => `invoice_last:${businessId}`;

export const formatInvoiceNumber = (year, number) =>
    `FAC-${year}-${number > 99999 ? number : String(number).padStart(5, '0')}`;

/** { year, number } pour « FAC-2026-00031 », null pour tout autre texte. */
export const parseInvoiceNumber = (value) => {
    const match = /^FAC-(\d{4})-(\d+)$/.exec(String(value || ''));
    return match ? { year: Number(match[1]), number: Number(match[2]) } : null;
};

const isAfter = (a, b) => !b || a.year > b.year || (a.year === b.year && a.number > b.number);

/**
 * Retient le numéro le plus avancé vu par cet appareil. Jamais de recul : un
 * numéro plus ancien (réimpression d'une vieille facture) ne doit pas faire
 * reprendre la suite en arrière.
 */
export const rememberInvoiceNumber = async (businessId, invoiceNumber) => {
    const parsed = parseInvoiceNumber(invoiceNumber);
    if (!businessId || !parsed) return;
    const known = await get(lastKey(businessId));
    if (isAfter(parsed, known)) await set(lastKey(businessId), parsed);
};

/**
 * Relit le dernier numéro attribué par la base, tant qu'on a du réseau : c'est
 * lui qui permet de numéroter juste la prochaine vente hors-ligne. Silencieux
 * en cas d'échec — l'appareil garde alors le dernier numéro qu'il connaissait.
 */
export const refreshLastInvoiceNumber = async (businessId, now = new Date()) => {
    if (!businessId || !navigator.onLine) return;
    try {
        const { year } = zonedYearMonth(now);
        const { data, error } = await supabase
            .from('invoice_counters')
            .select('year, last_number')
            .eq('business_id', businessId)
            .eq('year', year)
            .maybeSingle();
        if (error) return;
        if (data) await rememberInvoiceNumber(businessId, formatInvoiceNumber(data.year, data.last_number));
    } catch {
        // pas de réseau finalement : on garde ce qu'on sait
    }
};

/**
 * Numéro à imprimer pour une vente faite hors-ligne : le suivant du dernier
 * connu, sur l'année de la vente (la suite repart à 1 au 1er janvier). Le
 * numéro est aussitôt réservé sur l'appareil, pour que la vente suivante,
 * toujours hors-ligne, prenne le d'après.
 */
export const takeOfflineInvoiceNumber = async (businessId, saleDate = new Date()) => {
    const { year } = zonedYearMonth(saleDate);
    const known = await get(lastKey(businessId));
    const next = { year, number: known && known.year === year ? known.number + 1 : 1 };
    await set(lastKey(businessId), next);
    return formatInvoiceNumber(next.year, next.number);
};
