import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Copy, Users, DollarSign, TrendingUp, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';

export const AffiliateDashboard = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [copied, setCopied] = useState(false);

    // Fetch affiliate profile
    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ['affiliateProfile', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('affiliates')
                .select('*')
                .eq('id', user?.id)
                .single();
            
            if (error && error.code === 'PGRST116') {
                // If profile doesn't exist, create it
                const refCode = 'ref_' + user.id.substring(0, 6);
                const { data: newProfile, error: createError } = await supabase
                    .from('affiliates')
                    .insert([{ id: user.id, referral_code: refCode }])
                    .select()
                    .single();
                    
                if (createError) throw createError;
                return newProfile;
            }
            
            if (error) throw error;
            return data;
        },
        enabled: !!user
    });

    // Fetch referrals
    const { data: referrals = [], isLoading: loadingReferrals } = useQuery({
        queryKey: ['affiliateReferrals', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('referrals')
                .select('*, commissions(amount, status)')
                .eq('affiliate_id', user?.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        },
        enabled: !!user
    });

    // Handle copying referral link
    const handleCopy = () => {
        if (!profile) return;
        const link = `${window.location.origin}/register?ref=${profile.referral_code}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loadingProfile || loadingReferrals) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(r => r.status === 'active').length;

    // Calculate total commissions from referrals
    const totalCommissions = referrals.reduce((sum, ref) => {
        const comms = ref.commissions || [];
        return sum + comms.reduce((acc, c) => acc + Number(c.amount), 0);
    }, 0);

    const columns = [
        {
            key: 'date',
            header: "Date d'inscription",
            headerClassName: 'pb-4 font-semibold',
            cellClassName: 'py-4 text-primary font-medium',
            render: (ref) => new Date(ref.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
            }),
        },
        {
            key: 'status',
            header: 'Statut',
            headerClassName: 'pb-4 font-semibold',
            cellClassName: 'py-4',
            render: (ref) => (
                <StatusBadge
                    label={ref.status === 'active' ? 'Actif' : 'En attente'}
                    tone={ref.status === 'active' ? 'emerald' : 'amber'}
                />
            ),
        },
        {
            key: 'commissions',
            header: 'Commissions',
            headerClassName: 'pb-4 font-semibold text-right',
            cellClassName: 'py-4 text-right font-bold text-accent',
            render: (ref) => {
                const refComms = (ref.commissions || []).reduce((acc, c) => acc + Number(c.amount), 0);
                return `${refComms.toLocaleString('fr-FR')} FCFA`;
            },
        },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up pb-10 px-4 md:px-0">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-extrabold text-primary mb-2">Espace Affiliation</h1>
                <p className="text-secondary font-medium">Partagez votre lien et touchez 1 000 FCFA par mois pour chaque filleul actif.</p>
            </div>

            {/* Referral Link Card */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-accent rounded-3xl p-8 shadow-premium text-white relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <LinkIcon className="w-5 h-5" /> Votre lien unique
                    </h3>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 font-mono text-sm break-all backdrop-blur-sm">
                            {window.location.origin}/register?ref={profile?.referral_code}
                        </div>
                        <button 
                            onClick={handleCopy}
                            className="bg-white text-accent hover:bg-slate-50 font-bold px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm shrink-0"
                        >
                            {copied ? (
                                <>
                                    <CheckCircle2 className="w-5 h-5" /> Copié !
                                </>
                            ) : (
                                <>
                                    <Copy className="w-5 h-5" /> Copier le lien
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-4">
                        <Users className="w-6 h-6" />
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Inscriptions Totales</p>
                    <h4 className="text-3xl font-bold text-primary">{totalReferrals}</h4>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Abonnements Actifs</p>
                    <h4 className="text-3xl font-bold text-primary">{activeReferrals}</h4>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center mb-4">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Commissions Générées</p>
                    <h4 className="text-3xl font-bold text-primary">{totalCommissions.toLocaleString('fr-FR')} FCFA</h4>
                </motion.div>
            </div>

            {/* Referrals List */}
            <div className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme mt-8">
                <h3 className="text-xl font-bold text-primary mb-6">Vos filleuls</h3>
                
                <DataTable
                    columns={columns}
                    data={referrals}
                    tableClassName="w-full text-left"
                    headerRowClassName="border-b border-slate-100 dark:border-border-theme text-secondary text-sm"
                    tbodyClassName=""
                    getRowClassName={() => 'border-b border-slate-50 dark:border-border-theme/50 last:border-0'}
                    stateCellClassName="py-0"
                    emptyContent={
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-secondary font-medium">Vous n'avez pas encore de filleuls.</p>
                            <p className="text-sm text-slate-400 mt-1">Partagez votre lien pour commencer à gagner des commissions.</p>
                        </div>
                    }
                />
            </div>
        </div>
    );
};
