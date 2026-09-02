import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { fetchSuppliers, addSupplier, deleteSupplier } from '../services/suppliersService';
import { fetchPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder } from '../services/purchaseOrdersService';
import { addProduct, productKeys } from '../services/productsService';
import { supplierSchema, firstZodError } from '../lib/validation';
import { supplierKeys } from './useSuppliers';

const EMPTY_SUPPLIER_FORM = { name: '', contactName: '', phone: '', email: '' };

// Fournisseurs + bons de commande partagent la même page (Fournisseurs.jsx) :
// deuxième étape du suivi fournisseurs, après le prix d'achat par produit
// (voir useProducts / AddProductModal).
export function useFournisseurs(selectedBusiness) {
    const queryClient = useQueryClient();
    const businessId = selectedBusiness?.id;

    // --- Fournisseurs ---
    const supplierQueryKey = supplierKeys.all(businessId);
    const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
        queryKey: supplierQueryKey,
        queryFn: () => fetchSuppliers(businessId),
        enabled: !!businessId,
    });

    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);

    const addSupplierMutation = useMutation({
        mutationFn: (supplier) => addSupplier({ businessId, ...supplier }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierQueryKey });
            setIsAddSupplierOpen(false);
            setSupplierForm(EMPTY_SUPPLIER_FORM);
            toast.success('Fournisseur ajouté.');
        },
        onError: () => toast.error("Erreur lors de l'ajout du fournisseur."),
    });

    const deleteSupplierMutation = useMutation({
        mutationFn: deleteSupplier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierQueryKey });
            toast.success('Fournisseur supprimé.');
        },
        onError: () => toast.error('Erreur lors de la suppression du fournisseur.'),
    });

    const openAddSupplierForm = () => {
        setSupplierForm(EMPTY_SUPPLIER_FORM);
        setIsAddSupplierOpen(true);
    };
    const closeSupplierForm = () => setIsAddSupplierOpen(false);

    const handleSupplierSubmit = (e) => {
        e.preventDefault();
        const result = supplierSchema.safeParse(supplierForm);
        if (!result.success) {
            toast.error(firstZodError(result));
            return;
        }
        addSupplierMutation.mutate(result.data);
    };

    const handleDeleteSupplier = (supplier) => {
        if (window.confirm(`Supprimer le fournisseur "${supplier.name}" ? Les produits qui lui étaient rattachés resteront, juste sans fournisseur.`)) {
            deleteSupplierMutation.mutate(supplier.id);
        }
    };

    // --- Bons de commande ---
    const poQueryKey = ['purchase_orders', businessId];
    const { data: purchaseOrders = [], isLoading: isLoadingOrders } = useQuery({
        queryKey: poQueryKey,
        queryFn: () => fetchPurchaseOrders(businessId),
        enabled: !!businessId,
    });

    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
    const [isCreatingNewProducts, setIsCreatingNewProducts] = useState(false);
    const [orderToPrint, setOrderToPrint] = useState(null);

    const createOrderMutation = useMutation({
        mutationFn: (payload) => createPurchaseOrder({ businessId, ...payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            setIsCreateOrderOpen(false);
            toast.success('Bon de commande créé.');
        },
        onError: (error) => toast.error(error.message || 'Erreur lors de la création du bon de commande.'),
    });

    // La réception change aussi le stock des produits (via receive_purchase_order
    // côté base) : il faut invalider products en plus des bons pour que
    // Stock.jsx reflète tout de suite les nouvelles quantités.
    const receiveOrderMutation = useMutation({
        mutationFn: receivePurchaseOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            queryClient.invalidateQueries({ queryKey: productKeys.all(businessId) });
            toast.success('Stock mis à jour, commande marquée reçue.');
        },
        onError: (error) => toast.error(error.message || 'Erreur lors de la réception.'),
    });

    const cancelOrderMutation = useMutation({
        mutationFn: cancelPurchaseOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            toast.success('Bon de commande annulé.');
        },
        onError: () => toast.error("Erreur lors de l'annulation."),
    });

    const openCreateOrderForm = () => setIsCreateOrderOpen(true);
    const closeCreateOrderForm = () => setIsCreateOrderOpen(false);

    const handleCreateOrder = async ({ supplierId, items }) => {
        if (items.length === 0) {
            toast.error('Ajoutez au moins un article au bon de commande.');
            return;
        }
        const invalidItem = items.find((item) => {
            if (!(item.quantity > 0) || !(item.unitCost >= 0)) return true;
            if (item.isNew) return !item.newProduct?.name || !(item.newProduct.price >= 0);
            return !item.productId;
        });
        if (invalidItem) {
            toast.error('Vérifiez les articles : produit, quantité et prix doivent être valides.');
            return;
        }

        // Un article "+ Créer un nouveau produit" doit d'abord exister comme
        // un vrai produit (stock à 0 : le stock n'est ajouté qu'à la
        // réception du bon, comme pour tout autre article) avant de pouvoir
        // être rattaché à la ligne de commande.
        setIsCreatingNewProducts(true);
        let resolvedItems;
        try {
            resolvedItems = await Promise.all(items.map(async (item) => {
                if (!item.isNew) return item;
                const created = await addProduct({
                    businessId,
                    name: item.newProduct.name,
                    type: 'standard',
                    price: item.newProduct.price,
                    costPrice: item.unitCost,
                    stockQuantity: 0,
                });
                return { productId: created.id, quantity: item.quantity, unitCost: item.unitCost };
            }));
        } catch (error) {
            toast.error(error.message || "Erreur lors de la création d'un nouveau produit.");
            setIsCreatingNewProducts(false);
            return;
        }
        setIsCreatingNewProducts(false);

        if (items.some((item) => item.isNew)) {
            queryClient.invalidateQueries({ queryKey: productKeys.all(businessId) });
        }

        createOrderMutation.mutate({ supplierId, items: resolvedItems });
    };

    const handleReceiveOrder = (order) => {
        if (window.confirm('Confirmer la réception ? Le stock des produits sera mis à jour automatiquement.')) {
            receiveOrderMutation.mutate(order.id);
        }
    };

    const handleCancelOrder = (order) => {
        if (window.confirm('Annuler ce bon de commande ?')) {
            cancelOrderMutation.mutate(order.id);
        }
    };

    // Document imprimable/partageable du bon de commande (voir
    // PurchaseOrderPrint, même technique que la facture de vente).
    const handlePrintOrder = (order) => {
        setOrderToPrint({
            orderId: order.id,
            date: order.created_at,
            status: order.status,
            supplier: order.supplier,
            items: (order.items || []).map((item) => ({ name: item.product_name, quantity: item.quantity, price: item.unit_cost })),
            total: order.total_amount,
        });
    };

    return {
        suppliers,
        isLoadingSuppliers,
        isAddSupplierOpen,
        openAddSupplierForm,
        closeSupplierForm,
        supplierForm,
        setSupplierForm,
        handleSupplierSubmit,
        handleDeleteSupplier,
        isSavingSupplier: addSupplierMutation.isPending,

        purchaseOrders,
        isLoadingOrders,
        isCreateOrderOpen,
        openCreateOrderForm,
        closeCreateOrderForm,
        handleCreateOrder,
        handleReceiveOrder,
        handleCancelOrder,
        isSavingOrder: isCreatingNewProducts || createOrderMutation.isPending,

        orderToPrint,
        setOrderToPrint,
        handlePrintOrder,
    };
}
