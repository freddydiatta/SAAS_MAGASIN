import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';

export const RestaurantDashboard = () => {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Aperçu Service (Restaurant)</h1>
                    <p className="text-secondary text-sm">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-primary px-5 py-2.5 text-sm">+ Nouvelle Commande</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-2xl mb-4">🍽️</div>
                    <p className="text-secondary text-sm font-medium mb-1">Commandes en cours</p>
                    <p className="text-3xl font-bold text-primary mb-2">0</p>
                </div>
                
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl mb-4">💵</div>
                    <p className="text-secondary text-sm font-medium mb-1">Caisse du jour</p>
                    <p className="text-3xl font-bold text-primary mb-2">0 FCFA</p>
                </div>
            </div>
        </div>
    );
};
