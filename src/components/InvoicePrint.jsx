import React, { useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useReactToPrint } from 'react-to-print';

export const InvoicePrint = ({ invoiceDetails, business, onClose }) => {
    const { user } = useAuth();
    const invoiceRef = useRef(null);
    
    if (!invoiceDetails || !business) return null;

    const handlePrint = useReactToPrint({
        content: () => invoiceRef.current,
        documentTitle: `Facture_${invoiceDetails.receiptId ? invoiceDetails.receiptId.split('-')[0].toUpperCase() : 'Client'}`,
    });

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
            <div className="bg-white w-full max-w-5xl h-full md:h-[90vh] rounded-3xl shadow-premium border border-slate-100 flex flex-col overflow-hidden relative">
                {/* Actions (Hidden on Print) */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-wrap gap-4">
                    <button onClick={onClose} className="btn-secondary px-5 py-2.5">
                        ← Fermer
                    </button>
                    <button onClick={handlePrint} className="btn-primary px-5 py-2.5 flex items-center gap-2">
                        🖨️ Imprimer / Sauvegarder en PDF
                    </button>
                </div>

                {/* Printable Invoice Area */}
                <div className="flex-1 overflow-y-auto p-8 md:p-16 bg-slate-100 flex justify-center">
                    <div 
                        ref={invoiceRef} 
                        className="bg-white w-full max-w-3xl rounded-2xl shadow-sm border border-slate-200 p-10 print:w-[800px] print:max-w-none print:shadow-none print:border-none print:m-0"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-8">
                            <div>
                                <h1 className="text-4xl font-bold text-primary mb-2">{business?.name}</h1>
                                <p className="text-secondary">{business?.type === 'pieces_moto' ? 'Pièces détachées et Accessoires' : 'Boutique / Magasin'}</p>
                                {business?.address && <p className="text-secondary mt-1">📍 {business.address}</p>}
                                {business?.phone && <p className="text-secondary">📞 {business.phone}</p>}
                            </div>
                            <div className="text-right">
                                <h2 className="text-2xl font-bold text-slate-400 uppercase tracking-widest mb-2">Facture</h2>
                                <p className="text-primary font-medium">#{invoiceDetails.receiptId ? invoiceDetails.receiptId.split('-')[0].toUpperCase() : Math.floor(Math.random() * 100000).toString().padStart(5, '0')}</p>
                                <p className="text-secondary">{new Date(invoiceDetails.date).toLocaleDateString('fr-FR')} {new Date(invoiceDetails.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="mb-10 flex justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Facturé à</h3>
                                <p className="text-lg font-bold text-primary">{invoiceDetails.customerName || 'Client Comptoir'}</p>
                                {invoiceDetails.customerPhone && (
                                    <p className="text-secondary mt-1">📞 {invoiceDetails.customerPhone}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Vendeur</h3>
                                <p className="text-primary font-medium">{user?.email}</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <table className="w-full mb-10 text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-200">
                                    <th className="py-3 font-bold text-slate-500 uppercase text-sm">Description</th>
                                    <th className="py-3 font-bold text-slate-500 uppercase text-sm text-center">Qté</th>
                                    <th className="py-3 font-bold text-slate-500 uppercase text-sm text-right">Prix Unitaire</th>
                                    <th className="py-3 font-bold text-slate-500 uppercase text-sm text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceDetails.items.map((item, idx) => {
                                    const name = item.name || item.products?.name || 'Produit Inconnu';
                                    const price = Number(item.price);
                                    const qty = Number(item.quantity);
                                    return (
                                        <tr key={idx} className="border-b border-slate-100">
                                            <td className="py-4 font-medium text-primary">{name}</td>
                                            <td className="py-4 text-center">{qty}</td>
                                            <td className="py-4 text-right text-secondary">{price.toLocaleString('fr-FR')} F</td>
                                            <td className="py-4 text-right font-bold text-primary">{(price * qty).toLocaleString('fr-FR')} F</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="flex justify-end mb-16">
                            <div className="w-64">
                                <div className="flex justify-between py-2 border-b border-slate-100">
                                    <span className="text-secondary">Sous-total</span>
                                    <span className="font-medium text-primary">{Number(invoiceDetails.total).toLocaleString('fr-FR')} F</span>
                                </div>
                                <div className="flex justify-between py-4">
                                    <span className="text-xl font-bold text-primary">Total Net</span>
                                    <span className="text-xl font-bold text-accent">{Number(invoiceDetails.total).toLocaleString('fr-FR')} FCFA</span>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="flex justify-between mt-12 pt-8 border-t border-slate-200">
                            <div className="text-center">
                                <p className="font-medium text-slate-400 mb-12">Signature du Client</p>
                                <div className="w-48 border-b-2 border-dashed border-slate-300"></div>
                            </div>
                            <div className="text-center">
                                <p className="font-medium text-slate-400 mb-12">Cachet / Signature Magasin</p>
                                <div className="w-48 border-b-2 border-dashed border-slate-300 mx-auto"></div>
                            </div>
                        </div>
                        
                        <div className="text-center mt-12 text-sm text-slate-400">
                            Merci de votre confiance !
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
