import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadPurchaseOrderInvoice, getInvoiceUrl, deleteInvoice } from './invoicesService';

const { uploadMock, createSignedUrlMock, removeMock, fromMock } = vi.hoisted(() => ({
    uploadMock: vi.fn(),
    createSignedUrlMock: vi.fn(),
    removeMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: { storage: { from: fromMock } },
}));

// Le redimensionnement passe par un <canvas>, que jsdom n'implémente pas :
// ce que l'on vérifie ici est le contrat d'envoi, pas la compression.
vi.mock('./imagesService', () => ({
    resizeImage: vi.fn(async () => new Blob(['redimensionnée'], { type: 'image/jpeg' })),
}));

const makeFile = (name, type) => new File(['contenu'], name, { type });

describe('invoicesService', () => {
    beforeEach(() => {
        uploadMock.mockReset().mockResolvedValue({ error: null });
        createSignedUrlMock.mockReset();
        removeMock.mockReset().mockResolvedValue({ error: null });
        fromMock.mockReset().mockReturnValue({
            upload: uploadMock,
            createSignedUrl: createSignedUrlMock,
            remove: removeMock,
        });
    });

    it('range la facture sous <commerce>/<bon>/, ce qui porte l\'autorisation', async () => {
        // les policies RLS lisent le premier segment du chemin : un autre
        // commerce ne peut ni écrire ni lire là-dedans
        const { path } = await uploadPurchaseOrderInvoice({
            businessId: 'biz-1', orderId: 'po-9', file: makeFile('facture.jpg', 'image/jpeg'),
        });

        expect(fromMock).toHaveBeenCalledWith('purchase-order-invoices');
        expect(path).toMatch(/^biz-1\/po-9\/[\w-]+\.jpg$/);
        expect(uploadMock).toHaveBeenCalledWith(path, expect.any(Blob), {
            contentType: 'image/jpeg',
            upsert: false,
        });
    });

    it('envoie un PDF tel quel, sans le recompresser', async () => {
        // recompresser un PDF abîmerait le texte, et il est déjà compact
        const file = makeFile('facture.pdf', 'application/pdf');

        const { path, fileName } = await uploadPurchaseOrderInvoice({
            businessId: 'biz-1', orderId: 'po-9', file,
        });

        expect(path).toMatch(/\.pdf$/);
        expect(fileName).toBe('facture.pdf');
        expect(uploadMock).toHaveBeenCalledWith(path, file, {
            contentType: 'application/pdf',
            upsert: false,
        });
    });

    it('refuse un type de fichier qui ne se lit pas comme une facture', async () => {
        await expect(uploadPurchaseOrderInvoice({
            businessId: 'biz-1', orderId: 'po-9', file: makeFile('notes.docx', 'application/msword'),
        })).rejects.toThrow(/photo .* ou en PDF/);
        expect(uploadMock).not.toHaveBeenCalled();
    });

    it('signe une URL à durée limitée plutôt que d\'exposer un lien permanent', async () => {
        // le bucket est privé : une facture porte les prix d'achat et le nom
        // du fournisseur, elle n'a pas à rester lisible par quiconque a le lien
        createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signé' }, error: null });

        await expect(getInvoiceUrl('biz-1/po-9/x.jpg')).resolves.toBe('https://signé');
        expect(createSignedUrlMock).toHaveBeenCalledWith('biz-1/po-9/x.jpg', 3600);
    });

    it('ne signe rien quand le bon n\'a pas de facture', async () => {
        await expect(getInvoiceUrl(null)).resolves.toBeNull();
        expect(createSignedUrlMock).not.toHaveBeenCalled();
    });

    it('supprime l\'ancien fichier quand une facture est remplacée', async () => {
        await deleteInvoice('biz-1/po-9/ancienne.jpg');
        expect(removeMock).toHaveBeenCalledWith(['biz-1/po-9/ancienne.jpg']);
    });
});
