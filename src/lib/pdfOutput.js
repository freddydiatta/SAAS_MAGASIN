// Sortie des documents PDF (factures, bons de commande) : partager, ouvrir,
// télécharger ou imprimer.
//
// L'impression passe par le PDF, jamais par window.print() sur la page : sur
// iPhone, Safari imprimait la mise en page du téléphone — facture tassée sur
// deux tiers de la feuille, colonne « Total » coupée, numéro sur deux lignes,
// adresse du site en pied de page. Le PDF, lui, a la même tête partout.

/** Téléphone ou tablette : doigt plutôt que souris. */
export const isTouchDevice = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

// Safari sur ordinateur imprime une page blanche quand le PDF est dans un
// cadre caché : on lui ouvre plutôt le PDF dans un onglet.
const isDesktopSafari = () =>
    typeof navigator !== 'undefined' && /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

const toFile = (doc, fileName) => new File([doc.output('blob')], fileName, { type: 'application/pdf' });

/**
 * Feuille de partage du système (WhatsApp, e-mail, et « Imprimer » sur
 * iPhone et Android). Renvoie false si l'appareil ne sait pas partager un
 * fichier, pour laisser la main à la solution suivante.
 */
const shareFile = (file, title) => {
    if (!navigator.share || !navigator.canShare || !navigator.canShare({ files: [file] })) return false;
    navigator.share({ title, files: [file] }).catch(() => {
        // l'utilisateur a fermé la feuille de partage : rien à signaler
    });
    return true;
};

const openInNewTab = (doc, fileName) => {
    const blobUrl = URL.createObjectURL(doc.output('blob'));
    const newWin = window.open(blobUrl, '_blank');
    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        // fenêtre bloquée : on enregistre le fichier directement
        doc.save(fileName);
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

/** « PDF / Partager » : partager si possible, sinon ouvrir, sinon télécharger. */
export const deliverPdf = (doc, { fileName, title }) => {
    if (shareFile(toFile(doc, fileName), title)) return;
    openInNewTab(doc, fileName);
};

/**
 * « Imprimer » : imprime le PDF lui-même.
 *
 * - Téléphone : la feuille de partage, dont l'option « Imprimer » imprime le
 *   PDF tel quel. Il n'existe pas de moyen plus direct côté navigateur.
 * - Ordinateur : le PDF est chargé dans un cadre invisible et sa boîte
 *   d'impression s'ouvre aussitôt.
 */
export const printPdf = (doc, { fileName, title }) => {
    if (isTouchDevice()) {
        deliverPdf(doc, { fileName, title });
        return;
    }
    if (isDesktopSafari()) {
        openInNewTab(doc, fileName);
        return;
    }

    const blobUrl = URL.createObjectURL(doc.output('blob'));
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    frame.onload = () => {
        try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } catch {
            openInNewTab(doc, fileName);
        }
        // Retirer le cadre tout de suite interromprait l'impression : on le
        // garde le temps que la boîte d'impression soit fermée.
        setTimeout(() => {
            frame.remove();
            URL.revokeObjectURL(blobUrl);
        }, 60000);
    };
    frame.src = blobUrl;
    document.body.appendChild(frame);
};
