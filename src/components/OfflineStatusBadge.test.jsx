import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { OfflineStatusBadge } from './OfflineStatusBadge';
import { renderWithQueryClient } from '../test/testUtils';

const { useOfflineStatusMock } = vi.hoisted(() => ({ useOfflineStatusMock: vi.fn() }));

vi.mock('../hooks/useOfflineStatus', () => ({
    useOfflineStatus: useOfflineStatusMock,
}));

describe('OfflineStatusBadge', () => {
    beforeEach(() => {
        useOfflineStatusMock.mockReset();
    });

    it('renders nothing when online with no pending sales', () => {
        useOfflineStatusMock.mockReturnValue({ isOnline: true, pendingCount: 0 });
        const { container } = renderWithQueryClient(<OfflineStatusBadge />);

        expect(container).toBeEmptyDOMElement();
    });

    it('shows an offline badge with no pending count when offline and the queue is empty', async () => {
        useOfflineStatusMock.mockReturnValue({ isOnline: false, pendingCount: 0 });
        renderWithQueryClient(<OfflineStatusBadge />);

        expect(await screen.findByText('Hors-ligne')).toBeInTheDocument();
    });

    it('shows the pending count alongside the offline state', async () => {
        useOfflineStatusMock.mockReturnValue({ isOnline: false, pendingCount: 2 });
        renderWithQueryClient(<OfflineStatusBadge />);

        expect(await screen.findByText(/Hors-ligne · 2 ventes en attente/)).toBeInTheDocument();
    });

    it('shows a syncing message when back online with sales still queued', async () => {
        useOfflineStatusMock.mockReturnValue({ isOnline: true, pendingCount: 1 });
        renderWithQueryClient(<OfflineStatusBadge />);

        expect(await screen.findByText(/Synchronisation de 1 vente\.\.\./)).toBeInTheDocument();
    });
});
