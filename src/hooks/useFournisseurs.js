import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { fetchSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../services/suppliersService';
import { fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, receivePurchaseOrder, unreceivePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder } from '../services/purchaseOrdersService';
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
    // null = mode ajout ; un fournisseur = mode modification (même
    // formulaire, voir openEditSupplierForm).
    const [editingSupplier, setEditingSupplier] = useState(null);
    // Une seule confirmation à la fois pour supprimer un fournisseur, recevoir,
    // annuler, corriger la réception ou supprimer un bon de commande —
    // remplace window.confirm (popup navigateur générique) par ConfirmModal,
    // cohérent avec le reste de l'app.
    // { type: 'deleteSupplier' | 'receiveOrder' | 'cancelOrder' | 'unreceiveOrder' | 'deleteOrder', item }
    const [confirmAction, setConfirmAction] = useState(null);

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

    const updateSupplierMutation = useMutation({
        mutationFn: (supplier) => updateSupplier({ id: editingSupplier.id, ...supplier }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierQueryKey });
            setIsAddSupplierOpen(false);
            setEditingSupplier(null);
            setSupplierForm(EMPTY_SUPPLIER_FORM);
            toast.success('Fournisseur modifié.');
        },
        onError: () => toast.error('Erreur lors de la modification du fournisseur.'),
    });

    const deleteSupplierMutation = useMutation({
        mutationFn: deleteSupplier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierQueryKey });
            setConfirmAction(null);
            toast.success('Fournisseur supprimé.');
        },
        onError: () => toast.error('Erreur lors de la suppression du fournisseur.'),
    });

    const openAddSupplierForm = () => {
        setEditingSupplier(null);
        setSupplierForm(EMPTY_SUPPLIER_FORM);
        setIsAddSupplierOpen(true);
    };
    const openEditSupplierForm = (supplier) => {
        setEditingSupplier(supplier);
        setSupplierForm({
            name: supplier.name || '',
            contactName: supplier.contact_name || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
        });
        setIsAddSupplierOpen(true);
    };
    const closeSupplierForm = () => {
        setIsAddSupplierOpen(false);
        setEditingSupplier(null);
    };

    const handleSupplierSubmit = (e) => {
        e.preventDefault();
        const result = supplierSchema.safeParse(supplierForm);
        if (!result.success) {
            toast.error(firstZodError(result));
            return;
        }
        if (editingSupplier) {
            updateSupplierMutation.mutate(result.data);
        } else {
            addSupplierMutation.mutate(result.data);
        }
    };

    const handleDeleteSupplier = (supplier) => setConfirmAction({ type: 'deleteSupplier', item: supplier });

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
    // null = mode création ; un bon = mode modification (même modale, voir
    // openEditOrderForm). Seul un bon 'pending' est modifiable.
    const [editingOrder, setEditingOrder] = useState(null);

    const createOrderMutation = useMutation({
        mutationFn: (payload) => createPurchaseOrder({ businessId, ...payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            setIsCreateOrderOpen(false);
            toast.success('Bon de commande créé.');
        },
        onError: (error) => toast.error(error.message || 'Erreur lors de la création du bon de commande.'),
    });

    // Journalisée côté base (voir update_purchase_order) : jamais une
    // correction silencieuse, toujours une trace consultable dans Sécurité.
    const updateOrderMutation = useMutation({
        mutationFn: (payload) => updatePurchaseOrder({ orderId: editingOrder.id, ...payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            queryClient.invalidateQueries({ queryKey: ['audit_logs', businessId] });
            setIsCreateOrderOpen(false);
            setEditingOrder(null);
            toast.success('Bon de commande modifié.');
        },
        onError: (error) => toast.error(error.message || 'Erreur lors de la modification du bon de commande.'),
    });

    // La réception change aussi le stock des produits (via receive_purchase_order
    // côté base) : il faut invalider products en plus des bons pour que
    // Stock.jsx reflète tout de suite les nouvelles quantités.
    const receiveOrderMutation = useMutation({
        mutationFn: receivePurchaseOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            queryClient.invalidateQueries({ queryKey: productKeys.all(businessId) });
            setConfirmAction(null);
            toast.success('Stock mis à jour, commande marquée reçue.');
        },
        onError: (error) => toast.error(error.message || 'Erreur lors de la réception.'),
    });

    const cancelOrderMutation = useMutation({
        mutationFn: cancelPurchaseOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            setConfirmAction(null);
            toast.success('Bon de commande annulé.');
        },
        onError: () => toast.error("Erreur lors de l'annulation."),
    });

    // Corrige un bon marqué reçu par erreur : retire le stock qui avait été
    // ajouté (voir unreceive_purchase_order) — invalide products en plus des
    // bons, comme la réception. Journalisée.
    const unreceiveOrderMutation = useMutation({
        mutationFn: (id) => unreceivePurchaseOrder({ orderId: id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            queryClient.invalidateQueries({ queryKey: productKeys.all(businessId) });
            queryClient.invalidateQueries({ queryKey: ['audit_logs', businessId] });
            setConfirmAction(null);
            toast.success('Réception annulée, stock retiré.');
        },
        onError: (error) => toast.error(error.message || "Erreur lors de l'annulation de la réception."),
    });

    // Suppression définitive (voir delete_purchase_order) — un bon reçu doit
    // d'abord passer par handleUnreceiveOrder. Journalisée.
    const deleteOrderMutation = useMutation({
        mutationFn: (id) => deletePurchaseOrder({ orderId: id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: poQueryKey });
            queryClient.invalidateQueries({ queryKey: ['audit_logs', businessId] });
            setConfirmAction(null);
            toast.success('Bon de commande supprimé.');
        },
        onError: (error) => toast.error(error.message || 'Erreur lors de la suppression du bon de commande.'),
    });

    const openCreateOrderForm = () => {
        setEditingOrder(null);
        setIsCreateOrderOpen(true);
    };
    const openEditOrderForm = (order) => {
        setEditingOrder(order);
        setIsCreateOrderOpen(true);
    };
    const closeCreateOrderForm = () => {
        setIsCreateOrderOpen(false);
        setEditingOrder(null);
    };

    const handleSubmitOrder = async ({ supplierId, items }) => {
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

        if (editingOrder) {
            updateOrderMutation.mutate({ supplierId, items: resolvedItems });
        } else {
            createOrderMutation.mutate({ supplierId, items: resolvedItems });
        }
    };

    const handleReceiveOrder = (order) => setConfirmAction({ type: 'receiveOrder', item: order });
    const handleCancelOrder = (order) => setConfirmAction({ type: 'cancelOrder', item: order });
    const handleUnreceiveOrder = (order) => setConfirmAction({ type: 'unreceiveOrder', item: order });
    const handleDeleteOrder = (order) => setConfirmAction({ type: 'deleteOrder', item: order });

    const closeConfirmAction = () => setConfirmAction(null);

    const confirmPendingAction = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'deleteSupplier') deleteSupplierMutation.mutate(confirmAction.item.id);
        else if (confirmAction.type === 'receiveOrder') receiveOrderMutation.mutate(confirmAction.item.id);
        else if (confirmAction.type === 'cancelOrder') cancelOrderMutation.mutate(confirmAction.item.id);
        else if (confirmAction.type === 'unreceiveOrder') unreceiveOrderMutation.mutate(confirmAction.item.id);
        else if (confirmAction.type === 'deleteOrder') deleteOrderMutation.mutate(confirmAction.item.id);
    };

    const isConfirmingAction = deleteSupplierMutation.isPending || receiveOrderMutation.isPending || cancelOrderMutation.isPending
        || unreceiveOrderMutation.isPending || deleteOrderMutation.isPending;

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
        editingSupplier,
        openAddSupplierForm,
        openEditSupplierForm,
        closeSupplierForm,
        supplierForm,
        setSupplierForm,
        handleSupplierSubmit,
        handleDeleteSupplier,
        isSavingSupplier: addSupplierMutation.isPending || updateSupplierMutation.isPending,

        purchaseOrders,
        isLoadingOrders,
        isCreateOrderOpen,
        editingOrder,
        openCreateOrderForm,
        openEditOrderForm,
        closeCreateOrderForm,
        handleSubmitOrder,
        handleReceiveOrder,
        handleCancelOrder,
        handleUnreceiveOrder,
        handleDeleteOrder,
        isSavingOrder: isCreatingNewProducts || createOrderMutation.isPending || updateOrderMutation.isPending,

        confirmAction,
        closeConfirmAction,
        confirmPendingAction,
        isConfirmingAction,

        orderToPrint,
        setOrderToPrint,
        handlePrintOrder,
    };
}
