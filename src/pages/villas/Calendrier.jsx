import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { StatusBadge } from '../../components/StatusBadge';

export const Calendrier = () => {
    const { selectedBusiness } = useBusiness();
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    // get range of days to display (including trailing/leading days from other months to fill the grid)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate
    });

    const { data: bookings = [], isLoading } = useQuery({
        queryKey: ['bookings_calendar', selectedBusiness?.id, monthStart],
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

    // Helper to get bookings for a specific day
    const getBookingsForDay = (date) => {
        return bookings.filter(booking => {
            const bStart = startOfDay(parseISO(booking.start_date));
            const bEnd = endOfDay(parseISO(booking.end_date));
            return isWithinInterval(date, { start: bStart, end: bEnd });
        });
    };

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
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden p-6 md:p-8"
            >
                {/* Calendar Controls */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-primary capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: fr })}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} aria-label="Mois précédent" className="p-2 rounded-lg border border-slate-200 dark:border-border-theme hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={nextMonth} aria-label="Mois suivant" className="p-2 rounded-lg border border-slate-200 dark:border-border-theme hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent"></div>
                    </div>
                ) : (
                    <div className="w-full">
                        {/* Days of week */}
                        <div className="grid grid-cols-7 mb-2">
                            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((dayName, idx) => (
                                <div key={idx} className="text-center text-sm font-bold text-secondary uppercase tracking-wider py-2">
                                    {dayName}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-2 md:gap-3">
                            {days.map((day, idx) => {
                                const dayBookings = getBookingsForDay(day);
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isCurrentDay = isToday(day);

                                return (
                                    <div 
                                        key={idx} 
                                        className={`min-h-[100px] md:min-h-[120px] rounded-xl border p-2 flex flex-col gap-1 transition-all
                                            ${isCurrentMonth ? 'bg-surface border-slate-200 dark:border-slate-700/50' : 'bg-slate-50/50 dark:bg-slate-800/10 border-transparent opacity-50'}
                                            ${isCurrentDay ? 'ring-2 ring-accent border-transparent' : ''}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-sm font-bold ${isCurrentDay ? 'text-accent' : 'text-secondary'} ${!isCurrentMonth ? 'text-slate-400' : ''}`}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                        
                                        {/* Bookings for this day */}
                                        <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                                            {dayBookings.map((booking, bIdx) => (
                                                <StatusBadge
                                                    key={bIdx}
                                                    title={`${booking.villas?.name} - ${booking.customer_name} (${booking.status})`}
                                                    label={booking.villas?.name}
                                                    tone={booking.status === 'confirmed' || booking.status === 'confirmé' ? 'emerald' : booking.status === 'provisoire' ? 'amber' : 'slate'}
                                                    rounded="md"
                                                    bold={false}
                                                    className="text-[10px] md:text-xs px-2 py-1 truncate"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Legend */}
            <div className="flex items-center gap-6 pt-4 px-4">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30"></div>
                    <span className="text-sm font-medium text-secondary">Confirmé</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30"></div>
                    <span className="text-sm font-medium text-secondary">Provisoire</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"></div>
                    <span className="text-sm font-medium text-secondary">Annulé / Autre</span>
                </div>
            </div>
        </div>
    );
};
