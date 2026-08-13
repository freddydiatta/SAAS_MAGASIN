import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext';

export const ProtectedRoute = ({ children, requireBusiness = false }) => {
    const { user } = useAuth();
    const { selectedBusiness, loading } = useBusiness();

    if (!user) {
        // Redirect to login if not authenticated
        return <Navigate to="/login" replace />;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (requireBusiness && !selectedBusiness) {
        return <Navigate to="/businesses" replace />;
    }

    return children;
};
