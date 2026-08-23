import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addProduct, updateProduct, deleteProduct } from './productsService';

function createQueryBuilder(result) {
    const builder = {
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

const { deleteProductImageMock } = vi.hoisted(() => ({ deleteProductImageMock: vi.fn() }));

vi.mock('./imagesService', () => ({
    deleteProductImage: deleteProductImageMock,
}));

describe('productsService', () => {
    beforeEach(() => {
        fromMock.mockReset();
        deleteProductImageMock.mockReset();
        deleteProductImageMock.mockResolvedValue();
    });

    describe('addProduct', () => {
        it('stores image_url as null when no photo was attached', async () => {
            const builder = createQueryBuilder({ data: null, error: null });
            fromMock.mockImplementation(() => builder);

            await addProduct({ businessId: 'biz-1', name: 'Casque', type: 'moto', price: 1000, stockQuantity: 5, imageUrl: '' });

            expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({ image_url: null })]);
        });

        it('stores the uploaded image URL', async () => {
            const builder = createQueryBuilder({ data: null, error: null });
            fromMock.mockImplementation(() => builder);

            await addProduct({ businessId: 'biz-1', name: 'Casque', type: 'moto', price: 1000, stockQuantity: 5, imageUrl: 'https://x/casque.jpg' });

            expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({ image_url: 'https://x/casque.jpg' })]);
        });
    });

    describe('updateProduct', () => {
        it('cleans up the previous photo (best-effort) when it is replaced by a new one', async () => {
            const builder = createQueryBuilder({ data: null, error: null });
            fromMock.mockImplementation(() => builder);

            await updateProduct({
                id: 'p1', name: 'Casque', type: 'moto', price: 1000, stockQuantity: 5,
                imageUrl: 'https://x/new.jpg', previousImageUrl: 'https://x/old.jpg',
            });

            expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ image_url: 'https://x/new.jpg' }));
            await vi.waitFor(() => expect(deleteProductImageMock).toHaveBeenCalledWith('https://x/old.jpg'));
        });

        it('does not attempt cleanup when the photo is unchanged', async () => {
            const builder = createQueryBuilder({ data: null, error: null });
            fromMock.mockImplementation(() => builder);

            await updateProduct({
                id: 'p1', name: 'Casque', type: 'moto', price: 1000, stockQuantity: 5,
                imageUrl: 'https://x/same.jpg', previousImageUrl: 'https://x/same.jpg',
            });

            expect(deleteProductImageMock).not.toHaveBeenCalled();
        });

        it("doesn't fail the update itself when cleaning up the old photo fails", async () => {
            const builder = createQueryBuilder({ data: null, error: null });
            fromMock.mockImplementation(() => builder);
            deleteProductImageMock.mockRejectedValueOnce(new Error('network error'));

            await expect(updateProduct({
                id: 'p1', name: 'Casque', type: 'moto', price: 1000, stockQuantity: 5,
                imageUrl: '', previousImageUrl: 'https://x/old.jpg',
            })).resolves.toBeUndefined();
        });
    });

    describe('deleteProduct', () => {
        it('deletes the row and best-effort removes its photo from storage', async () => {
            const builder = createQueryBuilder({ data: null, error: null });
            fromMock.mockImplementation(() => builder);

            await deleteProduct({ id: 'p1', imageUrl: 'https://x/casque.jpg' });

            expect(builder.delete).toHaveBeenCalled();
            await vi.waitFor(() => expect(deleteProductImageMock).toHaveBeenCalledWith('https://x/casque.jpg'));
        });

        it('skips photo cleanup entirely when the product had none', async () => {
            const builder = createQueryBuilder({ data: null, error: null });
            fromMock.mockImplementation(() => builder);

            await deleteProduct({ id: 'p1', imageUrl: null });

            expect(deleteProductImageMock).not.toHaveBeenCalled();
        });
    });
});
