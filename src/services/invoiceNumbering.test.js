import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    formatInvoiceNumber,
    parseInvoiceNumber,
    rememberInvoiceNumber,
    refreshLastInvoiceNumber,
    takeOfflineInvoiceNumber,
} from './invoiceNumbering';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

const counterQuery = (result) => {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => result),
    };
    return builder;
};

// Midi UTC : la même journée à Dakar, quel que soit le fuseau de la machine.
const SEPT_15 = new Date(Date.UTC(2026, 8, 15, 12));

describe('invoiceNumbering', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('écrit le numéro sur cinq chiffres, sans jamais le couper au-delà', () => {
        expect(formatInvoiceNumber(2026, 31)).toBe('FAC-2026-00031');
        expect(formatInvoiceNumber(2026, 123456)).toBe('FAC-2026-123456');
    });

    it('relit un numéro, et ignore tout autre texte', () => {
        expect(parseInvoiceNumber('FAC-2026-00031')).toEqual({ year: 2026, number: 31 });
        expect(parseInvoiceNumber('#AFA9BA01')).toBeNull();
        expect(parseInvoiceNumber(null)).toBeNull();
    });

    it('hors-ligne, prend le numéro qui suit le dernier connu, puis le suivant', async () => {
        await rememberInvoiceNumber('biz-1', 'FAC-2026-00031');

        await expect(takeOfflineInvoiceNumber('biz-1', SEPT_15)).resolves.toBe('FAC-2026-00032');
        // deuxième vente toujours sans réseau : le numéro d'après, pas le même
        await expect(takeOfflineInvoiceNumber('biz-1', SEPT_15)).resolves.toBe('FAC-2026-00033');
    });

    it('ne fait jamais reculer la suite en revoyant une ancienne facture', async () => {
        await rememberInvoiceNumber('biz-1', 'FAC-2026-00031');
        // réimpression d'une vieille facture depuis l'historique
        await rememberInvoiceNumber('biz-1', 'FAC-2026-00004');

        await expect(takeOfflineInvoiceNumber('biz-1', SEPT_15)).resolves.toBe('FAC-2026-00032');
    });

    it('repart à 1 au changement d\'année', async () => {
        await rememberInvoiceNumber('biz-1', 'FAC-2026-00412');

        await expect(takeOfflineInvoiceNumber('biz-1', new Date(Date.UTC(2027, 0, 1, 12))))
            .resolves.toBe('FAC-2027-00001');
    });

    it('garde une suite séparée par commerce', async () => {
        await rememberInvoiceNumber('biz-1', 'FAC-2026-00031');
        await rememberInvoiceNumber('biz-2', 'FAC-2026-00004');

        await expect(takeOfflineInvoiceNumber('biz-2', SEPT_15)).resolves.toBe('FAC-2026-00005');
    });

    it('apprend le dernier numéro attribué par la base quand le réseau est là', async () => {
        fromMock.mockImplementation(() => counterQuery({ data: { year: 2026, last_number: 57 }, error: null }));

        await refreshLastInvoiceNumber('biz-1', SEPT_15);

        expect(fromMock).toHaveBeenCalledWith('invoice_counters');
        await expect(takeOfflineInvoiceNumber('biz-1', SEPT_15)).resolves.toBe('FAC-2026-00058');
    });

    it('garde ce qu\'il sait si la base ne répond pas', async () => {
        await rememberInvoiceNumber('biz-1', 'FAC-2026-00031');
        fromMock.mockImplementation(() => counterQuery({ data: null, error: new Error('réseau') }));

        await refreshLastInvoiceNumber('biz-1', SEPT_15);

        await expect(takeOfflineInvoiceNumber('biz-1', SEPT_15)).resolves.toBe('FAC-2026-00032');
    });
});
