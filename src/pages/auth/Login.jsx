import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

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

        setIsLoading(true);
        setAuthError('');
        
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            if (error) {
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
                navigate('/dashboard');
            }
        } catch (err) {
            setAuthError("Une erreur inattendue s'est produite.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link to="/" className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-2xl">G</span>
                    </div>
                    <span className="font-bold text-3xl text-primary tracking-tight">Gestion<span className="text-accent">Pro</span></span>
                </Link>
                <h2 className="text-center text-2xl font-bold tracking-tight text-primary">
                    Connectez-vous à votre compte
                </h2>
                <p className="mt-2 text-center text-sm text-secondary">
                    Ou{' '}
                    <Link to="/register" className="font-semibold text-accent hover:text-accentHover transition-colors">
                        créez un essai gratuit de 14 jours
                    </Link>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 sm:rounded-2xl sm:px-10">
                    
                    {authError && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                            {authError}
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Adresse email</label>
                            <input
                                type="email"
                                {...register('email')}
                                className={`w-full bg-surface border ${errors.email ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:border-accent focus:ring-accent/50'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all`}
                                placeholder="vous@exemple.com"
                            />
                            {errors.email && <p className="mt-1 text-sm text-red-500 font-medium">{errors.email.message}</p>}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-semibold text-primary">Mot de passe</label>
                                <a href="#" className="text-sm font-medium text-accent hover:text-accentHover">
                                    Mot de passe oublié ?
                                </a>
                            </div>
                            <input
                                type="password"
                                {...register('password')}
                                className={`w-full bg-surface border ${errors.password ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:border-accent focus:ring-accent/50'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all`}
                                placeholder="••••••••"
                            />
                            {errors.password && <p className="mt-1 text-sm text-red-500 font-medium">{errors.password.message}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || lockoutCountdown > 0}
                            className={`w-full py-3 mt-2 flex justify-center items-center font-bold rounded-xl text-white transition-all ${
                                lockoutCountdown > 0 
                                ? 'bg-slate-400 cursor-not-allowed' 
                                : 'bg-accent hover:bg-accentHover shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed'
                            }`}
                        >
                            {lockoutCountdown > 0 ? (
                                `Réessayez dans ${lockoutCountdown}s`
                            ) : isLoading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                "Se connecter"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
