import { useBusiness } from '../../contexts/BusinessContext';
import { useReservations } from '../../hooks/useReservations';
import { Plus, X, Calendar, Home, Users, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Modal } from '../../components/Modal';
import { DataTable } from '../../components/DataTable';

export const Reservations = () => {
    const { selectedBusiness } = useBusiness();

    const {
        villas,
        bookings,
        isLoading,
        formData,
        setFormData,
        isAddOpen,
        openAddForm,
        closeForm,
        editingBooking,
        getCalculatedPrice,
        handleSubmit,
        handleEdit,
        handleDelete,
        isSaving,
    } = useReservations(selectedBusiness);

    const columns = [
        {
            key: 'client',
            header: 'Client',
            headerClassName: 'px-6 py-4 font-semibold',
            cellClassName: 'px-6 py-4',
            render: (booking) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-slate-500" />
                    </div>
                    <span className="font-bold text-primary group-hover:text-accent transition-colors">{booking.customer_name}</span>
                </div>
            ),
        },
        {
            key: 'villa',
            header: 'Villa',
            headerClassName: 'px-6 py-4 font-semibold',
            cellClassName: 'px-6 py-4 text-secondary font-medium',
            render: (booking) => (
                <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-indigo-500" /> {booking.villas?.name || 'Villa Inconnue'}
                </div>
            ),
        },
        {
            key: 'period',
            header: 'Période',
            headerClassName: 'px-6 py-4 font-semibold',
            cellClassName: 'px-6 py-4 text-secondary text-sm',
            render: (booking) => (
                <>
                    Du <span className="font-medium text-primary">{new Date(booking.start_date).toLocaleDateString('fr-FR')}</span> <br/>
                    Au <span className="font-medium text-primary">{new Date(booking.end_date).toLocaleDateString('fr-FR')}</span>
                </>
            ),
        },
        {
            key: 'total',
            header: 'Montant Total',
            headerClassName: 'px-6 py-4 font-semibold',
            cellClassName: 'px-6 py-4 font-bold text-accent',
            render: (booking) => `${booking.total_price.toLocaleString('fr-FR')} F`,
        },
        {
            key: 'status',
            header: 'Statut',
            headerClassName: 'px-6 py-4 font-semibold text-center',
            cellClassName: 'px-6 py-4 text-center',
            render: (booking) => (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    booking.status === 'confirmed' || booking.status === 'confirmé' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                    booking.status === 'provisoire' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'
                }`}>
                    {booking.status === 'confirmed' ? 'Confirmé' : booking.status}
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            headerClassName: 'px-6 py-4 font-semibold text-center',
            cellClassName: 'px-6 py-4 text-center',
            render: (booking) => (
                <div className="flex justify-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(booking); }}
                        className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        title="Modifier"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(booking); }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Supprimer"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Réservations</h1>
                    <p className="text-secondary text-sm">Gérez les réservations de vos locataires.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={openAddForm}
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-premium"
                    >
                        <Plus className="w-5 h-5" /> Nouvelle Réservation
                    </button>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-panel rounded-3xl shadow-premium overflow-hidden border border-slate-100 dark:border-border-theme"
            >
                <DataTable
                    columns={columns}
                    data={bookings}
                    isLoading={isLoading}
                    loadingContent={
                        <div className="flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
                        </div>
                    }
                    emptyContent={
                        <>
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-secondary font-medium">Aucune réservation trouvée.</p>
                        </>
                    }
                    headerRowClassName="bg-slate-50/50 dark:bg-slate-800/30 text-secondary text-xs uppercase tracking-wider border-b border-slate-100 dark:border-border-theme"
                    stateCellClassName="px-6 py-16 text-center"
                />
            </motion.div>

            {/* Modal for adding a Booking */}
            <Modal
                isOpen={isAddOpen}
                onClose={closeForm}
                panelClassName="bg-panel rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-border-theme"
            >
                <div className="px-6 py-4 border-b border-slate-100 dark:border-border-theme flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <h2 className="text-xl font-bold text-primary">
                        {editingBooking ? 'Modifier la réservation' : 'Nouvelle Réservation'}
                    </h2>
                    <button onClick={closeForm} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-primary mb-1">Villa</label>
                        <select
                            required
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                            value={formData.villa_id}
                            onChange={e => setFormData({...formData, villa_id: e.target.value})}
                        >
                            <option value="">Sélectionnez une villa</option>
                            {villas.map(v => (
                                <option key={v.id} value={v.id}>{v.name} ({v.price_per_night.toLocaleString()} F/nuit)</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-primary mb-1">Nom du Client</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                            placeholder="Ex: M. Dupont"
                            value={formData.customer_name}
                            onChange={e => setFormData({...formData, customer_name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-primary mb-1">Arrivée</label>
                            <input
                                type="date"
                                required
                                className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                                value={formData.start_date}
                                onChange={e => setFormData({...formData, start_date: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary mb-1">Départ</label>
                            <input
                                type="date"
                                required
                                className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                                value={formData.end_date}
                                onChange={e => setFormData({...formData, end_date: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-primary mb-1">Statut</label>
                        <select
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                            value={formData.status}
                            onChange={e => setFormData({...formData, status: e.target.value})}
                        >
                            <option value="provisoire">Provisoire</option>
                            <option value="confirmé">Confirmé</option>
                            <option value="annulé">Annulé</option>
                        </select>
                    </div>

                    {formData.villa_id && formData.start_date && formData.end_date && (
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl mt-4 border border-indigo-100 dark:border-indigo-500/20">
                            <div className="flex justify-between items-center text-indigo-900 dark:text-indigo-400">
                                <span className="font-medium text-sm">Total Estimé:</span>
                                <span className="text-xl font-bold">{getCalculatedPrice().toLocaleString('fr-FR')} F</span>
                            </div>
                        </div>
                    )}

                    <div className="pt-4">
                        <button type="submit" disabled={isSaving} className="btn-primary w-full py-3 text-base shadow-premium">
                            {isSaving ? 'Confirmation...' : (editingBooking ? 'Enregistrer les modifications' : 'Confirmer la réservation')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
