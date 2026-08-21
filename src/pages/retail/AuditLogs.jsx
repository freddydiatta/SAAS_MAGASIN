import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { ShieldAlert, ArrowRight, LogIn, XCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export const AuditLogs = () => {
    const { selectedBusiness } = useBusiness();

    const { data: logs = [], isLoading } = useQuery({
        queryKey: ['audit_logs', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    if (isLoading) {
        return <div className="p-8 text-center text-secondary">Chargement des logs de sécurité...</div>;
    }

    const formatAction = (action) => {
        switch (action) {
            case 'CANCEL_SALE':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Vente Annulée</span>;
            case 'MODIFY_SALE':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Vente Modifiée</span>;
            case 'LOGIN_SUCCESS':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><LogIn className="w-3 h-3" /> Connexion réussie</span>;
            case 'LOGIN_FAILED':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> Connexion échouée</span>;
            case 'LOGIN_FAILED_PIN':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> Code PIN incorrect</span>;
            case 'ACCOUNT_LOCKED':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-white"><Lock className="w-3 h-3" /> Compte verrouillé</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{action}</span>;
        }
    };

    const formatDetails = (log) => {
        const details = log.details;
        if (!details) return <span className="text-slate-400 italic">Aucun détail</span>;

        if (log.action === 'CANCEL_SALE') {
            return (
                <div className="text-sm">
                    Total annulé : <strong className="text-red-600">{details.total_amount?.toLocaleString('fr-FR')} FCFA</strong>
                </div>
            );
        }

        if (log.action === 'LOGIN_SUCCESS') {
            return (
                <div className="text-sm text-secondary">
                    Connecté en tant que <strong className="text-primary">{details.role === 'owner' ? 'propriétaire' : 'caissier'}</strong>
                </div>
            );
        }

        if (log.action === 'LOGIN_FAILED') {
            return <div className="text-sm text-secondary">Mot de passe incorrect.</div>;
        }

        if (log.action === 'LOGIN_FAILED_PIN' || log.action === 'ACCOUNT_LOCKED') {
            return (
                <div className="text-sm text-secondary">
                    {details.reason === 'locked'
                        ? 'Tentative pendant un verrouillage temporaire.'
                        : `Code PIN incorrect${details.attempts ? ` (tentative n°${details.attempts})` : ''}.`}
                </div>
            );
        }

        if (log.action === 'MODIFY_SALE') {
            return (
                <div className="text-sm space-y-1">
                    <div className="flex gap-2 items-center text-secondary text-xs mb-2">
                        <span className="line-through">{details.old_total?.toLocaleString('fr-FR')} F</span>
                        <ArrowRight className="w-3 h-3" />
                        <strong className="text-indigo-600 dark:text-indigo-400">{details.new_total?.toLocaleString('fr-FR')} F</strong>
                    </div>
                    {details.changes?.map((change, idx) => (
                        <div key={idx} className="bg-surface dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-border-theme flex items-center gap-2">
                            <span className="font-medium text-primary">{change.product}</span>
                            <span className="text-slate-400 mx-1">|</span>
                            <span className="text-slate-500 line-through">{change.old_qty}</span> 
                            <ArrowRight className="w-3 h-3 text-slate-400" /> 
                            <strong className="text-amber-600">{change.new_qty}</strong>
                        </div>
                    ))}
                </div>
            );
        }

        return <pre className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{JSON.stringify(details, null, 2)}</pre>;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
            <div>
                <h1 className="text-3xl font-bold text-primary tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-500">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    Logs de Sécurité
                </h1>
                <p className="text-secondary mt-1">
                    Trace complète des annulations et modifications pour prévenir les fraudes. 
                    <strong className="text-primary ml-1">Seul le gérant a accès à cette page.</strong>
                </p>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-border-theme">
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Date & Heure</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Utilisateur</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Action</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Détails de l'opération</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-theme">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-secondary">
                                        Aucune activité suspecte détectée.
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-primary">
                                                {new Date(log.created_at).toLocaleDateString('fr-FR')}
                                            </div>
                                            <div className="text-sm text-secondary">
                                                {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-primary flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 flex items-center justify-center text-sm font-bold">
                                                    {log.user_email?.charAt(0).toUpperCase()}
                                                </div>
                                                {log.user_email}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {formatAction(log.action)}
                                        </td>
                                        <td className="py-4 px-6">
                                            {formatDetails(log)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};
