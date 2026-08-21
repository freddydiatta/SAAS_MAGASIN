import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

// Wrapper de modale partagé : jusqu'ici, le même bloc backdrop+panel animé
// (fond flouté, cadre arrondi, en-tête titre+croix) était recopié à la main
// dans une dizaine de fichiers, chacun avec sa propre variante légèrement
// différente. Centralisé ici pour la famille de modales qui partage
// exactement ce style (fond bg-panel, coins rounded-3xl, padding p-8) ;
// gère aussi la fermeture au clavier (Echap), absente partout avant.
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
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
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
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full ${maxWidth} ${panelClassName}`}
                    >
                        {title !== undefined && (
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-primary">{title}</h2>
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
