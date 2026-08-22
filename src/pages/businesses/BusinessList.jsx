import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { supabase } from '../../lib/supabase';
import { Plus, ArrowRight, Store, Settings, Phone, MapPin, Wrench, Home, ShoppingCart, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_PLAN } from '../../config/pricing';
import { businessSchema, firstZodError } from '../../lib/validation';


const BUSINESS_TYPES = [
    { id: 'pieces_moto', name: 'Pièces Moto', icon: <Wrench className="w-8 h-8" /> },
    { id: 'villa', name: 'Gestion de Villa', icon: <Home className="w-8 h-8" /> },
    { id: 'quincaillerie', name: 'Quincaillerie', icon: <Wrench className="w-8 h-8" /> },
    { id: 'boutique', name: 'Boutique / Vente', icon: <ShoppingCart className="w-8 h-8" /> },
    { id: 'restaurant', name: 'Restaurant / Fast-food', icon: <Coffee className="w-8 h-8" /> }
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
    const plan = user?.user_metadata?.subscription_plan || DEFAULT_PLAN;
    // Mode Admin temporaire pour permettre la création illimitée
    const canCreateMore = true; // plan === 'business' || businesses.length === 0;

    const handleCreateBusiness = async (e) => {
        e.preventDefault();
        setCreateError('');

        const result = businessSchema.safeParse({
            name: newBusinessName,
            type: newBusinessType,
            phone: newBusinessPhone,
            address: newBusinessAddress,
        });
        if (!result.success) {
            setCreateError(firstZodError(result));
            return;
        }

        setIsSubmitting(true);

        try {
            const { data, error } = await supabase
                .from('businesses')
                .insert([
                    {
                        user_id: user.id,
                        name: result.data.name,
                        type: result.data.type,
                        phone: result.data.phone,
                        address: result.data.address,
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
            console.error('Error creating business:', error.message);
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
            <div className="min-h-screen bg-slate-50 dark:bg-[#0A0C10] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0A0C10] py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto animate-fade-in-up">
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">Vos Magasins et Entreprises</h1>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold shadow-sm mb-4">
                        👑 Mode Admin Activé : Création illimitée de magasins
                    </div>
                    <p className="text-secondary font-medium">
                        Créez autant de magasins que vous voulez pour tester les différentes interfaces.
                    </p>
                </div>

                {/* Liste des magasins */}
                {businesses.length > 0 && !isCreating && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        {businesses.map((business) => (
                            <motion.div 
                                whileHover={{ y: -4, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                key={business.id} 
                                onClick={() => handleSelectBusiness(business)}
                                className="bg-panel rounded-3xl p-6 shadow-premium hover:shadow-premium-lg border border-slate-100 dark:border-border-theme cursor-pointer transition-all flex flex-col items-center text-center group"
                            >
                                <div className="text-4xl mb-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-accent group-hover:bg-accent/10 transition-colors">
                                    {BUSINESS_TYPES.find(t => t.id === business.type)?.icon || <Store className="w-8 h-8" />}
                                </div>
                                <h3 className="text-xl font-bold text-primary mb-2">{business.name}</h3>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {BUSINESS_TYPES.find(t => t.id === business.type)?.name || business.type}
                                </span>
                                
                                <div className="mt-6 text-sm text-accent font-medium group-hover:underline flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                    Accéder au tableau de bord <ArrowRight className="w-4 h-4" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Formulaire de création */}
                <AnimatePresence>
                    {(businesses.length === 0 || isCreating) && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme max-w-2xl mx-auto overflow-hidden"
                        >
                            <div className="mb-8 text-center">
                                <h2 className="text-2xl font-bold text-primary mb-2 tracking-tight">
                                    {businesses.length === 0 ? "Créer votre premier magasin" : "Créer un nouveau magasin"}
                                </h2>
                                <p className="text-secondary font-medium">Configurez les informations de base de votre activité.</p>
                            </div>

                            {createError && (
                                <div className="mb-6 p-4 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2">
                                    <span className="text-xl">⚠️</span> {createError}
                                </div>
                            )}

                            <form onSubmit={handleCreateBusiness} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-primary mb-2">
                                    Nom de l'entreprise
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        value={newBusinessName}
                                        onChange={(e) => setNewBusinessName(e.target.value)}
                                        className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 pl-11 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-primary placeholder:text-slate-400"
                                        placeholder="Ex: Ma Super Boutique"
                                    />
                                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
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
                                                    ? 'border-accent bg-accent/5 dark:bg-accent/10'
                                                    : 'border-slate-100 dark:border-border-theme hover:border-accent/30 bg-surface'
                                            }`}
                                        >
                                            <div className={`${newBusinessType === type.id ? 'text-accent' : 'text-secondary'}`}>
                                                {type.icon}
                                            </div>
                                            <span className={`font-bold ${newBusinessType === type.id ? 'text-accent' : 'text-primary'}`}>
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
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={newBusinessPhone}
                                        onChange={(e) => setNewBusinessPhone(e.target.value)}
                                        className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 pl-11 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-primary placeholder:text-slate-400"
                                        placeholder="Ex: +221 77 123 45 67"
                                    />
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-primary mb-2">
                                    Adresse
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={newBusinessAddress}
                                        onChange={(e) => setNewBusinessAddress(e.target.value)}
                                        className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 pl-11 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-primary placeholder:text-slate-400"
                                        placeholder="Ex: Dakar, Point E"
                                    />
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                {businesses.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
                                    >
                                        Annuler
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newBusinessName.trim()}
                                    className="flex-[2] py-3 px-4 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-premium transition-all disabled:opacity-50 flex justify-center items-center"
                                >
                                    {isSubmitting ? 'Création...' : 'Créer et continuer'}
                                </button>
                            </div>
                        </form>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Bouton pour ouvrir le formulaire si on a le droit */}
                {canCreateMore && !isCreating && (
                    <div className="text-center">
                        <button
                            onClick={() => setIsCreating(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white shadow-premium font-bold rounded-full transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" /> Créer un autre magasin
                        </button>
                    </div>
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
