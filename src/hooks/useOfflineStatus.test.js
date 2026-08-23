import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useOfflineStatus } from './useOfflineStatus';
import { renderHookWithQueryClient } from '../test/testUtils';

const { getOfflineSalesCountMock } = vi.hoisted(() => ({ getOfflineSalesCountMock: vi.fn() }));

vi.mock('../services/syncService', () => ({
    getOfflineSalesCount: getOfflineSalesCountMock,
}));

describe('useOfflineStatus', () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

    beforeEach(() => {
        getOfflineSalesCountMock.mockReset();
        onlineSpy.mockReturnValue(true);
    });

    afterEach(() => {
        onlineSpy.mockReturnValue(true);
    });

    it('reflects navigator.onLine at mount and the queued sales count', async () => {
        getOfflineSalesCountMock.mockResolvedValue(3);
        const { result } = renderHookWithQueryClient(() => useOfflineStatus());

        expect(result.current.isOnline).toBe(true);
        await waitFor(() => expect(result.current.pendingCount).toBe(3));
    });

    it('flips to offline/online when the browser dispatches those events', async () => {
        getOfflineSalesCountMock.mockResolvedValue(0);
        const { result } = renderHookWithQueryClient(() => useOfflineStatus());
        await waitFor(() => expect(result.current.pendingCount).toBe(0));

        act(() => window.dispatchEvent(new Event('offline')));
        expect(result.current.isOnline).toBe(false);

        act(() => window.dispatchEvent(new Event('online')));
        expect(result.current.isOnline).toBe(true);
    });
});
