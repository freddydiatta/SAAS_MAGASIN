import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useFinances } from '../../hooks/useFinances';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, Wallet, TrendingUp, TrendingDown, HandCoins, Package, Percent, Banknote, Plus, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMoneyAccounts } from '../../hooks/useMoneyAccounts';
import { Modal } from '../../components/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { formatDate } from '../../lib/dates';

// Ce qu'il reste sur un moyen de paiement : le point de départ déclaré, que
// les ventes et les dépenses font ensuite monter ou descendre tout seul. Le
// détail des entrées du mois vit dans l'aperçu, pas ici.
const MethodBalance = ({ label, balance, accounts, emptyLabel, isLoading, formatFCFA, onEdit, onDelete }) => (
    <div>
        <p className="text-secondary text-sm font-medium mb-1">{label}</p>
        {balance === null ? (
            <p className="text-sm text-slate-400 mt-2">{emptyLabel}</p>
        ) : (
            <>
                <p className="text-3xl font-bold text-primary">
                    {isLoading ? '…' : formatFCFA(balance.current)} <span className="text-base font-medium">F</span>
                </p>
                {/* D'où vient le chiffre : sans ça, un solde calculé qui ne
                    correspond pas au tiroir n'est pas vérifiable. */}
                <p className="text-xs text-slate-400 mt-1">
                    Départ {formatFCFA(balance.opening)} F le {formatDate(balance.since, { day: 'numeric', month: 'short' })}
                    {balance.movements !== 0 && (
                        <> · {balance.movements > 0 ? '+' : '−'} {formatFCFA(Math.abs(balance.movements))} F depuis</>
                    )}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-border-theme space-y-1.5">
                    {accounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-primary truncate">{account.name}</p>
                            <div className="flex items-center gap-1 shrink-0">
                                <span className="text-sm text-secondary">{formatFCFA(account.opening_balance)} F</span>
                                <button
                                    onClick={() => onEdit(account)}
                                    aria-label={`Modifier ${account.name}`}
                                    className="p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => onDelete(account)}
                                    aria-label={`Supprimer ${account.name}`}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )}
    </div>
);

export const Finances = () => {
    const { selectedBusiness } = useBusiness();
    const navigate = useNavigate();
    const {
        isLoading,
        totalRevenue,
        netProfit,
        revenueThisMonth,
        profitThisMonth,
        percentChangeMonth,
        pendingDebtsTotal,
        monthlyTrend,
        stockSaleValue,
        stockCost,
        stockPotentialProfit,
        productsWithoutCostPrice,
        productsWithoutCostPriceCount,
        projectedTotalProfit,
        salesMargin,
        salesWithoutCostCount,
        cashBalance,
        mobileBalance,
        totalOnHand,
        formatFCFA,
    } = useFinances(selectedBusiness);

    const {
        cashAccounts, mobileAccounts,
        isFormOpen, editingAccount, openAddForm, openEditForm, closeForm,
        formData, setFormData, handleSubmit, isSaving,
        accountToDelete, handleDelete, closeDeleteConfirm, confirmDelete, isDeleting,
    } = useMoneyAccounts(selectedBusiness);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-10">
            <div>
                <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Finances</h1>
                <p className="text-secondary text-sm">Ce que vous avez réellement gagné, au-delà de la caisse du jour.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <p className="text-secondary text-sm font-medium">Chiffre d'affaires total</p>
                    </div>
                    <h3 className="text-2xl font-bold text-primary">{isLoading ? '…' : formatFCFA(totalRevenue)} <span className="text-sm font-medium">F</span></h3>
                    <p className="text-xs text-slate-400 mt-1">Argent réellement encaissé, depuis le début</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-emerald-500">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <p className="text-secondary text-sm font-medium">Bénéfice net total</p>
                    </div>
                    <h3 className={`text-2xl font-bold ${netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {isLoading ? '…' : formatFCFA(netProfit)} <span className="text-sm font-medium">F</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Chiffre d'affaires moins les dépenses</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-blue-500">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <p className="text-secondary text-sm font-medium">Ce mois-ci</p>
                    </div>
                    <h3 className="text-2xl font-bold text-primary">{isLoading ? '…' : formatFCFA(revenueThisMonth)} <span className="text-sm font-medium">F</span></h3>
                    <div className="flex items-center gap-1 text-xs mt-1">
                        <span className={`flex items-center gap-1 font-bold ${percentChangeMonth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {percentChangeMonth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {percentChangeMonth > 0 ? '+' : ''}{percentChangeMonth}%
                        </span>
                        <span className="text-slate-400">vs mois dernier</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Bénéfice du mois : {formatFCFA(profitThisMonth)} F</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => navigate('/dashboard/dettes')}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme cursor-pointer hover:border-accent/30 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <HandCoins className="w-6 h-6" />
                        </div>
                        <p className="text-secondary text-sm font-medium">Dettes en attente</p>
                    </div>
                    <h3 className="text-2xl font-bold text-primary">{isLoading ? '…' : formatFCFA(pendingDebtsTotal)} <span className="text-sm font-medium">F</span></h3>
                    <p className="text-xs text-slate-400 mt-1">Pas encore compté dans le chiffre d'affaires</p>
                </motion.div>
            </div>

            <div className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-blue-500">
                            <Banknote className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-primary">Ce que vous avez en main</h2>
                            <p className="text-xs text-secondary">Ce qu'il vous reste, calculé depuis le montant de départ que vous avez déclaré. Le détail des entrées du jour est dans l'aperçu.</p>
                        </div>
                    </div>
                    <button
                        onClick={openAddForm}
                        className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white bg-accent hover:bg-accent-hover shadow-md transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Compte
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <MethodBalance
                        label="Espèces"
                        balance={cashBalance}
                        accounts={cashAccounts}
                        emptyLabel="Ajoutez votre caisse pour suivre ce qu'il y a dans le tiroir."
                        isLoading={isLoading}
                        formatFCFA={formatFCFA}
                        onEdit={openEditForm}
                        onDelete={handleDelete}
                    />
                    <MethodBalance
                        label="Mobile Money"
                        balance={mobileBalance}
                        accounts={mobileAccounts}
                        emptyLabel="Ajoutez Wave, Orange Money…"
                        isLoading={isLoading}
                        formatFCFA={formatFCFA}
                        onEdit={openEditForm}
                        onDelete={handleDelete}
                    />
                </div>

                {(cashBalance || mobileBalance) && (
                    <div className="pt-6 mt-6 border-t border-slate-100 dark:border-border-theme flex items-center justify-between gap-2">
                        <span className="text-secondary font-medium">Total en main</span>
                        <span className="text-2xl font-bold text-accent">{isLoading ? '…' : formatFCFA(totalOnHand)} F</span>
                    </div>
                )}
            </div>

            <div className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-emerald-500">
                        <Percent className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-primary">Marge réelle sur vos ventes</h2>
                        <p className="text-xs text-secondary">Prix de vente moins le prix d'achat réellement payé au moment de chaque vente — ne bouge pas si votre prix d'achat change ensuite.</p>
                    </div>
                </div>

                <p className={`text-2xl font-bold ${salesMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {isLoading ? '…' : formatFCFA(salesMargin)} <span className="text-sm font-medium">F</span>
                </p>

                {salesWithoutCostCount > 0 && (
                    <p className="text-xs text-slate-400 mt-3">
                        {salesWithoutCostCount} vente{salesWithoutCostCount > 1 ? 's' : ''} sans coût connu au moment de la vente (avant l'activation de ce suivi, ou produit sans prix d'achat renseigné), non comptée{salesWithoutCostCount > 1 ? 's' : ''}.
                    </p>
                )}
            </div>

            <div className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-primary">Si vous vendez tout votre stock</h2>
                        <p className="text-xs text-secondary">Ce que rapporterait le stock restant, en plus de ce qui est déjà gagné.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                    <div>
                        <p className="text-secondary text-sm font-medium mb-1">Valeur de vente du stock</p>
                        <p className="text-xl font-bold text-primary">{isLoading ? '…' : formatFCFA(stockSaleValue)} F</p>
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium mb-1">Coût du stock</p>
                        <p className="text-xl font-bold text-primary">{isLoading ? '…' : formatFCFA(stockCost)} F</p>
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium mb-1">Bénéfice potentiel</p>
                        <p className={`text-xl font-bold ${stockPotentialProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {isLoading ? '…' : formatFCFA(stockPotentialProfit)} F
                        </p>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-secondary font-medium">Bénéfice total si vous vendez tout</span>
                    <span className={`text-2xl font-bold ${projectedTotalProfit >= 0 ? 'text-accent' : 'text-red-500'}`}>
                        {isLoading ? '…' : formatFCFA(projectedTotalProfit)} F
                    </span>
                </div>

                {productsWithoutCostPriceCount > 0 && (
                    <div className="text-xs text-slate-400 mt-4">
                        <p className="mb-2">
                            {productsWithoutCostPriceCount} produit{productsWithoutCostPriceCount > 1 ? 's' : ''} sans prix d'achat renseigné, non compté{productsWithoutCostPriceCount > 1 ? 's' : ''} dans le coût ni le bénéfice potentiel du stock :
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {productsWithoutCostPrice.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => navigate(`/dashboard/stock?q=${encodeURIComponent(product.name)}`)}
                                    className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                                >
                                    {product.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme">
                <h2 className="text-lg font-bold text-primary mb-6">Revenus et dépenses — 6 derniers mois</h2>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}
                                formatter={(value) => `${Number(value).toLocaleString('fr-FR')} FCFA`}
                            />
                            <Legend />
                            <Bar dataKey="revenue" name="Revenus" fill="#10B981" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="expenses" name="Dépenses" fill="#D96645" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <Modal
                isOpen={isFormOpen}
                onClose={closeForm}
                title={editingAccount ? 'Mettre à jour le solde' : 'Nouveau compte'}
                maxWidth="max-w-sm"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Nom du compte</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: Caisse, Wave, Orange Money"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, kind: 'cash' })}
                                className={`py-2.5 rounded-xl font-semibold text-sm border transition-colors ${formData.kind === 'cash'
                                    ? 'border-accent bg-accent/10 text-accent'
                                    : 'border-slate-300 dark:border-border-theme text-secondary hover:border-accent/50'}`}
                            >
                                Espèces
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, kind: 'mobile_money' })}
                                className={`py-2.5 rounded-xl font-semibold text-sm border transition-colors ${formData.kind === 'mobile_money'
                                    ? 'border-accent bg-accent/10 text-accent'
                                    : 'border-slate-300 dark:border-border-theme text-secondary hover:border-accent/50'}`}
                            >
                                Mobile Money
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Solde actuel (FCFA)</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.balance}
                            onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: 16500"
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

            <ConfirmModal
                isOpen={!!accountToDelete}
                title={`Supprimer ${accountToDelete?.name || ''} ?`}
                message="Ce compte et son solde ne seront plus suivis. Vos ventes et encaissements ne sont pas touchés."
                confirmLabel="Oui, supprimer"
                tone="red"
                isConfirming={isDeleting}
                onConfirm={confirmDelete}
                onCancel={closeDeleteConfirm}
            />
        </div>
    );
};
