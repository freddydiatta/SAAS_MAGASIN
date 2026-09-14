import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Camera, Upload, FileText, Eye, Loader2, CheckCircle2 } from 'lucide-react';
import { getInvoiceUrl, INVOICE_ACCEPT_ATTR } from '../services/invoicesService';

// Facture remise par le fournisseur à la livraison. Exigée avant de valider
// la réception (voir receive_purchase_order) : c'est la seule trace de ce qui
// a réellement été livré et à quel prix, et la livraison est le seul moment
// où le document est en main.
export const SupplierInvoiceField = ({ order, onAttach, isAttaching }) => {
    const cameraInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isOpening, setIsOpening] = useState(false);

    // invoice_pending : jointe hors-ligne, le fichier attend son tour dans la
    // file. Elle compte comme jointe pour l'utilisateur — la réception mise en
    // file derrière elle ne partira qu'une fois l'envoi réussi.
    const hasInvoice = !!(order?.invoice_path || order?.invoice_pending);

    const pick = (event) => {
        const file = event.target.files?.[0];
        // Le champ est remis à zéro pour que rechoisir le MÊME fichier après
        // un échec redéclenche bien un change.
        event.target.value = '';
        if (file) onAttach(file);
    };

    const openInvoice = async () => {
        if (!order.invoice_path) {
            toast('Cette facture part dès le retour du réseau.');
            return;
        }
        setIsOpening(true);
        try {
            // Bucket privé : pas d'URL permanente, on en signe une à chaque
            // consultation (voir invoicesService).
            const url = await getInvoiceUrl(order.invoice_path);
            window.open(url, '_blank', 'noopener');
        } catch (error) {
            toast.error(error.message || "Impossible d'ouvrir la facture.");
        } finally {
            setIsOpening(false);
        }
    };

    return (
        <div className="rounded-xl border border-slate-200 dark:border-border-theme p-4">
            <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-accent shrink-0" />
                <p className="font-semibold text-primary text-sm">Facture du fournisseur</p>
            </div>

            {hasInvoice ? (
                <>
                    <div className="flex items-center gap-2 mt-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <p className="text-sm text-primary truncate flex-1">
                            {order.invoice_file_name || 'Facture jointe'}
                        </p>
                    </div>
                    {order.invoice_pending && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Enregistrée sur l'appareil, envoyée au retour du réseau.
                        </p>
                    )}
                    <div className="flex gap-2 mt-3">
                        <button
                            type="button"
                            onClick={openInvoice}
                            disabled={isOpening}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-primary bg-surface border border-slate-300 dark:border-border-theme hover:border-accent transition-colors disabled:opacity-50"
                        >
                            {isOpening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                            Voir
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isAttaching}
                            className="px-3 py-2 rounded-lg text-sm font-semibold text-secondary hover:text-accent transition-colors disabled:opacity-50"
                        >
                            Remplacer
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className="text-xs text-secondary mb-3">
                        Prenez-la en photo ou importez le document. Elle est indispensable pour valider la réception.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={isAttaching}
                            className="flex flex-col items-center gap-2 py-3 rounded-xl font-semibold text-sm text-primary bg-surface border border-slate-300 dark:border-border-theme hover:border-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
                        >
                            {isAttaching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5 text-blue-500" />}
                            Photo
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isAttaching}
                            className="flex flex-col items-center gap-2 py-3 rounded-xl font-semibold text-sm text-primary bg-surface border border-slate-300 dark:border-border-theme hover:border-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
                        >
                            {isAttaching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 text-orange-500" />}
                            Importer
                        </button>
                    </div>
                </>
            )}

            {/* Deux champs distincts : `capture` ouvre directement l'appareil
                photo du téléphone, ce qui serait gênant pour importer un PDF
                déjà reçu par message. */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={pick}
                className="hidden"
                aria-label="Prendre la facture en photo"
            />
            <input
                ref={fileInputRef}
                type="file"
                accept={INVOICE_ACCEPT_ATTR}
                onChange={pick}
                className="hidden"
                aria-label="Importer la facture"
            />
        </div>
    );
};
