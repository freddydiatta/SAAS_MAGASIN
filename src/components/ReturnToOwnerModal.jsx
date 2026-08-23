import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { Modal } from './Modal';

export const ReturnToOwnerModal = ({ isOpen, onClose }) => {
    const { switchBackToOwner, getStashedOwnerEmail } = useBusiness();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const ownerEmail = getStashedOwnerEmail();

    const handleClose = () => {
        setPassword('');
        setError('');
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await switchBackToOwner(password);
            handleClose();
        } catch (err) {
            // Le retour au propriétaire exige toujours le réseau (par design,
            // pour empêcher un appareil laissé en mode caissier de repasser
            // propriétaire sans preuve d'identité) — sans ce message
            // dédié, une tentative hors-ligne affichait "Mot de passe
            // incorrect" alors que le mot de passe n'a même pas pu être
            // vérifié, ce qui aurait induit en erreur.
            setError(!navigator.onLine
                ? 'Connexion internet requise pour revenir au compte propriétaire.'
                : 'Mot de passe incorrect.');
            setPassword('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Revenir au propriétaire" maxWidth="max-w-sm">
            <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-secondary mb-3">
                    <Lock className="w-5 h-5" />
                </div>
                <p className="text-sm text-secondary">
                    Confirmez le mot de passe de <strong className="text-primary">{ownerEmail}</strong> pour reprendre l'accès complet.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="password"
                    autoFocus
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mot de passe"
                    className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                {error && (
                    <p className="text-sm text-red-500 text-center font-medium">{error}</p>
                )}
                <button
                    type="submit"
                    disabled={isSubmitting || !password}
                    className="w-full py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover shadow-md transition-all disabled:opacity-50"
                >
                    {isSubmitting ? 'Vérification...' : 'Confirmer'}
                </button>
            </form>
        </Modal>
    );
};
