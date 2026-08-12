export const Dashboard = () => {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Aperçu du Jour</h1>
                    <p className="text-secondary text-sm">Mardi, 12 Août 2026</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-secondary px-5 py-2.5 text-sm">Ouvrir la caisse</button>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1 */}
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl mb-4">
                        💵
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Caisse du Jour</p>
                    <p className="text-3xl font-bold text-primary mb-2">345 000 <span className="text-lg text-secondary font-medium">FCFA</span></p>
                    <p className="text-emerald-600 font-medium text-xs flex items-center gap-1">
                        <span className="bg-emerald-100 rounded-full px-1.5 py-0.5">↑ 12%</span> par rapport à hier
                    </p>
                </div>

                {/* KPI 2 */}
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl mb-4">
                        🏍️
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Motos Vendues</p>
                    <p className="text-3xl font-bold text-primary mb-2">2</p>
                    <p className="text-secondary font-medium text-xs">Stock restant: 14</p>
                </div>

                {/* KPI 3 */}
                <div className="bg-white rounded-2xl p-6 shadow-premium relative border-t-4 border-amber-500">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-2xl mb-4">
                        ⚠️
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Alertes Stock</p>
                    <p className="text-3xl font-bold text-primary mb-2">5</p>
                    <p className="text-secondary font-medium text-xs">Articles à recommander</p>
                </div>

                {/* KPI 4 */}
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl mb-4">
                        🏠
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Villas Louées</p>
                    <p className="text-3xl font-bold text-primary mb-2">3 / 5</p>
                    <p className="text-secondary font-medium text-xs">Cette semaine</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Dernières Transactions */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-premium overflow-hidden">
                    <div className="flex justify-between items-center p-6 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-primary">Dernières Ventes</h2>
                        <button className="text-accent font-medium text-sm hover:text-accentHover transition-colors">Tout voir</button>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="py-3 px-6 text-xs font-semibold text-secondary uppercase tracking-wider">Heure</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-secondary uppercase tracking-wider">Article</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-secondary uppercase tracking-wider">Qté</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Montant</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[
                                    { time: '10:42', name: 'Casque intégral noir (L)', qty: 1, amount: '25 000 FCFA', type: 'piece' },
                                    { time: '09:15', name: 'Moto Haojue 115', qty: 1, amount: '450 000 FCFA', type: 'moto' },
                                    { time: '08:30', name: 'Plaquettes de frein av.', qty: 2, amount: '12 000 FCFA', type: 'piece' },
                                    { time: 'Hier', name: 'Location Villa Almadies (2j)', qty: 1, amount: '100 000 FCFA', type: 'villa' }
                                ].map((tx, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6 text-sm text-secondary">{tx.time}</td>
                                        <td className="py-4 px-6 text-sm font-medium text-primary">
                                            <span className="flex items-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${
                                                    tx.type === 'moto' ? 'bg-blue-500' : tx.type === 'villa' ? 'bg-indigo-500' : 'bg-emerald-500'
                                                }`}></span>
                                                {tx.name}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-secondary">{tx.qty}</td>
                                        <td className="py-4 px-6 text-sm font-bold text-primary text-right">{tx.amount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Alertes Action Réactions */}
                <div className="bg-white rounded-2xl shadow-premium flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <h2 className="text-lg font-bold text-primary">Actions Requises</h2>
                    </div>

                    <div className="p-6 space-y-4 flex-1 bg-slate-50/50">
                        <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500"></div>
                            <p className="font-bold text-primary text-sm mb-1">Rupture Critique</p>
                            <p className="text-secondary text-xs mb-3">Pneus Michelin 17" (Reste 1)</p>
                            <button className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">Recommander</button>
                        </div>
                        
                        <div className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-400"></div>
                            <p className="font-bold text-primary text-sm mb-1">Check-out Villa</p>
                            <p className="text-secondary text-xs mb-3">Villa Saly N°3 sort aujourd'hui à 12h.</p>
                            <button className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">Marquer libérée</button>
                        </div>
                    </div>

                    <div className="p-6 bg-white border-t border-slate-100">
                        <button className="btn-secondary w-full py-2.5 text-sm text-center">
                            Générer Rapport
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
};
