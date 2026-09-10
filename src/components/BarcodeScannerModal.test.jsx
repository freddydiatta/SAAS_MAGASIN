import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BarcodeScannerModal } from './BarcodeScannerModal';

const { decodeFromConstraintsMock, stopMock, readerCtorMock } = vi.hoisted(() => ({
    decodeFromConstraintsMock: vi.fn(),
    stopMock: vi.fn(),
    readerCtorMock: vi.fn(),
}));

vi.mock('@zxing/browser', () => ({
    // new BrowserMultiFormatReader() est appelé avec `new` par le composant :
    // une fonction normale (pas fléchée) est nécessaire pour que
    // mockImplementation soit utilisable comme constructeur.
    BrowserMultiFormatReader: readerCtorMock.mockImplementation(function BrowserMultiFormatReader() {
        return { decodeFromConstraints: decodeFromConstraintsMock };
    }),
}));

// Capturé à chaque appel de decodeFromConstraints pour simuler un scan
// depuis les tests (le callback ZXing normalement déclenché par la caméra).
let capturedCallback = null;

describe('BarcodeScannerModal', () => {
    beforeEach(() => {
        decodeFromConstraintsMock.mockReset();
        stopMock.mockReset();
        readerCtorMock.mockClear();
        capturedCallback = null;
        decodeFromConstraintsMock.mockImplementation((_constraints, _videoElem, callback) => {
            capturedCallback = callback;
            return Promise.resolve({ stop: stopMock });
        });
    });

    it('requests the rear camera and shows the live video view', async () => {
        render(<BarcodeScannerModal isOpen onClose={() => {}} onScan={() => {}} />);

        await waitFor(() => expect(decodeFromConstraintsMock).toHaveBeenCalledWith(
            { video: expect.objectContaining({ facingMode: 'environment' }) },
            expect.anything(),
            expect.any(Function)
        ));
        expect(screen.getByText('Visez le code-barres')).toBeInTheDocument();
    });

    it('restricts decoding to retail 1D formats and shortens the delay between scan attempts (perf)', async () => {
        render(<BarcodeScannerModal isOpen onClose={() => {}} onScan={() => {}} />);

        await waitFor(() => expect(readerCtorMock).toHaveBeenCalled());
        const [hints, options] = readerCtorMock.mock.calls[0];

        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');
        expect(hints.get(DecodeHintType.POSSIBLE_FORMATS)).toEqual([
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
        ]);
        // Le défaut ZXing (500ms) rendait le scan visiblement lent — voir
        // BarcodeScannerModal.jsx pour le détail.
        expect(options).toEqual(expect.objectContaining({ delayBetweenScanAttempts: 50 }));
    });

    it('calls onScan once a barcode is decoded, then stops the camera (single-shot mode)', async () => {
        const onScan = vi.fn();
        render(<BarcodeScannerModal isOpen onClose={() => {}} onScan={onScan} />);
        await waitFor(() => expect(capturedCallback).toBeTruthy());

        capturedCallback({ getText: () => '3017620422003' });

        expect(onScan).toHaveBeenCalledWith('3017620422003');
        expect(stopMock).toHaveBeenCalled();
    });

    it('keeps scanning for further codes in continuous mode instead of stopping', async () => {
        const onScan = vi.fn();
        render(<BarcodeScannerModal isOpen onClose={() => {}} onScan={onScan} continuous />);
        await waitFor(() => expect(capturedCallback).toBeTruthy());

        capturedCallback({ getText: () => '111' });
        capturedCallback({ getText: () => '222' });

        expect(onScan).toHaveBeenNthCalledWith(1, '111');
        expect(onScan).toHaveBeenNthCalledWith(2, '222');
        expect(stopMock).not.toHaveBeenCalled();
    });

    it('ignores the same code re-fired immediately (still in frame) to avoid duplicate scans', async () => {
        const onScan = vi.fn();
        render(<BarcodeScannerModal isOpen onClose={() => {}} onScan={onScan} continuous />);
        await waitFor(() => expect(capturedCallback).toBeTruthy());

        capturedCallback({ getText: () => '111' });
        capturedCallback({ getText: () => '111' });
        capturedCallback({ getText: () => '111' });

        expect(onScan).toHaveBeenCalledTimes(1);
    });

    it('ignores a null/undefined decode result (no barcode found in this frame)', async () => {
        const onScan = vi.fn();
        render(<BarcodeScannerModal isOpen onClose={() => {}} onScan={onScan} />);
        await waitFor(() => expect(capturedCallback).toBeTruthy());

        capturedCallback(null);

        expect(onScan).not.toHaveBeenCalled();
    });

    it('shows a friendly message and no video when camera permission is denied', async () => {
        decodeFromConstraintsMock.mockImplementation(() => {
            const err = new Error('denied');
            err.name = 'NotAllowedError';
            return Promise.reject(err);
        });

        render(<BarcodeScannerModal isOpen onClose={() => {}} onScan={() => {}} />);

        expect(await screen.findByText(/Accès à la caméra refusé/)).toBeInTheDocument();
        expect(screen.queryByText('Visez le code-barres')).not.toBeInTheDocument();
    });

    it('stops the camera when closed', async () => {
        const onClose = vi.fn();
        render(<BarcodeScannerModal isOpen onClose={onClose} onScan={() => {}} />);
        await waitFor(() => expect(capturedCallback).toBeTruthy());

        screen.getByRole('button', { name: 'Annuler' }).click();

        expect(stopMock).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('does not start the camera when not open', () => {
        render(<BarcodeScannerModal isOpen={false} onClose={() => {}} onScan={() => {}} />);

        expect(decodeFromConstraintsMock).not.toHaveBeenCalled();
    });
});
