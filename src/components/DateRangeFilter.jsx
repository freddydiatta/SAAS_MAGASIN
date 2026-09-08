import { Calendar } from 'lucide-react';

// Pilules de filtre par date, partagées entre Historique des ventes et
// Sécurité (logs d'audit) — même préréglages, même logique (voir
// src/lib/dateFilter.js), pour ne pas retrouver deux implémentations
// légèrement différentes au fil du temps.
const PRESETS = [
    { value: 'all', label: 'Tout' },
    { value: '7d', label: '7 jours' },
    { value: '30d', label: '30 jours' },
];

export const DateRangeFilter = ({ value, onChange, customFrom, customTo, onCustomFromChange, onCustomToChange }) => {
    const pillClass = (isActive) =>
        `px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
            isActive
                ? 'bg-accent text-white border-accent'
                : 'border-slate-200 dark:border-border-theme text-secondary hover:bg-slate-50 dark:hover:bg-slate-800'
        }`;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((preset) => (
                <button
                    key={preset.value}
                    type="button"
                    onClick={() => onChange(preset.value)}
                    className={pillClass(value === preset.value)}
                >
                    {preset.label}
                </button>
            ))}
            <button
                type="button"
                onClick={() => onChange('custom')}
                className={`${pillClass(value === 'custom')} flex items-center gap-2`}
            >
                Période <Calendar className="w-4 h-4" />
            </button>
            {value === 'custom' && (
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => onCustomFromChange(e.target.value)}
                        aria-label="Date de début"
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-border-theme text-sm bg-surface text-primary"
                    />
                    <span className="text-secondary text-sm">→</span>
                    <input
                        type="date"
                        value={customTo}
                        onChange={(e) => onCustomToChange(e.target.value)}
                        aria-label="Date de fin"
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-border-theme text-sm bg-surface text-primary"
                    />
                </div>
            )}
        </div>
    );
};
