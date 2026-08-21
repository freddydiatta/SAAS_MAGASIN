import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Delete } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { listCashiers, cashierLogin } from '../services/cashiersService';

export const SwitchUserModal = ({ isOpen, onClose }) => {
    const { selectedBusiness, switchToCashier } = useBusiness();
    const [selectedCashier, setSelectedCashier] = useState(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: cashiers = [] } = useQuery({
        queryKey: ['cashiers', selectedBusiness?.id],
        queryFn: () => listCashiers(selectedBusiness.id),
        enabled: isOpen && !!selectedBusiness,
    });
    const activeCashiers = cashiers.filter(c => c.is_active);

    if (!isOpen) return null;

    const reset = () => {
        setSelectedCashier(null);
        setPin('');
        setError('');
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const pressDigit = (digit) => {
        if (pin.length >= 4 || isSubmitting) return;
        const next = pin + digit;
        setPin(next);
        setError('');
        if (next.length === 4) {
            submitPin(next);
        }
    };

    const submitPin = async (fullPin) => {
        setIsSubmitting(true);
        try {
            const { email, password } = await cashierLogin({ memberId: selectedCashier.id, pin: fullPin });
            await switchToCashier({ email, password });
            handleClose();
        } catch (err) {
            setError(err.message || 'PIN invalide.');
            setPin('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-panel rounded-3xl p-8 max-w-sm w-full shadow-premium"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-primary">Changer d'utilisateur</h2>
                        <button onClick={handleClose} aria-label="Fermer" className="text-slate-400 hover:text-primary transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {!selectedCashier ? (
                        <div className="space-y-2">
                            {activeCashiers.length === 0 ? (
                                <p className="text-sm text-secondary text-center py-6">
                                    Aucun caissier actif. Ajoutez-en un depuis Paramètres.
                                </p>
                            ) : (
                                activeCashiers.map(cashier => (
                                    <button
                                        key={cashier.id}
                                        onClick={() => setSelectedCashier(cashier)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-border-theme hover:border-accent hover:bg-accent/5 transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-secondary">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <span className="font-semibold text-primary">{cashier.name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="font-bold text-primary">{selectedCashier.name}</p>
                                <p className="text-sm text-secondary">Entrez le code PIN à 4 chiffres</p>
                            </div>

                            <div className="flex justify-center gap-3">
                                {[0, 1, 2, 3].map(i => (
                                    <div
                                        key={i}
                                        className={`w-4 h-4 rounded-full border-2 ${pin.length > i ? 'bg-accent border-accent' : 'border-slate-300 dark:border-border-theme'}`}
                                    />
                                ))}
                            </div>

                            {error && (
                                <p className="text-sm text-red-500 text-center font-medium">{error}</p>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                                    <button
                                        key={digit}
                                        onClick={() => pressDigit(digit)}
                                        disabled={isSubmitting}
                                        className="py-4 rounded-xl bg-surface dark:bg-slate-800 text-lg font-bold text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                    >
                                        {digit}
                                    </button>
                                ))}
                                <button
                                    onClick={() => { setSelectedCashier(null); setPin(''); setError(''); }}
                                    className="py-4 rounded-xl text-sm font-semibold text-secondary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Retour
                                </button>
                                <button
                                    onClick={() => pressDigit('0')}
                                    disabled={isSubmitting}
                                    className="py-4 rounded-xl bg-surface dark:bg-slate-800 text-lg font-bold text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                >
                                    0
                                </button>
                                <button
                                    onClick={() => setPin(pin.slice(0, -1))}
                                    disabled={isSubmitting}
                                    aria-label="Effacer le dernier chiffre"
                                    className="py-4 rounded-xl flex items-center justify-center text-secondary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                >
                                    <Delete className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
