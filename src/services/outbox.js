import { get, set } from 'idb-keyval';

// File d'attente générique des écritures faites hors-ligne.
//
// Jusqu'ici seules les ventes survivaient à une coupure (syncService) : tout
// le reste — une dépense, une dette, un réassort — était simplement refusé,
// alors que c'est précisément ce qu'on fait dans une boutique quand le réseau
// tombe. Chaque écriture est donc enregistrée ici puis rejouée telle quelle au
// retour du réseau, par la même fonction de service qu'en ligne.
//
// Ce module ne connaît AUCUN service : il ne fait que stocker et relire des
// entrées. Le rejeu vit dans outboxFlush.js, qui importe les services. Sans
// cette séparation, chaque service important la file créerait un cycle
// d'imports avec la file important chaque service.
const OUTBOX_KEY = 'offline_outbox';

// Au-delà, on cesse de bloquer la file sur cette entrée : une écriture
// refusée par le serveur pour une raison de fond (stock épuisé entre-temps,
// règle métier) ne doit pas retenir indéfiniment celles d'après.
export const MAX_ATTEMPTS = 5;

export const readOutbox = async () => (await get(OUTBOX_KEY)) || [];
export const writeOutbox = async (entries) => set(OUTBOX_KEY, entries);

// Un identifiant tiré côté client sert de vraie clé primaire : Postgres
// accepte un uuid fourni, donc une dépense créée hors-ligne garde le même id
// avant et après synchronisation. Rien à réconcilier, et une deuxième
// tentative de rejeu ne peut pas créer de doublon.
export const newId = () => (
    globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        // Navigateurs sans randomUUID (Safari < 15.4, contexte non sécurisé) :
        // l'unicité suffit ici, ces ids ne sont jamais des secrets.
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        })
);

/**
 * Met une écriture en file. `kind` désigne l'opération à rejouer (voir
 * outboxFlush.js), `payload` ce qu'il faut lui passer — sérialisable tel quel,
 * puisqu'il traverse IndexedDB et peut survivre à un redémarrage du téléphone.
 */
export const enqueue = async ({ kind, payload, businessId, label }) => {
    const entry = {
        id: newId(),
        kind,
        payload,
        businessId: businessId || null,
        // Ce que l'utilisateur lira dans la liste des opérations en attente :
        // "3 opérations en attente" ne dit pas s'il peut fermer l'app.
        label: label || kind,
        queuedAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
        blocked: false,
    };
    const entries = await readOutbox();
    entries.push(entry);
    await writeOutbox(entries);
    return entry;
};

/** Nombre d'écritures en attente — alimente le badge hors-ligne. */
export const getOutboxCount = async () => (await readOutbox()).length;

/** Les entrées en attente d'un type donné, pour un commerce donné. */
export const pendingOfKind = async (kind, businessId) => {
    const entries = await readOutbox();
    return entries.filter((e) => e.kind === kind && (!businessId || e.businessId === businessId));
};

/**
 * Retire une entrée de la file. Sert au rejeu réussi, et à l'abandon explicite
 * d'une opération que le serveur refusera toujours.
 */
export const dropEntry = async (id) => {
    const entries = await readOutbox();
    await writeOutbox(entries.filter((e) => e.id !== id));
};

/** Entrées qui ont épuisé leurs tentatives : à montrer à l'utilisateur. */
export const blockedEntries = async () => (await readOutbox()).filter((e) => e.blocked);

/**
 * Recompose une liste telle que l'utilisateur doit la voir : les lignes du
 * serveur, plus celles créées hors-ligne et pas encore parties, moins celles
 * supprimées hors-ligne. Sans ça, une dépense saisie sans réseau
 * disparaîtrait de l'écran à la première actualisation, alors qu'elle attend
 * simplement son tour dans la file.
 *
 * Les lignes en attente portent `isPending`, pour que l'interface puisse le
 * signaler plutôt que de faire passer une écriture non confirmée pour acquise.
 */
export const mergePendingRows = async (rows, { addKind, updateKind, deleteKind, businessId }) => {
    const entries = await readOutbox();
    const mine = (e) => !businessId || !e.businessId || e.businessId === businessId;
    // Plusieurs opérations peuvent modifier une même ligne (corriger une
    // dette, la marquer remboursée) : elles s'appliquent dans l'ordre de la
    // file, comme elles le feront sur le serveur.
    const updateKinds = [].concat(updateKind || []);

    const added = entries
        .filter((e) => e.kind === addKind && mine(e))
        .map((e) => ({ ...e.payload, isPending: true }));

    const updates = new Map();
    entries
        .filter((e) => updateKinds.includes(e.kind) && mine(e))
        .forEach((e) => updates.set(e.payload.id, { ...(updates.get(e.payload.id) || {}), ...e.payload }));
    const deletedIds = new Set(
        entries.filter((e) => e.kind === deleteKind && mine(e)).map((e) => e.payload.id)
    );

    // Pendant la synchronisation, une ligne peut exister des deux côtés (déjà
    // insérée en base, pas encore retirée de la file) : l'id commun, tiré à la
    // création, permet de ne la garder qu'une fois.
    const addedIds = new Set(added.map((r) => r.id));

    return [...added, ...rows.filter((r) => !addedIds.has(r.id))]
        .filter((r) => !deletedIds.has(r.id))
        .map((r) => (updates.has(r.id) ? { ...r, ...updates.get(r.id), isPending: true } : r));
};
