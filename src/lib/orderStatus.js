// Libellé + couleur du badge de statut des commandes restaurant : dupliqué
// à l'identique dans Commandes.jsx (STATUS_BADGE) et RestaurantDashboard.jsx
// (STATUS_LABELS) avant. Les deux pages partagent maintenant cette config.
export const ORDER_STATUS = {
    pending: { label: 'En attente', tone: 'amber' },
    served: { label: 'Servie', tone: 'blue' },
    paid: { label: 'Payée', tone: 'emerald' },
    cancelled: { label: 'Annulée', tone: 'red' },
};
