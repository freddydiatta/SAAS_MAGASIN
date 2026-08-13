import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const BusinessContext = createContext({});

export const BusinessProvider = ({ children }) => {
    const { user } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchBusinesses = async () => {
        if (!user) {
            setBusinesses([]);
            setSelectedBusiness(null);
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            
            setBusinesses(data || []);
            
            // Auto-select if a business was previously selected in localStorage
            const savedBusinessId = localStorage.getItem('gestionpro_selected_business');
            if (savedBusinessId && data?.find(b => b.id === savedBusinessId)) {
                setSelectedBusiness(data.find(b => b.id === savedBusinessId));
            } else if (data && data.length > 0) {
                // Otherwise auto-select the first one
                setSelectedBusiness(data[0]);
                localStorage.setItem('gestionpro_selected_business', data[0].id);
            } else {
                setSelectedBusiness(null);
            }
        } catch (error) {
            console.error('Error fetching businesses:', error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBusinesses();
    }, [user]);

    const selectBusiness = (business) => {
        setSelectedBusiness(business);
        localStorage.setItem('gestionpro_selected_business', business.id);
    };

    return (
        <BusinessContext.Provider value={{
            businesses,
            selectedBusiness,
            selectBusiness,
            loading,
            refreshBusinesses: fetchBusinesses
        }}>
            {children}
        </BusinessContext.Provider>
    );
};

export const useBusiness = () => {
    const context = useContext(BusinessContext);
    if (!context) {
        throw new Error("useBusiness must be used within a BusinessProvider");
    }
    return context;
};
