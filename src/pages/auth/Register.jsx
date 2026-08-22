import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { ShieldCheck, TrendingUp, Users, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DEFAULT_PLAN } from '../../config/pricing';
import { registerSchema } from '../../lib/validation';

export const Register = () => {
    const [authError, setAuthError] = useState('');
    const [authSuccess, setAuthSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const selectedPlan = searchParams.get('plan') || DEFAULT_PLAN;
    const refCodeFromUrl = searchParams.get('ref');

    // Store ref code in localStorage if present
    useEffect(() => {
        if (refCodeFromUrl) {
            localStorage.setItem('gestionpro_ref', refCodeFromUrl);
        }
    }, [refCodeFromUrl]);

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(registerSchema)
    });

    const onSubmit = async (data) => {
        setIsLoading(true);
        setAuthError('');
        
        try {
            const storedRef = localStorage.getItem('gestionpro_ref');
            const { error } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        subscription_plan: selectedPlan,
                        referred_by: storedRef || null
                    }
                }
            });

            if (error) {
                setAuthError(error.message || "Une erreur s'est produite lors de la création du compte.");
            } else {
                setAuthSuccess(true);
            }
        } catch (err) {
            setAuthError("Une erreur inattendue s'est produite.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface flex">
            
            {/* Colonne Gauche - Illustration (On inverse par rapport au Login pour varier un peu) */}
            <div className="hidden lg:flex w-1/2 bg-panel relative overflow-hidden items-center justify-center p-12 order-2 lg:order-1">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'none\\' fill-rule=\\'evenodd\\'%3E%3Cg fill=\\'%23ffffff\\' fill-opacity=\\'1\\'%3E%3Cpath d=\\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}></div>
                <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-accent/20 rounded-full blur-[120px] -translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] translate-y-1/3 translate-x-1/4 pointer-events-none"></div>

                <div className="relative z-10 w-full max-w-lg">
                    <div className="text-center mb-16">
                        <h3 className="text-white text-3xl font-extrabold mb-4">Rejoignez l'élite des gérants.</h3>
                        <p className="text-white/60 text-lg">Plus de 10,000 entreprises ont déjà fait confiance à GestionPro pour propulser leur croissance.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-surface/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6"
                        >
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <h4 className="text-white font-bold mb-2">Essai Gratuit</h4>
                            <p className="text-white/60 text-sm">14 jours complets sans carte de crédit requise.</p>
                        </motion.div>

                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-surface/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 mt-8"
                        >
                            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center mb-4">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h4 className="text-white font-bold mb-2">100% Sécurisé</h4>
                            <p className="text-white/60 text-sm">Vos données sont cryptées et hébergées sur le cloud.</p>
                        </motion.div>
                    </div>
                </div>
            </div>
            
            {/* Colonne Droite - Formulaire */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 relative order-1 lg:order-2">
                
                {/* Logo */}
                <div className="absolute top-8 left-8 sm:left-12 lg:left-24">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
                            <span className="text-white font-bold text-2xl">G</span>
                        </div>
                        <span className="font-bold text-2xl text-primary tracking-tight">Gestion<span className="text-accent">Pro</span></span>
                    </Link>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-md w-full mx-auto mt-16 lg:mt-0"
                >
                    <div className="mb-10">
                        <div className="inline-block px-3 py-1 bg-accent/10 text-accent font-bold rounded-full text-sm mb-4">
                            Essai gratuit de 14 jours
                        </div>
                        <h2 className="text-4xl font-extrabold text-primary tracking-tight mb-3">
                            Créer un compte
                        </h2>
                        <p className="text-secondary text-lg">
                            Commencez à gérer votre entreprise plus intelligemment dès aujourd'hui.
                        </p>
                    </div>
                    
                    {authError && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-red-700 text-sm font-medium">{authError}</p>
                        </motion.div>
                    )}

                    {authSuccess ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-10 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8"
                        >
                            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-extrabold text-primary mb-3">Compte créé !</h3>
                            <p className="text-secondary mb-8">
                                Veuillez vérifier vos emails pour confirmer votre compte ou connectez-vous directement si la confirmation n'est pas requise.
                            </p>
                            <Link to="/login" className="btn-primary w-full py-4 text-center rounded-xl font-bold shadow-xl shadow-accent/25 hover:-translate-y-0.5 transition-all inline-block">
                                Aller à la connexion
                            </Link>
                        </motion.div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-primary">Adresse email</label>
                                <input
                                    type="email"
                                    {...register('email')}
                                    className={`w-full bg-white border ${errors.email ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:border-accent focus:ring-accent/20'} rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-4 transition-all shadow-sm`}
                                    placeholder="vous@exemple.com"
                                />
                                {errors.email && <p className="mt-1.5 text-sm text-red-500 font-bold">{errors.email.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-primary">Mot de passe</label>
                                <input
                                    type="password"
                                    {...register('password')}
                                    className={`w-full bg-white border ${errors.password ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:border-accent focus:ring-accent/20'} rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-4 transition-all shadow-sm`}
                                    placeholder="••••••••"
                                />
                                {errors.password && <p className="mt-1.5 text-sm text-red-500 font-bold">{errors.password.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-primary">Confirmer le mot de passe</label>
                                <input
                                    type="password"
                                    {...register('confirmPassword')}
                                    className={`w-full bg-white border ${errors.confirmPassword ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:border-accent focus:ring-accent/20'} rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-4 transition-all shadow-sm`}
                                    placeholder="••••••••"
                                />
                                {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-500 font-bold">{errors.confirmPassword.message}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full py-4 mt-4 flex justify-center items-center font-bold text-lg rounded-xl text-white transition-all bg-accent hover:bg-accentHover shadow-xl shadow-accent/25 hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none`}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    "Créer mon compte"
                                )}
                            </button>
                        </form>
                    )}

                    <p className="mt-10 text-center text-secondary font-medium">
                        Vous avez déjà un compte ?{' '}
                        <Link to="/login" className="font-bold text-primary hover:text-accent transition-colors">
                            Connectez-vous
                        </Link>
                    </p>
                </motion.div>
            </div>
        </div>
    );
};
