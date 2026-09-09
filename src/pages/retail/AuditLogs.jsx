import { useBusiness } from '../../contexts/BusinessContext';
import { useAuditLogs, ACTION_OPTIONS } from '../../hooks/useAuditLogs';
import { ShieldAlert, ArrowRight, LogIn, XCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { DataTable } from '../../components/DataTable';
import { DateRangeFilter } from '../../components/DateRangeFilter';

export const AuditLogs = () => {
    const { selectedBusiness } = useBusiness();
    const {
        logs, totalLogsCount, isLoading,
        actionFilter, setActionFilter,
        dateFilter, setDateFilter, customFrom, setCustomFrom, customTo, setCustomTo,
    } = useAuditLogs(selectedBusiness);

    if (isLoading) {
        return <div className="p-8 text-center text-secondary">Chargement des logs de sécurité...</div>;
    }

    const formatAction = (action) => {
        switch (action) {
            case 'CANCEL_SALE':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Vente Annulée</span>;
            case 'MODIFY_SALE':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Vente Modifiée</span>;
            case 'MODIFY_DEBT':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Dette Modifiée</span>;
            case 'MODIFY_PURCHASE_ORDER':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Bon de Commande Modifié</span>;
            case 'UNRECEIVE_PURCHASE_ORDER':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Réception de Bon Annulée</span>;
            case 'DELETE_PURCHASE_ORDER':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Bon de Commande Supprimé</span>;
            case 'VALIDATE_INVENTORY':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Inventaire Validé</span>;
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

        if (log.action === 'MODIFY_DEBT') {
            const FIELD_LABELS = { customer_name: 'Client', customer_phone: 'Téléphone', amount: 'Montant', note: 'Description' };
            const changedFields = Object.keys(FIELD_LABELS).filter(
                (field) => details.before?.[field] !== details.after?.[field]
            );
            return (
                <div className="text-sm space-y-1">
                    {changedFields.map((field) => (
                        <div key={field} className="bg-surface dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-border-theme flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-primary">{FIELD_LABELS[field]}</span>
                            <span className="text-slate-400 mx-1">|</span>
                            <span className="text-slate-500 line-through">{details.before?.[field] || '—'}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <strong className="text-amber-600">{details.after?.[field] || '—'}</strong>
                        </div>
                    ))}
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

        if (log.action === 'MODIFY_PURCHASE_ORDER') {
            const formatItems = (items) =>
                (items || []).map((item) => `${item.product_name} ×${item.quantity} (${Number(item.unit_cost).toLocaleString('fr-FR')} F)`).join(', ') || '—';
            return (
                <div className="text-sm space-y-2">
                    <div className="flex gap-2 items-center text-secondary text-xs">
                        <span className="line-through">{Number(details.before?.total_amount ?? 0).toLocaleString('fr-FR')} F</span>
                        <ArrowRight className="w-3 h-3" />
                        <strong className="text-amber-600">{Number(details.after?.total_amount ?? 0).toLocaleString('fr-FR')} F</strong>
                    </div>
                    <div className="bg-surface dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-border-theme space-y-1">
                        <div className="text-slate-500 line-through">{formatItems(details.before?.items)}</div>
                        <div><strong className="text-amber-600">{formatItems(details.after?.items)}</strong></div>
                    </div>
                </div>
            );
        }

        if (log.action === 'UNRECEIVE_PURCHASE_ORDER') {
            return (
                <div className="text-sm text-secondary">
                    Le stock ajouté par ce bon (<strong className="text-primary">{Number(details.total_amount ?? 0).toLocaleString('fr-FR')} F</strong>) a été retiré ; le bon est repassé en attente.
                </div>
            );
        }

        if (log.action === 'DELETE_PURCHASE_ORDER') {
            const formatItems = (items) =>
                (items || []).map((item) => `${item.product_name} ×${item.quantity}`).join(', ') || '—';
            return (
                <div className="text-sm space-y-1">
                    <div className="text-secondary text-xs">Statut au moment de la suppression : {details.status}</div>
                    <div className="bg-surface dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-border-theme">
                        {formatItems(details.items)} — <strong className="text-primary">{Number(details.total_amount ?? 0).toLocaleString('fr-FR')} F</strong>
                    </div>
                </div>
            );
        }

        if (log.action === 'VALIDATE_INVENTORY') {
            const adjustments = details.adjustments || [];
            return (
                <div className="text-sm space-y-1">
                    <div className="text-secondary text-xs mb-1">{adjustments.length} article{adjustments.length > 1 ? 's' : ''} corrigé{adjustments.length > 1 ? 's' : ''}</div>
                    {adjustments.map((adj, idx) => (
                        <div key={idx} className="bg-surface dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-border-theme flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-primary">{adj.product_name}</span>
                            <span className="text-slate-400 mx-1">|</span>
                            <span className="text-slate-500 line-through">{adj.expected}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <strong className="text-amber-600">{adj.counted}</strong>
                            <span className={`text-xs font-bold ${adj.difference < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                ({adj.difference > 0 ? '+' : ''}{adj.difference})
                            </span>
                        </div>
                    ))}
                </div>
            );
        }

        return <pre className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{JSON.stringify(details, null, 2)}</pre>;
    };

    const columns = [
        {
            key: 'date',
            header: 'Date & Heure',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6',
            render: (log) => (
                <>
                    <div className="font-bold text-primary">
                        {new Date(log.created_at).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="text-sm text-secondary">
                        {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </>
            ),
        },
        {
            key: 'user',
            header: 'Utilisateur',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6',
            render: (log) => (
                <div className="font-bold text-primary flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 flex items-center justify-center text-sm font-bold">
                        {log.user_email?.charAt(0).toUpperCase()}
                    </div>
                    {log.user_email}
                </div>
            ),
        },
        {
            key: 'action',
            header: 'Action',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6',
            render: (log) => formatAction(log.action),
        },
        {
            key: 'details',
            header: "Détails de l'opération",
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6',
            render: (log) => formatDetails(log),
        },
    ];

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

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="px-4 py-2 rounded-full border border-slate-200 dark:border-border-theme text-sm font-medium bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                    {ACTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <DateRangeFilter
                    value={dateFilter}
                    onChange={setDateFilter}
                    customFrom={customFrom}
                    customTo={customTo}
                    onCustomFromChange={setCustomFrom}
                    onCustomToChange={setCustomTo}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden"
            >
                <DataTable
                    columns={columns}
                    data={logs}
                    emptyContent={totalLogsCount > 0 ? 'Aucune activité pour ces filtres.' : 'Aucune activité suspecte détectée.'}
                />
            </motion.div>
        </div>
    );
};
