import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwitchUserModal } from './SwitchUserModal';
import { renderWithQueryClient } from '../test/testUtils';

const { listCashiersMock, cashierLoginMock } = vi.hoisted(() => ({
    listCashiersMock: vi.fn(),
    cashierLoginMock: vi.fn(),
}));

vi.mock('../services/cashiersService', () => ({
    listCashiers: listCashiersMock,
    cashierLogin: cashierLoginMock,
}));

const { switchToCashierMock, switchToCashierOfflineMock } = vi.hoisted(() => ({
    switchToCashierMock: vi.fn(),
    switchToCashierOfflineMock: vi.fn(),
}));

vi.mock('../contexts/BusinessContext', () => ({
    useBusiness: () => ({
        selectedBusiness: { id: 'biz-1' },
        switchToCashier: switchToCashierMock,
        switchToCashierOffline: switchToCashierOfflineMock,
    }),
}));

const CASHIER = { id: 'member-1', name: 'Awa', is_active: true };

describe('SwitchUserModal', () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

    beforeEach(() => {
        listCashiersMock.mockReset();
        cashierLoginMock.mockReset();
        switchToCashierMock.mockReset();
        switchToCashierOfflineMock.mockReset();
        listCashiersMock.mockResolvedValue([CASHIER]);
        onlineSpy.mockReturnValue(true);
    });

    const enterPin = async (user) => {
        for (const digit of ['1', '2', '3', '4']) {
            await user.click(screen.getByRole('button', { name: digit }));
        }
    };

    it('switches online through cashierLogin + switchToCashier, passing the pin_hash through for caching', async () => {
        cashierLoginMock.mockResolvedValueOnce({ email: 'awa@cashier.local', password: 'secret', name: 'Awa', pin_hash: 'salt:hash' });
        switchToCashierMock.mockResolvedValueOnce();
        const user = userEvent.setup();

        renderWithQueryClient(<SwitchUserModal isOpen onClose={() => {}} />);
        await user.click(await screen.findByText('Awa'));
        await enterPin(user);

        await waitFor(() => {
            expect(cashierLoginMock).toHaveBeenCalledWith({ memberId: 'member-1', pin: '1234' });
        });
        expect(switchToCashierMock).toHaveBeenCalledWith({
            email: 'awa@cashier.local', password: 'secret', memberId: 'member-1', name: 'Awa', pinHash: 'salt:hash',
        });
        expect(switchToCashierOfflineMock).not.toHaveBeenCalled();
    });

    it('shows an offline hint and switches through switchToCashierOffline without calling the network path', async () => {
        onlineSpy.mockReturnValue(false);
        switchToCashierOfflineMock.mockResolvedValueOnce();
        const user = userEvent.setup();

        renderWithQueryClient(<SwitchUserModal isOpen onClose={() => {}} />);

        expect(await screen.findByText(/Hors-ligne : seuls les caissiers/)).toBeInTheDocument();

        await user.click(await screen.findByText('Awa'));
        await enterPin(user);

        await waitFor(() => {
            expect(switchToCashierOfflineMock).toHaveBeenCalledWith('member-1', '1234');
        });
        expect(cashierLoginMock).not.toHaveBeenCalled();
        expect(switchToCashierMock).not.toHaveBeenCalled();
    });

    it('surfaces the offline "never used on this device" error and lets the user retry', async () => {
        onlineSpy.mockReturnValue(false);
        switchToCashierOfflineMock.mockRejectedValueOnce(new Error("Ce caissier n'a jamais été utilisé sur cet appareil en étant en ligne — connectez-vous une fois en ligne avec lui pour l'activer hors-ligne."));
        const user = userEvent.setup();

        renderWithQueryClient(<SwitchUserModal isOpen onClose={() => {}} />);
        await user.click(await screen.findByText('Awa'));
        await enterPin(user);

        expect(await screen.findByText(/jamais été utilisé sur cet appareil/)).toBeInTheDocument();
    });
});
