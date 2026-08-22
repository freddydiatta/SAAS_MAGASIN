// Pastille de statut colorée : le même bloc (couleur de fond/texte selon un
// statut, pilule arrondie) était recopié à la main dans Commandes.jsx,
// RestaurantDashboard.jsx, Reservations.jsx, Villas.jsx, VillaDashboard.jsx,
// AffiliateDashboard.jsx, Motos.jsx, Calendrier.jsx et HistoriqueVentes.jsx —
// chacun avec de légères variations de nuance (700 vs 600, /20 vs /10 en
// mode sombre) issues du copier-coller plutôt que d'un choix voulu.
// Centralise la palette de couleurs ; padding/taille de texte restent
// passables via className puisqu'ils varient légitimement selon la densité
// de chaque tableau/carte.
const TONES = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

export const StatusBadge = ({
    label,
    tone = 'slate',
    rounded = 'full',
    uppercase = false,
    bold = true,
    className = 'px-3 py-1 text-xs',
    ...rest
}) => (
    <span
        className={`inline-flex items-center ${bold ? 'font-bold' : 'font-medium'} ${rounded === 'full' ? 'rounded-full' : 'rounded'} ${uppercase ? 'uppercase tracking-wider' : ''} ${TONES[tone] || TONES.slate} ${className}`}
        {...rest}
    >
        {label}
    </span>
);
