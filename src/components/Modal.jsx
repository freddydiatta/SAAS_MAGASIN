import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

let modalIdCounter = 0;

// Wrapper de modale partagé : jusqu'ici, le même bloc backdrop+panel animé
// (fond flouté, cadre arrondi, en-tête titre+croix) était recopié à la main
// dans une dizaine de fichiers, chacun avec sa propre variante légèrement
// différente. Centralisé ici pour la famille de modales qui partage
// exactement ce style (fond bg-panel, coins rounded-3xl, padding p-8) ;
// gère aussi la fermeture au clavier (Echap) et l'accessibilité clavier
// (role=dialog, focus renvoyé au déclencheur à la fermeture, Tab qui reste
// piégé dans la modale au lieu de fuir vers le contenu masqué derrière),
// absentes partout avant.
export const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'max-w-md',
    panelClassName = 'bg-panel rounded-3xl p-8 shadow-premium',
    closeOnBackdropClick = false,
    zIndexClassName = 'z-50',
}) => {
    const panelRef = useRef(null);
    const [titleId] = useState(() => `modal-title-${++modalIdCounter}`);

    useEffect(() => {
        if (!isOpen) return;

        const previouslyFocused = document.activeElement;
        const focusFirst = () => {
            const focusable = panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
            (focusable?.[0] || panelRef.current)?.focus();
        };
        // Le panneau ne se monte qu'une fois isOpen true (via AnimatePresence),
        // donc panelRef n'est attaché qu'après ce rendu — d'où le micro-délai.
        const focusTimer = setTimeout(focusFirst, 0);

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !panelRef.current) return;

            const focusable = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            clearTimeout(focusTimer);
            window.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm ${zIndexClassName} flex items-center justify-center p-4`}
                    onClick={closeOnBackdropClick ? onClose : undefined}
                >
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title !== undefined ? titleId : undefined}
                        tabIndex={-1}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full ${maxWidth} ${panelClassName}`}
                    >
                        {title !== undefined && (
                            <div className="flex justify-between items-center mb-6">
                                <h2 id={titleId} className="text-xl font-bold text-primary">{title}</h2>
                                <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-primary transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
