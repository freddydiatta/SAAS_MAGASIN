import { Hammer } from 'lucide-react';
import { motion } from 'framer-motion';

export const PlaceholderPage = ({ title }) => {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">{title}</h1>
                    <p className="text-secondary text-sm">
                        Page en cours de construction
                    </p>
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-panel rounded-3xl p-12 shadow-premium text-center border border-slate-100 dark:border-border-theme flex flex-col items-center justify-center"
            >
                <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mb-6">
                    <Hammer className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-primary mb-3">Bientôt disponible</h2>
                <p className="text-secondary max-w-md mx-auto">
                    Cette fonctionnalité est en cours de développement et sera disponible dans une prochaine mise à jour.
                </p>
            </motion.div>
        </div>
    );
};
