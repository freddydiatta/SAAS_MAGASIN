import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    softDeleteBusiness,
    restoreBusiness,
    fetchDeletedBusinesses,
    daysBeforePurge,
    BUSINESS_RETENTION_DAYS,
} from './businessesService';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        not: vi.fn(() => builder),
        order: vi.fn(() => builder),
        update: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

describe('businessesService', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('softDeleteBusiness stamps deleted_at instead of deleting the row', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        const id = await softDeleteBusiness('biz-1');

        expect(fromMock).toHaveBeenCalledWith('businesses');
        expect(builder.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
        expect(builder.eq).toHaveBeenCalledWith('id', 'biz-1');
        expect(id).toBe('biz-1');
    });

    it('restoreBusiness clears deleted_at', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await restoreBusiness('biz-1');

        expect(builder.update).toHaveBeenCalledWith({ deleted_at: null });
        expect(builder.eq).toHaveBeenCalledWith('id', 'biz-1');
    });

    it('fetchDeletedBusinesses only returns rows that are marked deleted', async () => {
        const builder = createQueryBuilder({ data: [{ id: 'biz-1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchDeletedBusinesses();

        expect(builder.not).toHaveBeenCalledWith('deleted_at', 'is', null);
        expect(data).toEqual([{ id: 'biz-1' }]);
    });

    it('propagates a database error', async () => {
        fromMock.mockImplementation(() => createQueryBuilder({ data: null, error: new Error('boom') }));

        await expect(softDeleteBusiness('biz-1')).rejects.toThrow('boom');
    });

    it('counts the full retention window on the day of deletion', () => {
        const deletedAt = new Date('2026-09-11T10:00:00Z');
        const now = new Date('2026-09-11T10:00:00Z');

        expect(daysBeforePurge(deletedAt.toISOString(), now)).toBe(BUSINESS_RETENTION_DAYS);
    });

    it('rounds up so the countdown never promises more time than is left', () => {
        const deletedAt = new Date('2026-09-11T10:00:00Z');
        // 6 jours et 1 heure plus tard : il reste moins d'un jour entier
        const now = new Date('2026-09-17T11:00:00Z');

        expect(daysBeforePurge(deletedAt.toISOString(), now)).toBe(1);
    });

    it('reports 0 once the retention window has passed', () => {
        const deletedAt = new Date('2026-09-01T10:00:00Z');
        const now = new Date('2026-09-11T10:00:00Z');

        expect(daysBeforePurge(deletedAt.toISOString(), now)).toBe(0);
    });
});
