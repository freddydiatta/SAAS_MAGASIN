import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const registerSchema = z.object({
    businessName: z.string().min(2, 'Le nom de l\'entreprise est requis.'),
    email: z.string().email('Veuillez entrer une adresse email valide.'),
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.'),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"]
});

export const Register = () => {
    const [authError, setAuthError] = useState('');
    const [authSuccess, setAuthSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

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
            const { error } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        business_name: data.businessName,
                    }
                }
            });

            if (error) {
                setAuthError(error.message || "Une erreur s'est produite lors de la création du compte.");
            } else {
                setAuthSuccess(true);
                // Si la confirmation d'email est désactivée, on pourrait rediriger direct :
                // navigate('/dashboard');
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
                    Créez votre compte gratuit
                </h2>
                <p className="mt-2 text-center text-sm text-secondary">
                    Vous avez déjà un compte ?{' '}
                    <Link to="/login" className="font-semibold text-accent hover:text-accentHover transition-colors">
                        Connectez-vous
                    </Link>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 sm:rounded-2xl sm:px-10">
                    
                    {authError && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                            {authError}
                            <div className="mt-2 text-xs text-red-400">
                                Debug: URL length: {import.meta.env.VITE_SUPABASE_URL?.length || 0}.<br />
                                Key length: {import.meta.env.VITE_SUPABASE_ANON_KEY?.length || 0}.<br />
                                Key starts with: {import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 10)}
                            </div>
                        </div>
                    )}

                    {authSuccess ? (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl font-bold">✓</span>
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-2">Compte créé !</h3>
                            <p className="text-secondary text-sm mb-6">
                                Veuillez vérifier vos emails pour confirmer votre compte (si activé sur Supabase) ou connectez-vous directement.
                            </p>
                            <Link to="/login" className="btn-primary w-full py-3 inline-block text-center">
                                Aller à la connexion
                            </Link>
                        </div>
                    ) : (
                        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                            <div>
                                <label className="block text-sm font-semibold text-primary mb-1.5">Nom du magasin / entreprise</label>
                                <input
                                    type="text"
                                    {...register('businessName')}
                                    className={`w-full bg-surface border ${errors.businessName ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:border-accent focus:ring-accent/50'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all`}
                                    placeholder="Auto Pièces Dakar"
                                />
                                {errors.businessName && <p className="mt-1 text-sm text-red-500 font-medium">{errors.businessName.message}</p>}
                            </div>

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
                                <label className="block text-sm font-semibold text-primary mb-1.5">Mot de passe</label>
                                <input
                                    type="password"
                                    {...register('password')}
                                    className={`w-full bg-surface border ${errors.password ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:border-accent focus:ring-accent/50'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all`}
                                    placeholder="••••••••"
                                />
                                {errors.password && <p className="mt-1 text-sm text-red-500 font-medium">{errors.password.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-primary mb-1.5">Confirmer le mot de passe</label>
                                <input
                                    type="password"
                                    {...register('confirmPassword')}
                                    className={`w-full bg-surface border ${errors.confirmPassword ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:border-accent focus:ring-accent/50'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all`}
                                    placeholder="••••••••"
                                />
                                {errors.confirmPassword && <p className="mt-1 text-sm text-red-500 font-medium">{errors.confirmPassword.message}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary w-full py-3 mt-4 flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    "Créer mon compte"
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
