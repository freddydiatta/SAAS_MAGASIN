import { useQuery } from '@tanstack/react-query';
import { fetchProducts, productKeys } from '../services/productsService';

export const useProducts = (businessId) => {
    return useQuery({
        queryKey: productKeys.all(businessId),
        queryFn: () => fetchProducts(businessId),
        enabled: !!businessId,
    });
};
