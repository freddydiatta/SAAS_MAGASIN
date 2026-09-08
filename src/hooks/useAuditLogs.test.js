import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useAuditLogs } from './useAuditLogs';
import { renderHookWithQueryClient } from '../test/testUtils';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

const BUSINESS = { id: 'biz-1' };

const today = new Date();
const LOGS = [
    { id: 'l1', action: 'CANCEL_SALE', user_email: 'owner@test.com', created_at: today.toISOString() },
    { id: 'l2', action: 'LOGIN_SUCCESS', user_email: 'owner@test.com', created_at: today.toISOString() },
    { id: 'l3', action: 'CANCEL_SALE', user_email: 'caissier@test.com', created_at: '2020-01-01T10:00:00.000Z' },
];

describe('useAuditLogs', () => {
    beforeEach(() => {
        fromMock.mockReset();
        fromMock.mockImplementation(() => createQueryBuilder({ data: LOGS, error: null }));
    });

    it('fetches all logs by default, unfiltered', async () => {
        const { result } = renderHookWithQueryClient(() => useAuditLogs(BUSINESS));

        await waitFor(() => expect(result.current.logs).toHaveLength(3));
        expect(result.current.totalLogsCount).toBe(3);
    });

    it('filters by action type', async () => {
        const { result } = renderHookWithQueryClient(() => useAuditLogs(BUSINESS));
        await waitFor(() => expect(result.current.logs).toHaveLength(3));

        act(() => result.current.setActionFilter('CANCEL_SALE'));

        await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['l1', 'l3']));
        // unfiltered total stays the same
        expect(result.current.totalLogsCount).toBe(3);
    });

    it('filters by date range', async () => {
        const { result } = renderHookWithQueryClient(() => useAuditLogs(BUSINESS));
        await waitFor(() => expect(result.current.logs).toHaveLength(3));

        act(() => result.current.setDateFilter('30d'));

        await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['l1', 'l2']));
    });

    it('combines the action and date filters', async () => {
        const { result } = renderHookWithQueryClient(() => useAuditLogs(BUSINESS));
        await waitFor(() => expect(result.current.logs).toHaveLength(3));

        act(() => result.current.setActionFilter('CANCEL_SALE'));
        act(() => result.current.setDateFilter('30d'));

        // l3 matches the action but not the date range -> excluded
        await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['l1']));
    });
});
