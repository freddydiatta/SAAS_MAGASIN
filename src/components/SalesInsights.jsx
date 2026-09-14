import { useMemo, useState } from 'react';
import { Clock, CalendarDays, ShoppingBasket, Receipt, AlertTriangle, PackageX, Lightbulb, Link2, Wallet } from 'lucide-react';
import { computeSalesInsights, PERIODS, RUNNING_OUT_DAYS, MIN_TIMES_TOGETHER } from '../lib/salesInsights';

// Couleurs des graphiques, validées avec le validateur de palette (sur le
// panneau blanc de l'app) : l'orange de la marque pour ce qui compte, un gris
// de mise en retrait pour le contexte. Le gris est volontairement sombre — un
// gris plus clair tombait sous 3:1 de contraste et les colonnes ne se lisaient
// plus. Les deux restent distincts pour les daltoniens (ΔE 13 en deutéranopie).
const EMPHASIS = '#D96645';
const CONTEXT = '#8A94A6';

const Card = ({ icon: Icon, iconClassName, title, hint, children, action }) => (
    <div className="bg-panel rounded-3xl p-6 sm:p-8 shadow-premium border border-slate-100 dark:border-border-theme min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
            <div className="flex items-start gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 ${iconClassName}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-primary">{title}</h3>
                    {hint && <p className="text-xs text-secondary mt-0.5">{hint}</p>}
                </div>
            </div>
            {action}
        </div>
        {children}
    </div>
);

const StatTile = ({ icon: Icon, label, value, detail }) => (
    <div className="bg-panel rounded-2xl p-5 shadow-premium border border-slate-100 dark:border-border-theme min-w-0">
        <div className="flex items-center gap-2 text-secondary text-sm font-medium mb-2">
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-primary truncate">{value}</p>
        {detail && <p className="text-xs text-slate-500 mt-1">{detail}</p>}
    </div>
);

const Segmented = ({ options, value, onChange, ariaLabel }) => (
    <div role="group" aria-label={ariaLabel} className="inline-flex p-1 rounded-xl bg-slate-100 shrink-0">
        {options.map((option) => (
            <button
                key={option.key}
                type="button"
                onClick={() => onChange(option.key)}
                aria-pressed={value === option.key}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${value === option.key
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-secondary hover:text-primary'}`}
            >
                {option.label}
            </button>
        ))}
    </div>
);

/**
 * Colonnes en HTML plutôt qu'avec la librairie de graphiques : les couleurs,
 * la mise en retrait et le survol au doigt se règlent directement, et le
 * rendu tient sur un écran de téléphone sans réglage de taille.
 *
 * Forme « emphase » : une seule colonne en orange (le pic), le reste en gris.
 * L'information utile est « quand », pas la valeur de chaque colonne.
 */
const ColumnChart = ({ columns, showAxisLabel, caption, describe }) => {
    const [active, setActive] = useState(null);
    const max = Math.max(0, ...columns.map((c) => c.value));
    const count = columns.length;
    const firstPeakIndex = max > 0 ? columns.findIndex((c) => c.value === max) : -1;

    return (
        <figure className="min-w-0">
            <figcaption className="text-sm font-semibold text-primary mb-3">{caption}</figcaption>
            {/* La hauteur fixe ne concerne que la zone de tracé : les libellés
                de l'axe sont en dessous, hors de cette hauteur, pour ne jamais
                se retrouver coupés dans un défilement interne. */}
            <div className="relative mt-6 h-32 flex items-end gap-0.5 border-b border-slate-200">
                {max > 0 && <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-slate-100" />}
                {columns.map((column, index) => {
                    const pct = max > 0 ? (column.value / max) * 100 : 0;
                    const isPeak = max > 0 && column.value === max;
                    const isActive = active === index;
                    // Info-bulle recalée sur les bords, pour ne pas sortir de
                    // la carte au-dessus des premières et dernières colonnes.
                    const align = index < 2 ? 'left-0' : index > count - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';

                    return (
                        <div
                            key={column.key}
                            tabIndex={0}
                            aria-label={describe(column)}
                            onPointerEnter={() => setActive(index)}
                            onPointerLeave={() => setActive(null)}
                            onFocus={() => setActive(index)}
                            onBlur={() => setActive(null)}
                            onClick={() => setActive(isActive ? null : index)}
                            className="relative flex-1 h-full flex items-end justify-center outline-none focus-visible:bg-slate-50 rounded-t cursor-default"
                        >
                            {column.value > 0 && (
                                <div
                                    className="w-full max-w-6 rounded-t transition-opacity"
                                    style={{
                                        height: `max(${pct}%, 2px)`,
                                        backgroundColor: isPeak ? EMPHASIS : CONTEXT,
                                        opacity: active === null || isActive ? 1 : 0.55,
                                    }}
                                />
                            )}
                            {index === firstPeakIndex && !isActive && (
                                <span
                                    className={`absolute text-[11px] font-semibold text-primary whitespace-nowrap ${index === 0 ? 'left-0' : index === count - 1 ? 'right-0' : ''}`}
                                    style={{ bottom: `calc(${pct}% + 4px)` }}
                                >
                                    {column.peakLabel}
                                </span>
                            )}
                            {isActive && (
                                <div className={`absolute bottom-full mb-2 z-10 ${align} px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-lg whitespace-nowrap pointer-events-none`}>
                                    <p className="text-sm font-bold text-primary">{column.tooltipValue}</p>
                                    <p className="text-xs text-secondary">{column.tooltipLabel}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div aria-hidden="true" className="flex gap-0.5 mt-1.5">
                {columns.map((column, index) => (
                    <span key={column.key} className={`flex-1 min-w-0 text-center text-[10px] sm:text-xs tabular-nums ${column.unobserved ? 'text-slate-300' : 'text-slate-500'}`}>
                        {showAxisLabel(column, index) ? column.axisLabel : ''}
                    </span>
                ))}
            </div>
            {/* Équivalent en tableau : les valeurs restent lisibles sans survol,
                y compris avec un lecteur d'écran. */}
            <div className="sr-only">
            <table>
                <caption>{caption}</caption>
                <tbody>
                    {columns.map((column) => (
                        <tr key={column.key}>
                            <th scope="row">{column.tooltipLabel}</th>
                            <td>{column.tooltipValue}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </figure>
    );
};

export const SalesInsights = ({ sales, products, isLoading, formatFCFA }) => {
    const [period, setPeriod] = useState('30d');
    const [ranking, setRanking] = useState('quantity');

    const insights = useMemo(
        () => computeSalesInsights({ sales, products, period }),
        [sales, products, period]
    );

    const money = (value) => `${formatFCFA(Math.round(value))} FCFA`;
    const plural = (n, word) => `${n.toLocaleString('fr-FR')} ${word}${n > 1 ? 's' : ''}`;

    // --- Classement des produits ---
    const ranked = (ranking === 'quantity' ? insights.topByQuantity : insights.topByMargin).slice(0, 8);
    const rankValue = (p) => (ranking === 'quantity' ? p.quantity : (p.marginKnown ? p.margin : 0));
    const rankMax = Math.max(0, ...ranked.map(rankValue));

    // --- Heures : plage réellement travaillée, au moins 8 h – 20 h ---
    const hoursWithSales = insights.byHour.filter((h) => h.receipts > 0).map((h) => h.hour);
    const firstHour = Math.min(8, ...hoursWithSales);
    const lastHour = Math.max(20, ...hoursWithSales);
    const hourColumns = insights.byHour.slice(firstHour, lastHour + 1).map((slot) => ({
        key: `h${slot.hour}`,
        value: slot.receipts,
        axisLabel: `${slot.hour}h`,
        peakLabel: plural(slot.receipts, 'vente'),
        tooltipValue: `${plural(slot.receipts, 'vente')} · ${money(slot.revenue)}`,
        tooltipLabel: `Entre ${slot.hour}h et ${(slot.hour + 1) % 24}h`,
    }));

    // --- Jours de la semaine ---
    const weekdayColumns = insights.byWeekday.map((day) => ({
        key: `d${day.weekday}`,
        value: day.averageRevenue,
        axisLabel: day.short,
        unobserved: day.occurrences === 0,
        peakLabel: money(day.averageRevenue),
        tooltipValue: `${money(day.averageRevenue)} en moyenne`,
        tooltipLabel: day.occurrences
            ? `${day.label} (sur ${plural(day.occurrences, day.label.toLowerCase())})`
            : `${day.label} (pas encore sur la période)`,
    }));

    const hasSales = insights.receiptsCount > 0;
    const loading = isLoading ? 'opacity-60' : '';

    return (
        <section className={`space-y-4 transition-opacity ${loading}`} aria-labelledby="sales-insights-title">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h2 id="sales-insights-title" className="text-xl font-bold text-primary">Les habitudes de vos clients</h2>
                    <p className="text-sm text-secondary">Quand ils viennent, ce qu'ils achètent, ce qu'ils prennent ensemble et comment ils paient.</p>
                </div>
                {/* Un seul filtre, au-dessus de tout ce qu'il concerne : tous
                    les chiffres de la section portent sur la même période. */}
                <Segmented options={PERIODS} value={period} onChange={setPeriod} ariaLabel="Période analysée" />
            </div>

            {hasSales && insights.daysCovered < 7 && (
                <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
                    <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>
                        Seulement {plural(insights.daysCovered, 'jour')} de ventes enregistrées : ces tendances s'affineront au fil des semaines.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile
                    icon={Receipt}
                    label="Ventes"
                    value={insights.receiptsCount.toLocaleString('fr-FR')}
                    detail={`sur ${plural(insights.daysCovered, 'jour')}`}
                />
                <StatTile
                    icon={ShoppingBasket}
                    label="Panier moyen"
                    value={hasSales ? money(insights.averageBasket) : '—'}
                    detail={hasSales ? `${insights.itemsPerSale.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} article(s) par vente` : null}
                />
                <StatTile
                    icon={Clock}
                    label="Heure de pointe"
                    value={insights.peakHour ? `${insights.peakHour.hour}h – ${(insights.peakHour.hour + 1) % 24}h` : '—'}
                    detail={insights.peakHour
                        ? [plural(insights.peakHour.receipts, 'vente'),
                            ...(insights.peakHours.length > 1
                                ? [`autant à ${insights.peakHours.slice(1).map((h) => `${h.hour}h`).join(', ')}`]
                                : [])].join(' · ')
                        : null}
                />
                <StatTile
                    icon={CalendarDays}
                    label="Meilleur jour"
                    value={insights.bestWeekday ? insights.bestWeekday.label : '—'}
                    detail={insights.bestWeekday ? `${money(insights.bestWeekday.averageRevenue)} en moyenne` : null}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card
                    icon={Clock}
                    iconClassName="text-blue-500"
                    title="Quand vos clients viennent"
                    hint="Pour savoir quand être au comptoir et quand réapprovisionner les rayons."
                >
                    {!hasSales ? (
                        <p className="text-sm text-secondary py-6 text-center">Aucune vente sur cette période.</p>
                    ) : (
                        <div className="space-y-8">
                            <ColumnChart
                                caption="Ventes par heure"
                                columns={hourColumns}
                                showAxisLabel={(column, index) => index % 3 === 0}
                                describe={(column) => `${column.tooltipLabel} : ${column.tooltipValue}`}
                            />
                            <ColumnChart
                                caption="Chiffre d'affaires moyen par jour de la semaine"
                                columns={weekdayColumns}
                                showAxisLabel={() => true}
                                describe={(column) => `${column.tooltipLabel} : ${column.tooltipValue}`}
                            />
                        </div>
                    )}
                </Card>

                <Card
                    icon={ShoppingBasket}
                    iconClassName="text-accent"
                    title="Produits les plus vendus"
                    hint={ranking === 'quantity'
                        ? 'Ce qui part le plus. Passez en « Marge » pour voir ce qui rapporte vraiment.'
                        : 'Ce qui rapporte le plus, une fois la marchandise payée.'}
                    action={(
                        <Segmented
                            options={[{ key: 'quantity', label: 'Quantité' }, { key: 'margin', label: 'Marge' }]}
                            value={ranking}
                            onChange={setRanking}
                            ariaLabel="Classer les produits par"
                        />
                    )}
                >
                    {ranked.length === 0 ? (
                        <p className="text-sm text-secondary py-6 text-center">Aucune vente sur cette période.</p>
                    ) : (
                        <ol className="space-y-3">
                            {ranked.map((product) => {
                                const value = rankValue(product);
                                const width = rankMax > 0 ? (value / rankMax) * 100 : 0;
                                const unknownMargin = ranking === 'margin' && !product.marginKnown;
                                return (
                                    <li key={product.productId || product.name}>
                                        <div className="flex items-baseline justify-between gap-3 text-sm">
                                            <span className="font-medium text-primary truncate">{product.name}</span>
                                            <span className="font-semibold text-primary whitespace-nowrap tabular-nums">
                                                {ranking === 'quantity'
                                                    ? plural(product.quantity, 'vendu')
                                                    : (unknownMargin ? 'marge inconnue' : money(product.margin))}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-2">
                                            {width > 0 && (
                                                <div
                                                    className="h-2 rounded-r"
                                                    style={{ width: `max(${width}%, 4px)`, backgroundColor: EMPHASIS }}
                                                />
                                            )}
                                        </div>
                                        {/* L'autre mesure en second : c'est l'écart entre
                                            les deux qui fait décider (beaucoup vendu, peu
                                            rapporté). */}
                                        <p className="text-xs text-slate-500 mt-1">
                                            {ranking === 'quantity'
                                                ? (product.marginKnown ? `Marge ${money(product.margin)}` : 'Marge inconnue (prix d\'achat manquant)')
                                                : `${plural(product.quantity, 'vendu')} · ${money(product.revenue)} de ventes`}
                                        </p>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </Card>

                <Card
                    icon={Link2}
                    iconClassName="text-emerald-600"
                    title="Souvent achetés ensemble"
                    hint="Rangez-les côte à côte, ou proposez-les en lot."
                >
                    {insights.boughtTogether.length === 0 ? (
                        <p className="text-sm text-secondary py-6 text-center">
                            {insights.multiItemSales === 0
                                ? "Pour l'instant, chaque client repart avec un seul produit."
                                : `Pas encore d'habitude : il faut qu'une même paire revienne au moins ${MIN_TIMES_TOGETHER} fois (${plural(insights.multiItemSales, 'vente')} à plusieurs produits jusqu'ici).`}
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {insights.boughtTogether.slice(0, 6).map((pair) => (
                                <li key={pair.names.join('|')} className="flex items-center justify-between gap-3 py-2.5">
                                    <p className="text-sm font-medium text-primary min-w-0">
                                        {pair.names[0]} <span className="text-slate-400">+</span> {pair.names[1]}
                                    </p>
                                    <span className="text-xs text-slate-500 whitespace-nowrap">
                                        ensemble dans {plural(pair.times, 'vente')}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card
                    icon={Wallet}
                    iconClassName="text-blue-500"
                    title="Comment ils paient"
                    hint="Pour prévoir la monnaie en caisse, et voir quel moyen attire les plus gros paniers."
                >
                    {insights.paymentMix.length === 0 ? (
                        <p className="text-sm text-secondary py-6 text-center">Aucune vente sur cette période.</p>
                    ) : (
                        <ul className="space-y-3">
                            {insights.paymentMix.map((entry) => (
                                <li key={entry.method}>
                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="font-medium text-primary">{entry.label}</span>
                                        <span className="font-semibold text-primary whitespace-nowrap tabular-nums">
                                            {Math.round(entry.share * 100)}&nbsp;%
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-2">
                                        <div
                                            className="h-2 rounded-r"
                                            style={{ width: `max(${entry.share * 100}%, 4px)`, backgroundColor: EMPHASIS }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {plural(entry.receipts, 'vente')} · panier moyen {money(entry.averageBasket)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card
                    icon={AlertTriangle}
                    iconClassName="text-amber-500"
                    title="Bientôt en rupture"
                    hint={`Au rythme ${insights.daysCovered > 1 ? `des ${insights.daysCovered} derniers jours` : 'du dernier jour'} de ventes, il en reste pour moins de ${RUNNING_OUT_DAYS} jours.`}
                >
                    {insights.runningOut.length === 0 ? (
                        <p className="text-sm text-secondary py-6 text-center">
                            Aucun produit ne risque de manquer cette semaine.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {insights.runningOut.slice(0, 8).map((product) => (
                                <li key={product.productId} className="flex items-center justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-primary truncate">{product.name}</p>
                                        <p className="text-xs text-slate-500">
                                            Reste {product.stock.toLocaleString('fr-FR')} · se vend {product.perDay.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} par jour
                                        </p>
                                    </div>
                                    <span className={`text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded-full ${product.stock === 0
                                        ? 'bg-red-50 text-red-700'
                                        : 'bg-amber-50 text-amber-800'}`}
                                    >
                                        {product.stock === 0
                                            ? 'En rupture'
                                            : `≈ ${plural(Math.max(1, Math.floor(product.daysLeft)), 'jour')}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card
                    icon={PackageX}
                    iconClassName="text-slate-500"
                    title="Stock qui dort"
                    hint={period === 'all'
                        ? 'En stock mais jamais vendus : de l\'argent immobilisé sur l\'étagère.'
                        : 'En stock mais pas vendus sur la période : de l\'argent immobilisé sur l\'étagère.'}
                >
                    {insights.sleepingStock.length === 0 ? (
                        <p className="text-sm text-secondary py-6 text-center">Tout votre stock tourne sur cette période.</p>
                    ) : (
                        <>
                            <p className="text-sm text-secondary mb-3">
                                <span className="text-lg font-bold text-primary">{money(insights.sleepingValue)}</span>
                                {' '}bloqués dans {plural(insights.sleepingStock.length, 'produit')}.
                                {' '}Une promotion les ferait tourner ; sinon, inutile d'en recommander.
                            </p>
                            <ul className="divide-y divide-slate-100">
                                {insights.sleepingStock.slice(0, 6).map((product) => (
                                    <li key={product.productId} className="flex items-center justify-between gap-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-primary truncate">{product.name}</p>
                                            <p className="text-xs text-slate-500">{plural(product.stock, 'unité')} en stock</p>
                                        </div>
                                        <span className="text-sm font-semibold text-primary whitespace-nowrap tabular-nums">
                                            {product.tiedUp === null ? 'prix d\'achat ?' : money(product.tiedUp)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {insights.sleepingStock.length > 6 && (
                                <p className="text-xs text-slate-500 mt-2">
                                    Et {insights.sleepingStock.length - 6} autre{insights.sleepingStock.length - 6 > 1 ? 's' : ''} produit{insights.sleepingStock.length - 6 > 1 ? 's' : ''}.
                                </p>
                            )}
                        </>
                    )}
                </Card>
            </div>
        </section>
    );
};
