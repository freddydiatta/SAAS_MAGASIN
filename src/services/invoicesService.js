import { supabase } from '../lib/supabase';
import { resizeImage } from './imagesService';

const BUCKET = 'purchase-order-invoices';

// Une facture doit rester lisible chiffre par chiffre, contrairement à une
// vignette de produit : on compresse beaucoup moins.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.9;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const INVOICE_ACCEPT_ATTR = 'image/*,application/pdf';

// Durée de vie de l'URL signée. Assez pour ouvrir et lire le document, pas
// assez pour qu'un lien partagé par erreur reste exploitable longtemps.
const SIGNED_URL_TTL = 60 * 60;

/**
 * Envoie la facture remise par le fournisseur, sous
 * <business_id>/<order_id>/<fichier> — le premier segment du chemin porte
 * l'autorisation (policies RLS, voir 2026-09-14_purchase_order_invoice.sql).
 *
 * Renvoie le CHEMIN et non une URL : le bucket est privé, l'accès se fait par
 * URL signée régénérée à chaque consultation.
 */
export const uploadPurchaseOrderInvoice = async ({ businessId, orderId, file }) => {
    if (!ACCEPTED.includes(file.type)) {
        throw new Error('Facture acceptée en photo (JPEG, PNG, WebP) ou en PDF.');
    }

    const isPdf = file.type === 'application/pdf';
    // Une photo prise au téléphone pèse plusieurs Mo : la réduire évite un
    // envoi interminable en connexion faible, ce qui est le cas courant au
    // moment d'une livraison. Un PDF part tel quel, il est déjà compact et le
    // recompresser abîmerait le texte.
    const body = isPdf ? file : await resizeImage(file, MAX_DIMENSION, JPEG_QUALITY);
    const extension = isPdf ? 'pdf' : 'jpg';
    const path = `${businessId}/${orderId}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
        contentType: isPdf ? 'application/pdf' : 'image/jpeg',
        upsert: false,
    });
    if (error) throw error;

    return { path, fileName: file.name || (isPdf ? 'facture.pdf' : 'facture.jpg') };
};

/**
 * URL temporaire pour consulter une facture. Le bucket étant privé, il n'y a
 * pas d'URL permanente à stocker : on en signe une à chaque ouverture.
 */
export const getInvoiceUrl = async (path) => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (error) throw error;
    return data.signedUrl;
};

/**
 * Best-effort, comme pour les photos de produits : remplacer une facture ne
 * doit pas échouer parce que l'ancien fichier n'a pas pu être effacé.
 */
export const deleteInvoice = async (path) => {
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
};
