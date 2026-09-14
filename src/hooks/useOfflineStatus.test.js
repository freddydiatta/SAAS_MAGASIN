import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useOfflineStatus } from './useOfflineStatus';
import { renderHookWithQueryClient } from '../test/testUtils';

const { getOutboxCountMock } = vi.hoisted(() => ({ getOutboxCountMock: vi.fn() }));

vi.mock('../services/outbox', () => ({
    getOutboxCount: getOutboxCountMock,
}));

describe('useOfflineStatus', () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

    beforeEach(() => {
        getOutboxCountMock.mockReset();
        onlineSpy.mockReturnValue(true);
    });

    afterEach(() => {
        onlineSpy.mockReturnValue(true);
    });

    it('reflects navigator.onLine at mount and the queued operations count', async () => {
        getOutboxCountMock.mockResolvedValue(3);
        const { result } = renderHookWithQueryClient(() => useOfflineStatus());

        expect(result.current.isOnline).toBe(true);
        await waitFor(() => expect(result.current.pendingCount).toBe(3));
    });

    it('flips to offline/online when the browser dispatches those events', async () => {
        getOutboxCountMock.mockResolvedValue(0);
        const { result } = renderHookWithQueryClient(() => useOfflineStatus());
        await waitFor(() => expect(result.current.pendingCount).toBe(0));

        act(() => window.dispatchEvent(new Event('offline')));
        expect(result.current.isOnline).toBe(false);

        act(() => window.dispatchEvent(new Event('online')));
        expect(result.current.isOnline).toBe(true);
    });
});
