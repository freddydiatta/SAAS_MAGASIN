import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { EXPENSE_CATEGORIES } from '../services/expensesService';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const formatFCFA = (amount) => Number(amount).toLocaleString('fr-FR');

// Une couleur par catégorie, dans l'ordre où elles apparaissent dans
// EXPENSE_CATEGORIES — dégradé de l'accent app plutôt que des couleurs
// arbitraires, pour rester cohérent avec le reste des graphiques (cf.
// RetailDashboard).
const CATEGORY_COLORS = ['#D96645', '#E8B6A6', '#C25637', '#94A3B8', '#64748B'];

export const Depenses = () => {
    const { selectedBusiness, currentMember } = useBusiness();
    const { user } = useAuth();
    const actorLabel = currentMember?.name || user?.email || 'unknown';

    const {
        expenses, isLoading, totalExpenses, totalExpensesToday, expensesByCategory,
        isAddOpen, openAddForm, closeForm,
        formData, setFormData,
        handleSubmit, handleDelete, isSaving,
    } = useExpenses(selectedBusiness, actorLabel);

    const columns = [
        {
            key: 'date',
            header: 'Date',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6 text-secondary text-sm',
            render: (expense) => new Date(expense.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        },
        {
            key: 'category',
            header: 'Catégorie',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6 font-bold text-primary',
            render: (expense) => EXPENSE_CATEGORIES[expense.category] || expense.category,
        },
        {
            key: 'label',
            header: 'Description',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6 text-secondary text-sm',
            render: (expense) => expense.label || '—',
        },
        {
            key: 'amount',
            header: 'Montant',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right',
            cellClassName: 'py-4 px-6 text-right font-bold text-primary',
            render: (expense) => `${formatFCFA(expense.amount)} F`,
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'py-4 px-6',
            cellClassName: 'py-4 px-6 text-right',
            render: (expense) => (
                <button
                    onClick={() => handleDelete(expense)}
                    aria-label="Supprimer la dépense"
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            ),
        },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Dépenses</h1>
                    <p className="text-secondary text-sm">Transport, divers... pour connaître votre bénéfice réel.</p>
                </div>
                <button onClick={openAddForm} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Ajouter une dépense
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium">Dépenses aujourd'hui</p>
                        <h3 className="text-2xl font-bold text-primary">{formatFCFA(totalExpensesToday)} <span className="text-sm">FCFA</span></h3>
                    </div>
                </div>
                <div className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-secondary">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium">Total enregistré</p>
                        <h3 className="text-2xl font-bold text-primary">{formatFCFA(totalExpenses)} <span className="text-sm">FCFA</span></h3>
                    </div>
                </div>
            </div>

            {expensesByCategory.length > 0 && (
                <div className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme">
                    <h2 className="text-lg font-bold text-primary mb-6">Répartition par catégorie</h2>
                    <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={expensesByCategory}
                                    dataKey="total"
                                    nameKey="label"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={2}
                                >
                                    {expensesByCategory.map((entry, index) => (
                                        <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}
                                    formatter={(value) => [`${formatFCFA(value)} FCFA`, 'Total']}
                                />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                <DataTable
                    columns={columns}
                    data={expenses}
                    isLoading={isLoading}
                    emptyContent="Aucune dépense enregistrée pour le moment."
                />
            </div>

            <Modal isOpen={isAddOpen} onClose={closeForm} title="Ajouter une dépense" maxWidth="max-w-sm">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Catégorie</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                        >
                            {Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">
                            Description {formData.category === 'divers' && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            type="text"
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder={formData.category === 'divers' ? 'Ex: Réparation vitrine' : 'Optionnel'}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Montant (FCFA)</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: 2000"
                        />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={closeForm} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                            Annuler
                        </button>
                        <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover shadow-md transition-all disabled:opacity-50">
                            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
