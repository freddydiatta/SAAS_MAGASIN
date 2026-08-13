import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';

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

        if (log.action === 'MODIFY_SALE') {
            return (
                <div className="text-sm space-y-1">
                    <div className="flex gap-2 text-secondary text-xs mb-1">
                        <span className="line-through">{details.old_total?.toLocaleString('fr-FR')} F</span>
                        <span>➔</span>
                        <strong className="text-indigo-600">{details.new_total?.toLocaleString('fr-FR')} F</strong>
                    </div>
                    {details.changes?.map((change, idx) => (
                        <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="font-medium text-primary">{change.product}</span> : 
                            <span className="ml-1 text-slate-500 line-through">{change.old_qty}</span> 
                            <span className="mx-1">➔</span> 
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
                    <span className="text-red-500">🛡️</span> Logs de Sécurité
                </h1>
                <p className="text-secondary mt-1">
                    Trace complète des annulations et modifications pour prévenir les fraudes. 
                    <strong className="text-primary ml-1">Seul le gérant a accès à cette page.</strong>
                </p>
            </div>

            <div className="bg-white rounded-3xl shadow-premium border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm">Date & Heure</th>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm">Utilisateur</th>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm">Action</th>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm">Détails de l'opération</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-secondary">
                                        Aucune activité suspecte détectée.
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="font-medium text-primary">
                                                {new Date(log.created_at).toLocaleDateString('fr-FR')}
                                            </div>
                                            <div className="text-xs text-secondary">
                                                {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-medium text-primary flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
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
            </div>
        </div>
    );
};
