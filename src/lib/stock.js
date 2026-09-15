// À partir de combien d'unités un produit est à réapprovisionner. Le même
// seuil déclenche la notification push au moment de la vente, côté base
// (process_sale, voir supabase/setup.sql) : les deux doivent rester d'accord,
// sinon la carte d'alerte de l'aperçu, la liste filtrée du stock et l'alerte
// reçue sur le téléphone ne parleraient pas des mêmes produits.
export const LOW_STOCK_THRESHOLD = 5;

// Valeur du paramètre d'URL qui ouvre le stock filtré sur ces produits
// (/dashboard/stock?filtre=a-reapprovisionner), depuis la carte de l'aperçu.
export const RESTOCK_FILTER = 'a-reapprovisionner';

export const needsRestock = (product) => Number(product.stock_quantity) <= LOW_STOCK_THRESHOLD;

export const isOutOfStock = (product) => Number(product.stock_quantity) <= 0;

// Les ruptures d'abord, puis du plus vide au moins vide : c'est l'ordre dans
// lequel il faut passer commande.
export const byRestockUrgency = (a, b) =>
    Number(a.stock_quantity) - Number(b.stock_quantity) || String(a.name).localeCompare(String(b.name), 'fr');
