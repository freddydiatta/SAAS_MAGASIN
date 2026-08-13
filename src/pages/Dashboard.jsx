import { useBusiness } from '../contexts/BusinessContext';
import { RetailDashboard } from '../components/dashboards/RetailDashboard';
import { VillaDashboard } from '../components/dashboards/VillaDashboard';
import { RestaurantDashboard } from '../components/dashboards/RestaurantDashboard';

export const Dashboard = () => {
    const { selectedBusiness } = useBusiness();

    if (!selectedBusiness) {
        return <div className="p-8 text-center text-secondary">Chargement du tableau de bord...</div>;
    }

    const type = selectedBusiness.type;

    if (type === 'villa') {
        return <VillaDashboard />;
    }

    if (type === 'restaurant') {
        return <RestaurantDashboard />;
    }

    // Default for pieces_moto, boutique, quincaillerie
    return <RetailDashboard />;
};
