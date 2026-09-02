import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PurchaseOrderPrint } from './PurchaseOrderPrint';

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock('react-hot-toast', () => ({
    default: { error: toastErrorMock, success: vi.fn() },
}));

const { docMock, jsPDFMock } = vi.hoisted(() => {
    const docMock = {
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        setTextColor: vi.fn(),
        setDrawColor: vi.fn(),
        text: vi.fn(),
        line: vi.fn(),
        lastAutoTable: { finalY: 100 },
        save: vi.fn(),
        output: vi.fn(() => new Blob(['pdf-bytes'], { type: 'application/pdf' })),
    };
    return { docMock, jsPDFMock: vi.fn(function () { return docMock; }) };
});

vi.mock('jspdf', () => ({ jsPDF: jsPDFMock }));
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

const BUSINESS = { name: 'Boutique Almadies', type: 'quincaillerie', address: 'Dakar', phone: '77 000 00 00' };
const ORDER = {
    orderId: 'abcdef12-3456',
    date: '2026-09-02T10:00:00.000Z',
    status: 'pending',
    supplier: { name: 'Import Moto', phone: '78 111 11 11' },
    items: [{ name: 'Plaquette de frein', quantity: 2, price: 3000 }],
    total: 6000,
};

describe('PurchaseOrderPrint', () => {
    beforeEach(() => {
        toastErrorMock.mockReset();
        docMock.save.mockReset();
        docMock.output.mockReturnValue(new Blob(['pdf-bytes'], { type: 'application/pdf' }));
        jsPDFMock.mockClear();
        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        delete navigator.share;
        delete navigator.canShare;
    });

    it('renders nothing when orderDetails or business is missing', () => {
        const { container } = render(<PurchaseOrderPrint orderDetails={null} business={BUSINESS} onClose={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the order details on screen', () => {
        render(<PurchaseOrderPrint orderDetails={ORDER} business={BUSINESS} onClose={() => {}} />);
        expect(screen.getByText('Boutique Almadies')).toBeInTheDocument();
        expect(screen.getByText('Import Moto')).toBeInTheDocument();
        expect(screen.getByText('Plaquette de frein')).toBeInTheDocument();
        expect(screen.getByText(/#ABCDEF12/)).toBeInTheDocument();
    });

    it('shows the supplier as not set when no supplier was chosen for the order', () => {
        render(<PurchaseOrderPrint orderDetails={{ ...ORDER, supplier: null }} business={BUSINESS} onClose={() => {}} />);
        expect(screen.getAllByText('Non renseigné').length).toBeGreaterThan(0);
    });

    it('uses window.print for the native print button', async () => {
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
        const user = userEvent.setup();
        render(<PurchaseOrderPrint orderDetails={ORDER} business={BUSINESS} onClose={() => {}} />);

        await user.click(screen.getByRole('button', { name: /imprimer/i }));

        expect(printSpy).toHaveBeenCalledTimes(1);
        printSpy.mockRestore();
    });

    it('shares the PDF directly via the Web Share API when available (mobile)', async () => {
        const shareMock = vi.fn().mockResolvedValue(undefined);
        navigator.share = shareMock;
        navigator.canShare = vi.fn(() => true);
        const user = userEvent.setup();
        render(<PurchaseOrderPrint orderDetails={ORDER} business={BUSINESS} onClose={() => {}} />);

        await user.click(screen.getByRole('button', { name: /pdf.*partager/i }));

        expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
        expect(docMock.save).not.toHaveBeenCalled();
    });

    it('falls back to a direct download when the popup is blocked', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        const user = userEvent.setup();
        render(<PurchaseOrderPrint orderDetails={ORDER} business={BUSINESS} onClose={() => {}} />);

        await user.click(screen.getByRole('button', { name: /pdf.*partager/i }));

        expect(docMock.save).toHaveBeenCalledWith('Bon_de_commande_ABCDEF12.pdf');
        openSpy.mockRestore();
    });

    it('shows a toast instead of failing silently when PDF generation throws', async () => {
        jsPDFMock.mockImplementationOnce(function () {
            throw new Error('jsPDF boom');
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = userEvent.setup();
        render(<PurchaseOrderPrint orderDetails={ORDER} business={BUSINESS} onClose={() => {}} />);

        await user.click(screen.getByRole('button', { name: /pdf.*partager/i }));

        expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/impossible de générer le pdf/i));
        console.error.mockRestore();
    });
});
