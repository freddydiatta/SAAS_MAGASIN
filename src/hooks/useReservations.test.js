import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useReservations } from './useReservations';
import { renderHookWithQueryClient } from '../test/testUtils';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock, toastSuccess, toastError } = vi.hoisted(() => ({
    fromMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: toastSuccess, error: toastError },
}));

const BUSINESS = { id: 'biz-1' };
const VILLA = { id: 'v1', name: 'Villa Almadies', price_per_night: 50000 };
const BOOKING = {
    id: 'b1', villa_id: 'v1', customer_name: 'Jean', start_date: '2026-09-01',
    end_date: '2026-09-03', status: 'provisoire', total_price: 100000,
    villas: { name: 'Villa Almadies', price_per_night: 50000 },
};

describe('useReservations', () => {
    beforeEach(() => {
        fromMock.mockReset();
        toastSuccess.mockReset();
        toastError.mockReset();
        fromMock.mockImplementation((table) => {
            if (table === 'villas') return createQueryBuilder({ data: [VILLA], error: null });
            return createQueryBuilder({ data: [BOOKING], error: null });
        });
    });

    it('fetches villas and bookings for the selected business', async () => {
        const { result } = renderHookWithQueryClient(() => useReservations(BUSINESS));

        await waitFor(() => expect(result.current.villas).toEqual([VILLA]));
        await waitFor(() => expect(result.current.bookings).toEqual([BOOKING]));
    });

    it('getCalculatedPrice multiplies nights by the villa nightly rate', async () => {
        const { result } = renderHookWithQueryClient(() => useReservations(BUSINESS));
        await waitFor(() => expect(result.current.villas).toEqual([VILLA]));

        act(() => result.current.setFormData({
            villa_id: 'v1', customer_name: 'Jean', start_date: '2026-09-01', end_date: '2026-09-03', status: 'provisoire',
        }));

        expect(result.current.getCalculatedPrice()).toBe(100000); // 2 nights * 50000
    });

    it('getCalculatedPrice returns 0 when the form is incomplete', async () => {
        const { result } = renderHookWithQueryClient(() => useReservations(BUSINESS));
        await waitFor(() => expect(result.current.villas).toEqual([VILLA]));

        expect(result.current.getCalculatedPrice()).toBe(0);
    });

    it('handleSubmit rejects an end date before the start date without calling supabase', async () => {
        const { result } = renderHookWithQueryClient(() => useReservations(BUSINESS));
        await waitFor(() => expect(result.current.villas).toEqual([VILLA]));
        fromMock.mockClear();

        act(() => result.current.setFormData({
            villa_id: 'v1', customer_name: 'Jean', start_date: '2026-09-05', end_date: '2026-09-01', status: 'provisoire',
        }));
        act(() => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(toastError).toHaveBeenCalled();
        expect(fromMock).not.toHaveBeenCalledWith('bookings');
    });

    it('handleSubmit inserts a new booking with the calculated total_price when valid', async () => {
        const { result } = renderHookWithQueryClient(() => useReservations(BUSINESS));
        await waitFor(() => expect(result.current.villas).toEqual([VILLA]));

        act(() => result.current.setFormData({
            villa_id: 'v1', customer_name: 'Jean', start_date: '2026-09-01', end_date: '2026-09-03', status: 'provisoire',
        }));

        const bookingsBuilder = createQueryBuilder({ data: [BOOKING], error: null });
        fromMock.mockImplementation((table) => (table === 'villas'
            ? createQueryBuilder({ data: [VILLA], error: null })
            : bookingsBuilder));

        act(() => result.current.handleSubmit({ preventDefault: () => {} }));

        await waitFor(() => {
            expect(bookingsBuilder.insert).toHaveBeenCalledWith([expect.objectContaining({
                villa_id: 'v1', customer_name: 'Jean', total_price: 100000, business_id: 'biz-1',
            })]);
        });
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Réservation confirmée avec succès !'));
    });

    it('handleEdit prefills the form and handleDelete respects a cancelled confirm', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { result } = renderHookWithQueryClient(() => useReservations(BUSINESS));
        await waitFor(() => expect(result.current.villas).toEqual([VILLA]));

        act(() => result.current.handleEdit(BOOKING));
        expect(result.current.formData).toMatchObject({ villa_id: 'v1', customer_name: 'Jean' });
        expect(result.current.editingBooking).toEqual(BOOKING);

        fromMock.mockClear();
        act(() => result.current.handleDelete(BOOKING));
        expect(fromMock).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
