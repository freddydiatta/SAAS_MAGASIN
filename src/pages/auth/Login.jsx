import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { ShieldCheck, TrendingUp, Users, Loader2, AlertCircle } from 'lucide-react';

// Schéma de validation avec Zod
const loginSchema = z.object({
    email: z.string().email('Veuillez entrer une adresse email valide.'),
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.')
});

export const Login = () => {
    const [authError, setAuthError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutCountdown, setLockoutCountdown] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        let timer;
        if (lockoutCountdown > 0) {
            timer = setInterval(() => {
                setLockoutCountdown(prev => prev - 1);
            }, 1000);
        } else if (lockoutCountdown === 0 && failedAttempts >= 5) {
            setFailedAttempts(0);
            setAuthError('');
        }
        return () => clearInterval(timer);
    }, [lockoutCountdown, failedAttempts]);

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(loginSchema)
    });

    const onSubmit = async (data) => {
        if (lockoutCountdown > 0) return;
        
        if (!navigator.onLine) {
            setAuthError("Pas de connexion internet. Vous ne pouvez pas vous connecter pour la première fois en étant hors ligne.");
            return;
        }

        setIsLoading(true);
        setAuthError('');
        
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            if (error) {
                supabase.rpc('log_failed_login', { p_email: data.email }).catch(() => {});
                const newAttempts = failedAttempts + 1;
                setFailedAttempts(newAttempts);

                if (newAttempts >= 5) {
                    setLockoutCountdown(60);
                    setAuthError("Trop de tentatives échouées. Veuillez patienter 60 secondes.");
                } else {
                    setAuthError(`Identifiants incorrects. Il vous reste ${5 - newAttempts} tentative(s).`);
                }
            } else {
                setFailedAttempts(0);
                supabase.rpc('log_login_success').catch(() => {});
                navigate('/dashboard');
            }
        } catch (err) {
            setAuthError("Une erreur inattendue s'est produite.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface flex">
            {/* Colonne Gauche - Formulaire */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 relative">
                
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
                        <h2 className="text-4xl font-extrabold text-primary tracking-tight mb-3">
                            Bon retour 👋
                        </h2>
                        <p className="text-secondary text-lg">
                            Connectez-vous pour accéder à votre tableau de bord et gérer votre activité.
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
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-bold text-primary">Mot de passe</label>
                                <a href="#" className="text-sm font-bold text-accent hover:text-accentHover transition-colors">
                                    Mot de passe oublié ?
                                </a>
                            </div>
                            <input
                                type="password"
                                {...register('password')}
                                className={`w-full bg-white border ${errors.password ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:border-accent focus:ring-accent/20'} rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-4 transition-all shadow-sm`}
                                placeholder="••••••••"
                            />
                            {errors.password && <p className="mt-1.5 text-sm text-red-500 font-bold">{errors.password.message}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || lockoutCountdown > 0}
                            className={`w-full py-4 mt-4 flex justify-center items-center font-bold text-lg rounded-xl text-white transition-all ${
                                lockoutCountdown > 0 
                                ? 'bg-slate-400 cursor-not-allowed' 
                                : 'bg-accent hover:bg-accentHover shadow-xl shadow-accent/25 hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none'
                            }`}
                        >
                            {lockoutCountdown > 0 ? (
                                `Réessayez dans ${lockoutCountdown}s`
                            ) : isLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                "Se connecter"
                            )}
                        </button>
                    </form>

                    <p className="mt-10 text-center text-secondary font-medium">
                        Vous n'avez pas encore de compte ?{' '}
                        <Link to="/register" className="font-bold text-primary hover:text-accent transition-colors">
                            Créer un essai gratuit
                        </Link>
                    </p>
                </motion.div>
            </div>

            {/* Colonne Droite - Illustration */}
            <div className="hidden lg:flex w-1/2 bg-panel relative overflow-hidden items-center justify-center p-12">
                {/* Décoration de fond */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'none\\' fill-rule=\\'evenodd\\'%3E%3Cg fill=\\'%23ffffff\\' fill-opacity=\\'1\\'%3E%3Cpath d=\\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}></div>
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-accent/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

                <div className="relative z-10 w-full max-w-lg">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="bg-surface/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl relative"
                    >
                        <div className="flex gap-2 mb-8">
                            <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-400/80"></div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-white/60 text-sm font-medium">Chiffre d'affaires</div>
                                    <div className="text-white text-2xl font-bold">+24.5%</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-white/60 text-sm font-medium">Nouveaux clients</div>
                                    <div className="text-white text-2xl font-bold">1,204</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-white/60 text-sm font-medium">Protection des données</div>
                                    <div className="text-emerald-400 text-lg font-bold flex items-center gap-2">
                                        Actif <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Element */}
                        <motion.div 
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -right-12 -bottom-12 bg-white rounded-2xl p-6 shadow-xl border border-slate-100 max-w-[200px]"
                        >
                            <p className="text-primary font-bold text-sm mb-2">Rejoignez 10,000+ gérants satisfaits</p>
                            <div className="flex -space-x-2">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center overflow-hidden">
                                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>

                    <div className="mt-16 text-center">
                        <h3 className="text-white text-3xl font-extrabold mb-4">La gestion simplifiée.</h3>
                        <p className="text-white/60 text-lg">Retrouvez toutes vos données, stocks et statistiques au même endroit, en toute sécurité.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
