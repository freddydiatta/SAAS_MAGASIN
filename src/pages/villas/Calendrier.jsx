import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Home, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export const Calendrier = () => {
    const { selectedBusiness } = useBusiness();
    const [currentDate, setCurrentDate] = useState(new Date());

    const { data: bookings = [], isLoading } = useQuery({
        queryKey: ['bookings_calendar', selectedBusiness?.id, currentDate.getMonth()],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, villas(name)')
                .eq('business_id', selectedBusiness?.id)
                .order('start_date', { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    // Very simple placeholder UI for the calendar since building a full interactive calendar from scratch is complex.
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-primary mb-2 flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-accent" />
                        Calendrier des Réservations
                    </h1>
                    <p className="text-secondary font-medium">Visualisez l'occupation de vos villas.</p>
                </div>
                <div className="flex gap-3">
                    <button className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 shadow-premium">
                        + Nouvelle Réservation
                    </button>
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden p-8"
            >
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-primary capitalize">
                        {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="p-2 rounded-lg border border-slate-200 dark:border-border-theme hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={nextMonth} className="p-2 rounded-lg border border-slate-200 dark:border-border-theme hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent"></div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.length === 0 ? (
                            <div className="text-center py-16">
                                <CalendarIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                <p className="text-secondary font-medium">Aucune réservation pour cette période.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {bookings.map(booking => (
                                    <div key={booking.id} className="p-4 rounded-2xl border border-slate-100 dark:border-border-theme bg-surface flex flex-col gap-2 hover:border-accent/50 transition-colors cursor-pointer group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center">
                                                    <Home className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <span className="font-bold text-primary">{booking.villas?.name}</span>
                                            </div>
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                                booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                booking.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                {booking.status}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-col gap-1 mt-2 text-sm">
                                            <div className="flex items-center gap-2 text-secondary">
                                                <Users className="w-4 h-4" /> {booking.customer_name}
                                            </div>
                                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-border-theme">
                                                <span className="text-primary font-medium">
                                                    {new Date(booking.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - {new Date(booking.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                </span>
                                                <span className="font-bold text-accent">{Number(booking.total_price).toLocaleString('fr-FR')} FCFA</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
};
