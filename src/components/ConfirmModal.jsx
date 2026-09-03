import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

// Confirmation partagée : jusqu'ici, chaque page qui avait besoin d'un "oui/
// non" avant une action (supprimer, marquer reçu, annuler...) utilisait soit
// son propre Modal recopié à la main (HistoriqueVentes), soit window.confirm
// (Fournisseurs, Dettes) — une popup navigateur générique, pas très jolie et
// pas cohérente avec le reste de l'app. Centralisé ici sur le même modèle
// que le "Annuler la vente ?" déjà présent dans HistoriqueVentes.
const TONES = {
    red: { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', button: 'bg-red-600 hover:bg-red-700' },
    emerald: { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', button: 'bg-emerald-600 hover:bg-emerald-700' },
    accent: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-accent', button: 'bg-accent hover:bg-accent-hover' },
};

export const ConfirmModal = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    tone = 'accent',
    isConfirming = false,
    onConfirm,
    onCancel,
}) => {
    const colors = TONES[tone] || TONES.accent;

    return (
        <Modal isOpen={isOpen} onClose={onCancel}>
            <div className={`w-16 h-16 rounded-full ${colors.bg} flex items-center justify-center ${colors.text} mb-6 mx-auto`}>
                <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-primary text-center mb-2">{title}</h2>
            <p className="text-secondary text-center mb-8">{message}</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 btn-secondary py-3">{cancelLabel}</button>
                <button
                    onClick={onConfirm}
                    disabled={isConfirming}
                    className={`flex-1 ${colors.button} text-white font-bold rounded-xl py-3 transition-colors disabled:opacity-50 shadow-premium`}
                >
                    {isConfirming ? 'Patientez...' : confirmLabel}
                </button>
            </div>
        </Modal>
    );
};
