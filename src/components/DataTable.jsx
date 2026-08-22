// Tableau partagé : la structure <table><thead><tr><th>.../<tbody><tr><td>
// (avec ses états chargement/vide) était réimplémentée à la main dans une
// demi-douzaine de pages. Centralisé ici ; chaque colonne reste responsable
// de son propre rendu de cellule (badges, icônes, logique métier), donc le
// style visuel de chaque tableau existant est préservé via les className
// passées en props plutôt qu'imposé par ce composant.
export const DataTable = ({
    columns,
    data,
    keyField = 'id',
    isLoading = false,
    loadingContent = 'Chargement...',
    emptyContent = 'Aucune donnée.',
    wrapperClassName = 'overflow-x-auto',
    tableClassName = 'w-full text-left border-collapse',
    theadClassName = '',
    headerRowClassName = 'border-b border-slate-100 dark:border-border-theme',
    tbodyClassName = 'divide-y divide-slate-100 dark:divide-border-theme',
    getRowClassName = () => 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group',
    stateCellClassName = 'px-6 py-12 text-center text-secondary',
}) => {
    const colCount = columns.length;

    return (
        <div className={wrapperClassName}>
            <table className={tableClassName}>
                <thead className={theadClassName}>
                    <tr className={headerRowClassName}>
                        {columns.map((col) => (
                            <th key={col.key} className={col.headerClassName}>{col.header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className={tbodyClassName}>
                    {isLoading ? (
                        <tr>
                            <td colSpan={colCount} className={stateCellClassName}>{loadingContent}</td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={colCount} className={stateCellClassName}>{emptyContent}</td>
                        </tr>
                    ) : (
                        data.map((row) => (
                            <tr
                                key={row[keyField]}
                                className={typeof getRowClassName === 'function' ? getRowClassName(row) : getRowClassName}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} className={col.cellClassName}>{col.render(row)}</td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};
