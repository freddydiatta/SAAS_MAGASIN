import { useBusiness } from '../../contexts/BusinessContext';
import { useFournisseurs } from '../../hooks/useFournisseurs';
import { Modal } from '../../components/Modal';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { CreatePurchaseOrderModal } from '../../components/CreatePurchaseOrderModal';
import { PurchaseOrderPrint } from '../../components/PurchaseOrderPrint';
import { Plus, Trash2, Truck, PackageCheck, XCircle, Printer } from 'lucide-react';

const ORDER_STATUS = {
    pending: { label: 'En attente', tone: 'amber' },
    received: { label: 'Reçu', tone: 'emerald' },
    cancelled: { label: 'Annulé', tone: 'red' },
};

export const Fournisseurs = () => {
    const { selectedBusiness } = useBusiness();
    const {
        suppliers, isLoadingSuppliers,
        isAddSupplierOpen, openAddSupplierForm, closeSupplierForm,
        supplierForm, setSupplierForm, handleSupplierSubmit, handleDeleteSupplier, isSavingSupplier,
        purchaseOrders, isLoadingOrders,
        isCreateOrderOpen, openCreateOrderForm, closeCreateOrderForm,
        handleCreateOrder, handleReceiveOrder, handleCancelOrder, isSavingOrder,
        orderToPrint, setOrderToPrint, handlePrintOrder,
    } = useFournisseurs(selectedBusiness);

    const supplierColumns = [
        {
            key: 'name',
            header: 'Nom',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 font-bold text-primary',
            render: (supplier) => supplier.name,
        },
        {
            key: 'contact',
            header: 'Contact',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 text-secondary text-sm',
            render: (supplier) => supplier.contact_name || '—',
        },
        {
            key: 'phone',
            header: 'Téléphone',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 text-secondary text-sm',
            render: (supplier) => supplier.phone || '—',
        },
        {
            key: 'email',
            header: 'Email',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 text-secondary text-sm',
            render: (supplier) => supplier.email || '—',
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'py-4 px-6',
            cellClassName: 'py-4 px-6 text-right',
            render: (supplier) => (
                <button
                    onClick={() => handleDeleteSupplier(supplier)}
                    aria-label="Supprimer le fournisseur"
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            ),
        },
    ];

    const orderColumns = [
        {
            key: 'date',
            header: 'Date',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6 text-secondary text-sm',
            render: (order) => new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        },
        {
            key: 'supplier',
            header: 'Fournisseur',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 font-bold text-primary',
            render: (order) => order.supplier?.name || '—',
        },
        {
            key: 'items',
            header: 'Articles',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 text-secondary text-sm',
            render: (order) => (order.items || []).map((item) => `${item.product_name} ×${item.quantity}`).join(', '),
        },
        {
            key: 'total',
            header: 'Total',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right',
            cellClassName: 'px-6 py-4 text-right font-bold text-primary',
            render: (order) => `${Number(order.total_amount).toLocaleString('fr-FR')} F`,
        },
        {
            key: 'status',
            header: 'Statut',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-center',
            cellClassName: 'px-6 py-4 text-center',
            render: (order) => {
                const status = ORDER_STATUS[order.status] || ORDER_STATUS.pending;
                return <StatusBadge label={status.label} tone={status.tone} />;
            },
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'py-4 px-6',
            cellClassName: 'py-4 px-6 text-right',
            render: (order) => (
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => handlePrintOrder(order)}
                        title="Voir / imprimer le bon de commande"
                        className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                    </button>
                    {order.status === 'pending' && (
                        <>
                            <button
                                onClick={() => handleReceiveOrder(order)}
                                title="Marquer comme reçu (met à jour le stock)"
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            >
                                <PackageCheck className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleCancelOrder(order)}
                                title="Annuler"
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Fournisseurs</h1>
                    <p className="text-secondary text-sm">Vos fournisseurs et vos bons de réapprovisionnement.</p>
                </div>
            </div>

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-border-theme flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                            <Truck className="w-5 h-5" />
                        </div>
                        <h2 className="font-bold text-primary">Fournisseurs</h2>
                    </div>
                    <button
                        onClick={openAddSupplierForm}
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-premium text-sm shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Nouveau fournisseur
                    </button>
                </div>
                <DataTable
                    columns={supplierColumns}
                    data={suppliers}
                    isLoading={isLoadingSuppliers}
                    emptyContent="Aucun fournisseur pour le moment."
                />
            </div>

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-border-theme flex justify-between items-center">
                    <h2 className="font-bold text-primary">Bons de commande</h2>
                    <button
                        onClick={openCreateOrderForm}
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-premium text-sm shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Nouveau bon de commande
                    </button>
                </div>
                <DataTable
                    columns={orderColumns}
                    data={purchaseOrders}
                    isLoading={isLoadingOrders}
                    emptyContent="Aucun bon de commande pour le moment."
                />
            </div>

            <Modal isOpen={isAddSupplierOpen} onClose={closeSupplierForm} title="Nouveau fournisseur" maxWidth="max-w-sm">
                <form onSubmit={handleSupplierSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Nom</label>
                        <input
                            type="text"
                            required
                            value={supplierForm.name}
                            onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: Moto Pièces Import"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Contact (optionnel)</label>
                        <input
                            type="text"
                            value={supplierForm.contactName}
                            onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: Moussa"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Téléphone (optionnel)</label>
                        <input
                            type="text"
                            value={supplierForm.phone}
                            onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: 77 123 45 67"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Email (optionnel)</label>
                        <input
                            type="email"
                            value={supplierForm.email}
                            onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: contact@fournisseur.com"
                        />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={closeSupplierForm} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                            Annuler
                        </button>
                        <button type="submit" disabled={isSavingSupplier} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover shadow-md transition-all disabled:opacity-50">
                            {isSavingSupplier ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>

            <CreatePurchaseOrderModal
                isOpen={isCreateOrderOpen}
                onClose={closeCreateOrderForm}
                onSubmit={handleCreateOrder}
                isSaving={isSavingOrder}
                suppliers={suppliers}
            />

            {orderToPrint && (
                <PurchaseOrderPrint
                    orderDetails={orderToPrint}
                    business={selectedBusiness}
                    onClose={() => setOrderToPrint(null)}
                />
            )}
        </div>
    );
};
