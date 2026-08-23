import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement IntersectionObserver — needed by framer-motion's
// useInView (src/components/animations.jsx's Reveal, used across the
// landing page) whenever a test renders one of those components.
global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};
