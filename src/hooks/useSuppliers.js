import { useQuery } from '@tanstack/react-query';
import { fetchSuppliers } from '../services/suppliersService';

export const supplierKeys = {
    all: (businessId) => ['suppliers', businessId],
};

export const useSuppliers = (businessId) => {
    return useQuery({
        queryKey: supplierKeys.all(businessId),
        queryFn: () => fetchSuppliers(businessId),
        enabled: !!businessId,
    });
};
