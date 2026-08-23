import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadProductImage, deleteProductImage } from './imagesService';

const { uploadMock, removeMock, getPublicUrlMock, fromMock } = vi.hoisted(() => ({
    uploadMock: vi.fn(),
    removeMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: { storage: { from: fromMock } },
}));

// jsdom has no real image decoder, so a real PNG's bytes never actually
// trigger Image#onload — resizeImage() (Image -> canvas -> toBlob) is
// stubbed here so these tests exercise uploadProductImage's own logic
// (validation, storage path, upload call, error propagation), not real
// image decoding/compression.
const OriginalImage = global.Image;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

describe('imagesService', () => {
    beforeEach(() => {
        uploadMock.mockReset();
        removeMock.mockReset();
        getPublicUrlMock.mockReset();
        fromMock.mockReset();
        fromMock.mockImplementation(() => ({ upload: uploadMock, remove: removeMock, getPublicUrl: getPublicUrlMock }));

        global.Image = class {
            width = 100;
            height = 100;
            set src(_value) {
                queueMicrotask(() => this.onload?.());
            }
        };
        HTMLCanvasElement.prototype.getContext = () => ({ drawImage: vi.fn() });
        HTMLCanvasElement.prototype.toBlob = function (callback) {
            callback(new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' }));
        };
    });

    afterEach(() => {
        global.Image = OriginalImage;
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        HTMLCanvasElement.prototype.toBlob = originalToBlob;
    });

    describe('uploadProductImage', () => {
        it('rejects a non-image file before ever touching the network', async () => {
            const file = new File(['not an image'], 'invoice.pdf', { type: 'application/pdf' });

            await expect(uploadProductImage('biz-1', file)).rejects.toThrow(/fichier image/);
            expect(uploadMock).not.toHaveBeenCalled();
        });

        it('uploads under <business_id>/<uuid>.jpg and returns the public URL', async () => {
            const file = new File(['fake-png-bytes'], 'apple.png', { type: 'image/png' });
            uploadMock.mockResolvedValueOnce({ data: { path: 'ignored' }, error: null });
            getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'https://x.supabase.co/storage/v1/object/public/product-images/biz-1/abc.jpg' } });

            const url = await uploadProductImage('biz-1', file);

            expect(fromMock).toHaveBeenCalledWith('product-images');
            const [path, blob, options] = uploadMock.mock.calls[0];
            expect(path).toMatch(/^biz-1\/[0-9a-f-]+\.jpg$/);
            expect(blob).toBeInstanceOf(Blob);
            expect(options).toMatchObject({ contentType: 'image/jpeg', upsert: false });
            expect(url).toBe('https://x.supabase.co/storage/v1/object/public/product-images/biz-1/abc.jpg');
        });

        it('propagates a storage upload error', async () => {
            const file = new File(['fake-png-bytes'], 'apple.png', { type: 'image/png' });
            uploadMock.mockResolvedValueOnce({ data: null, error: new Error('Storage quota exceeded') });

            await expect(uploadProductImage('biz-1', file)).rejects.toThrow('Storage quota exceeded');
        });
    });

    describe('deleteProductImage', () => {
        it('extracts the object path from a public URL and removes it', async () => {
            removeMock.mockResolvedValueOnce({ data: null, error: null });

            await deleteProductImage('https://x.supabase.co/storage/v1/object/public/product-images/biz-1/abc.jpg');

            expect(fromMock).toHaveBeenCalledWith('product-images');
            expect(removeMock).toHaveBeenCalledWith(['biz-1/abc.jpg']);
        });

        it('does nothing for an empty/missing URL', async () => {
            await deleteProductImage('');
            await deleteProductImage(undefined);

            expect(removeMock).not.toHaveBeenCalled();
        });

        it('does nothing for a URL that does not look like one of ours', async () => {
            await deleteProductImage('https://example.com/some-other-image.jpg');

            expect(removeMock).not.toHaveBeenCalled();
        });
    });
});
