import { supabase } from '../lib/supabase';

const BUCKET = 'product-images';
const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.8;

// Redimensionne/compresse côté navigateur avant l'envoi : une photo prise
// directement au téléphone peut peser plusieurs Mo, ce qui serait lourd à
// uploader (et à re-télécharger plus tard sur les autres appareils) pour
// une simple vignette de produit affichée à quelques centaines de pixels.
//
// La taille est un paramètre car tous les usages n'ont pas le même besoin :
// une vignette de produit se lit à 800px, une photo de facture doit rester
// lisible chiffre par chiffre (voir invoicesService).
export const resizeImage = (file, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > height && width > maxDimension) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
        } else if (height > maxDimension) {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Impossible de traiter cette image."))),
            'image/jpeg',
            quality
        );
    };
    img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Fichier image invalide.'));
    };
    img.src = objectUrl;
});

/**
 * Redimensionne puis envoie une photo de produit/plat/villa dans le bucket
 * partagé, sous <business_id>/<fichier> (policies RLS scoped sur ce premier
 * segment de chemin, cf. supabase/patches/2026-08-24_product_images.sql).
 * Renvoie l'URL publique à stocker sur la ligne (products.image_url, etc).
 */
export const uploadProductImage = async (businessId, file) => {
    if (!file.type.startsWith('image/')) {
        throw new Error('Veuillez choisir un fichier image (JPEG, PNG ou WebP).');
    }

    const resized = await resizeImage(file);
    const path = `${businessId}/${crypto.randomUUID()}.jpg`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, resized, {
        contentType: 'image/jpeg',
        upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
};

/**
 * Best-effort : appelée quand une photo est remplacée ou qu'un
 * produit/plat/villa est supprimé, pour ne pas accumuler indéfiniment des
 * fichiers orphelins dans le bucket. Un échec ici (réseau, fichier déjà
 * absent) ne doit jamais faire échouer l'action principale de
 * l'utilisateur — voir les appelants.
 */
export const deleteProductImage = async (imageUrl) => {
    if (!imageUrl) return;
    const marker = `/object/public/${BUCKET}/`;
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) return;
    const path = imageUrl.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]);
};
