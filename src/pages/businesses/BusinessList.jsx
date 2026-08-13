import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { supabase } from '../../lib/supabase';
import { IconCheck } from '../../components/icons';

const BUSINESS_TYPES = [
    { id: 'pieces_moto', name: 'Pièces Moto', icon: '🏍️' },
    { id: 'villa', name: 'Gestion de Villa', icon: '🏠' },
    { id: 'quincaillerie', name: 'Quincaillerie', icon: '🔨' },
    { id: 'boutique', name: 'Boutique / Vente', icon: '🛒' },
    { id: 'restaurant', name: 'Restaurant / Fast-food', icon: '🍔' }
];

export const BusinessList = () => {
    const { user } = useAuth();
    const { businesses, selectBusiness, loading, refreshBusinesses } = useBusiness();
    const navigate = useNavigate();
    
    const [isCreating, setIsCreating] = useState(false);
    const [newBusinessName, setNewBusinessName] = useState('');
    const [newBusinessType, setNewBusinessType] = useState('pieces_moto');
    const [newBusinessPhone, setNewBusinessPhone] = useState('');
    const [newBusinessAddress, setNewBusinessAddress] = useState('');
    const [createError, setCreateError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Si on a l'abonnement essentiel, on a le droit qu'à 1 magasin.
    // user_metadata est accessible via user.user_metadata
    const plan = user?.user_metadata?.subscription_plan || 'essentiel';
    const canCreateMore = plan === 'business' || businesses.length === 0;

    const handleCreateBusiness = async (e) => {
        e.preventDefault();
        setCreateError('');
        setIsSubmitting(true);

        try {
            const { data, error } = await supabase
                .from('businesses')
                .insert([
                    {
                        user_id: user.id,
                        name: newBusinessName,
                        type: newBusinessType,
                        phone: newBusinessPhone,
                        address: newBusinessAddress,
                        subscription_plan: plan
                    }
                ])
                .select();

            if (error) throw error;

            await refreshBusinesses();
            setIsCreating(false);
            setNewBusinessName('');
            setNewBusinessPhone('');
            setNewBusinessAddress('');
            
            // Select the newly created business and go to dashboard
            if (data && data.length > 0) {
                selectBusiness(data[0]);
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('Error creating business:', error);
            setCreateError(error.message || 'Une erreur est survenue lors de la création.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSelectBusiness = (business) => {
        selectBusiness(business);
        navigate('/dashboard');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-primary mb-4">Vos Magasins et Entreprises</h1>
                    <p className="text-secondary">
                        {plan === 'essentiel' 
                            ? "Abonnement Essentiel : Vous pouvez gérer un seul magasin."
                            : "Abonnement Business : Vous pouvez gérer plusieurs magasins."}
                    </p>
                </div>

                {/* Liste des magasins */}
                {businesses.length > 0 && !isCreating && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        {businesses.map((business) => (
                            <div 
                                key={business.id} 
                                onClick={() => handleSelectBusiness(business)}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-accent cursor-pointer transition-all flex flex-col items-center text-center group"
                            >
                                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                                    {BUSINESS_TYPES.find(t => t.id === business.type)?.icon || '🏢'}
                                </div>
                                <h3 className="text-xl font-bold text-primary mb-2">{business.name}</h3>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                    {BUSINESS_TYPES.find(t => t.id === business.type)?.name || business.type}
                                </span>
                                
                                <button className="mt-6 text-sm text-accent font-medium group-hover:underline">
                                    Accéder au tableau de bord &rarr;
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Formulaire de création */}
                {(businesses.length === 0 || isCreating) ? (
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 max-w-2xl mx-auto">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-primary mb-2">
                                {businesses.length === 0 ? "Créer votre premier magasin" : "Créer un nouveau magasin"}
                            </h2>
                            <p className="text-secondary">Configurez les informations de base de votre activité.</p>
                        </div>

                        {createError && (
                            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                                {createError}
                            </div>
                        )}

                        <form onSubmit={handleCreateBusiness} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-primary mb-2">
                                    Nom de l'entreprise
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newBusinessName}
                                    onChange={(e) => setNewBusinessName(e.target.value)}
                                    className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="Ex: Ma Super Boutique"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-primary mb-2">
                                    Type d'activité
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {BUSINESS_TYPES.map((type) => (
                                        <div
                                            key={type.id}
                                            onClick={() => setNewBusinessType(type.id)}
                                            className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                                newBusinessType === type.id
                                                    ? 'border-accent bg-accent/5'
                                                    : 'border-slate-200 hover:border-accent/30'
                                            }`}
                                        >
                                            <span className="text-2xl">{type.icon}</span>
                                            <span className={`font-medium ${newBusinessType === type.id ? 'text-accent' : 'text-primary'}`}>
                                                {type.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-primary mb-2">
                                    Numéro de téléphone
                                </label>
                                <input
                                    type="text"
                                    value={newBusinessPhone}
                                    onChange={(e) => setNewBusinessPhone(e.target.value)}
                                    className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="Ex: +221 77 123 45 67"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-primary mb-2">
                                    Adresse
                                </label>
                                <input
                                    type="text"
                                    value={newBusinessAddress}
                                    onChange={(e) => setNewBusinessAddress(e.target.value)}
                                    className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="Ex: Dakar, Point E"
                                />
                            </div>

                            <div className="pt-4 flex gap-4">
                                {businesses.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-primary font-semibold rounded-xl transition-all"
                                    >
                                        Annuler
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newBusinessName.trim()}
                                    className="flex-[2] py-3 px-4 bg-accent hover:bg-accentHover text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 flex justify-center items-center"
                                >
                                    {isSubmitting ? 'Création...' : 'Créer et continuer'}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    /* Bouton pour ouvrir le formulaire si on a le droit */
                    canCreateMore && !isCreating && (
                        <div className="text-center">
                            <button
                                onClick={() => setIsCreating(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-accent/10 text-accent hover:bg-accent/20 font-semibold rounded-xl transition-all"
                            >
                                <span>+</span> Créer un autre magasin
                            </button>
                        </div>
                    )
                )}

                {!canCreateMore && !isCreating && businesses.length > 0 && (
                     <div className="text-center mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100">
                         <p className="text-amber-800 text-sm">
                             Pour gérer plusieurs magasins, vous devez passer à l'abonnement Business.
                         </p>
                     </div>
                )}
            </div>
        </div>
    );
};
