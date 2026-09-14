import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// jsdom n'implémente pas IndexedDB, or la file d'attente hors-ligne
// (src/services/outbox.js) est désormais importée par la plupart des services :
// le moindre test touchant à une écriture plantait sur "indexedDB is not
// defined". Un magasin en mémoire suffit et garde les tests rapides — un test
// qui a besoin d'un comportement particulier peut toujours refaire son propre
// vi.mock('idb-keyval') localement, qui prend le pas sur celui-ci.
const memoryStore = new Map();

vi.mock('idb-keyval', () => ({
    get: vi.fn(async (key) => memoryStore.get(key)),
    set: vi.fn(async (key, value) => { memoryStore.set(key, value); }),
    del: vi.fn(async (key) => { memoryStore.delete(key); }),
    clear: vi.fn(async () => { memoryStore.clear(); }),
}));

// Sans ça, une file laissée pleine par un test ferait échouer le suivant.
beforeEach(() => memoryStore.clear());

// jsdom doesn't implement IntersectionObserver — needed by framer-motion's
// useInView (src/components/animations.jsx's Reveal, used across the
// landing page) whenever a test renders one of those components.
global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};
