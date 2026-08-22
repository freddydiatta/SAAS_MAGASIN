import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { reservationSchema, firstZodError } from '../lib/validation';

const EMPTY_FORM = { villa_id: '', customer_name: '', start_date: '', end_date: '', status: 'provisoire' };

// Requêtes, mutations, calcul de prix et validation des réservations de
// villas : sorti de Reservations.jsx pour que ce composant se concentre
// sur le rendu du tableau et du formulaire.
export function useReservations(selectedBusiness) {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const { data: villas = [] } = useQuery({
        queryKey: ['villas', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('villas').select('*').eq('business_id', selectedBusiness?.id);
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const { data: bookings = [], isLoading } = useQuery({
        queryKey: ['bookings', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, villas(name, price_per_night)')
                .eq('business_id', selectedBusiness?.id)
                .order('start_date', { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    // Compute total price dynamically based on dates and selected villa
    const getCalculatedPrice = () => {
        if (!formData.villa_id || !formData.start_date || !formData.end_date) return 0;
        const villa = villas.find(v => v.id === formData.villa_id);
        if (!villa) return 0;

        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 0 ? diffDays * villa.price_per_night : villa.price_per_night; // At least 1 night
    };

    const addBookingMutation = useMutation({
        mutationFn: async (newBooking) => {
            const { data, error } = await supabase
                .from('bookings')
                .insert([{ ...newBooking, business_id: selectedBusiness.id }])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['bookings']);
            setIsAddOpen(false);
            setFormData(EMPTY_FORM);
            toast.success('Réservation confirmée avec succès !');
        }
    });

    const updateBookingMutation = useMutation({
        mutationFn: async ({ id, ...updates }) => {
            const { data, error } = await supabase
                .from('bookings')
                .update(updates)
                .eq('id', id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['bookings']);
            setIsAddOpen(false);
            setEditingBooking(null);
            setFormData(EMPTY_FORM);
            toast.success('Réservation modifiée avec succès !');
        }
    });

    const deleteBookingMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['bookings']);
            toast.success('Réservation supprimée avec succès !');
        },
        onError: () => {
            toast.error('Erreur lors de la suppression.');
        }
    });

    const openAddForm = () => {
        setEditingBooking(null);
        setFormData(EMPTY_FORM);
        setIsAddOpen(true);
    };

    const closeForm = () => setIsAddOpen(false);

    const handleSubmit = (e) => {
        e.preventDefault();

        const result = reservationSchema.safeParse(formData);
        if (!result.success) {
            toast.error(firstZodError(result));
            return;
        }

        // Filet de sécurité : le prix ne devrait jamais être <= 0 une fois
        // l'ordre des dates validé ci-dessus, sauf si une villa existante a
        // un price_per_night invalide (donnée antérieure à la contrainte).
        const totalPrice = getCalculatedPrice();
        if (totalPrice <= 0) {
            toast.error('Veuillez vérifier les dates.');
            return;
        }

        if (editingBooking) {
            updateBookingMutation.mutate({ id: editingBooking.id, ...result.data, total_price: totalPrice });
        } else {
            addBookingMutation.mutate({ ...result.data, total_price: totalPrice });
        }
    };

    const handleEdit = (booking) => {
        setEditingBooking(booking);
        setFormData({
            villa_id: booking.villa_id,
            customer_name: booking.customer_name,
            start_date: booking.start_date,
            end_date: booking.end_date,
            status: booking.status || 'provisoire'
        });
        setIsAddOpen(true);
    };

    const handleDelete = (booking) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer la réservation de ${booking.customer_name} ?`)) {
            deleteBookingMutation.mutate(booking.id);
        }
    };

    return {
        villas,
        bookings,
        isLoading,
        formData,
        setFormData,
        isAddOpen,
        openAddForm,
        closeForm,
        editingBooking,
        getCalculatedPrice,
        handleSubmit,
        handleEdit,
        handleDelete,
        isSaving: addBookingMutation.isPending || updateBookingMutation.isPending,
    };
}
