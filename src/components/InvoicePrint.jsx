import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const InvoicePrint = ({ invoiceDetails, business, onClose }) => {
    const { user } = useAuth();
    const [isGenerating, setIsGenerating] = useState(false);
    
    if (!invoiceDetails || !business) return null;

    const receiptIdStr = invoiceDetails.receiptId ? invoiceDetails.receiptId.split('-')[0].toUpperCase() : Math.floor(Math.random() * 100000).toString().padStart(5, '0');

    const handlePrint = async () => {
        setIsGenerating(true);
        try {
            const doc = new jsPDF({ format: 'a4' });
            
            // Header
            doc.setFontSize(22);
            doc.setTextColor(30, 41, 59); // text-primary
            doc.text(business?.name || 'Boutique', 14, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // text-secondary
            const bizType = business?.type === 'pieces_moto' ? 'Pièces détachées et Accessoires' : 'Boutique / Magasin';
            doc.text(bizType, 14, 28);
            if (business?.address) doc.text(`Localisation: ${business.address}`, 14, 34);
            if (business?.phone) doc.text(`Tel: ${business.phone}`, 14, 40);

            // Facture info (Right side)
            doc.setFontSize(16);
            doc.setTextColor(148, 163, 184); // text-slate-400
            doc.text('FACTURE', 196, 20, { align: 'right' });
            
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text(`#${receiptIdStr}`, 196, 28, { align: 'right' });
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            const dateStr = `${new Date(invoiceDetails.date).toLocaleDateString('fr-FR')} ${new Date(invoiceDetails.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}`;
            doc.text(dateStr, 196, 34, { align: 'right' });

            // Customer Info
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text('FACTURE À', 14, 55);
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text(invoiceDetails.customerName || 'Client Comptoir', 14, 62);
            if (invoiceDetails.customerPhone) {
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(`Tel: ${invoiceDetails.customerPhone}`, 14, 68);
            }

            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text('VENDEUR', 196, 55, { align: 'right' });
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59);
            doc.text(user?.email || '', 196, 62, { align: 'right' });

            // Table
            const tableColumn = ["Description", "Qte", "Prix Unitaire", "Total"];
            const tableRows = [];

            invoiceDetails.items.forEach(item => {
                const name = item.name || item.products?.name || 'Produit Inconnu';
                const price = Number(item.price);
                const qty = Number(item.quantity);
                const itemTotal = price * qty;
                
                tableRows.push([
                    name,
                    qty.toString(),
                    `${price.toLocaleString('fr-FR')} F`,
                    `${itemTotal.toLocaleString('fr-FR')} F`
                ]);
            });

            doc.autoTable({
                startY: 80,
                head: [tableColumn],
                body: tableRows,
                theme: 'plain',
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [100, 116, 139],
                    fontSize: 9,
                    fontStyle: 'bold',
                    lineColor: [226, 232, 240],
                    lineWidth: { bottom: 0.5 }
                },
                bodyStyles: {
                    textColor: [30, 41, 59],
                    fontSize: 10,
                    lineColor: [241, 245, 249],
                    lineWidth: { bottom: 0.1 }
                },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { halign: 'center' },
                    2: { halign: 'right' },
                    3: { halign: 'right', fontStyle: 'bold' }
                },
                margin: { top: 10 }
            });

            // Totals
            const finalY = doc.lastAutoTable.finalY || 80;
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text('Sous-total', 140, finalY + 10);
            doc.setTextColor(30, 41, 59);
            doc.text(`${Number(invoiceDetails.total).toLocaleString('fr-FR')} F`, 196, finalY + 10, { align: 'right' });

            doc.line(140, finalY + 14, 196, finalY + 14);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Total Net', 140, finalY + 22);
            doc.setTextColor(79, 70, 229); 
            doc.text(`${Number(invoiceDetails.total).toLocaleString('fr-FR')} FCFA`, 196, finalY + 22, { align: 'right' });

            // Signatures
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            
            doc.text('Signature du Client', 40, finalY + 45, { align: 'center' });
            doc.line(14, finalY + 65, 66, finalY + 65); 

            doc.text('Cachet / Signature Magasin', 160, finalY + 45, { align: 'center' });
            doc.line(134, finalY + 65, 186, finalY + 65); 

            doc.text('Merci de votre confiance !', 105, finalY + 80, { align: 'center' });

            // Save / Share
            const fileName = `Facture_${receiptIdStr}.pdf`;
            
            if (navigator.share && navigator.canShare) {
                const pdfBlob = doc.output('blob');
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                if (navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            title: 'Facture',
                            files: [file]
                        });
                        setIsGenerating(false);
                        return;
                    } catch (error) {
                        console.log('Partage annulé:', error);
                        // fallback to save if share is cancelled? maybe not necessary
                    }
                } else {
                    doc.save(fileName);
                }
            } else {
                doc.save(fileName);
            }
        } catch (error) {
            console.error('Erreur PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 print:static print:inset-auto print:bg-white print:p-0 print:block">
            <div className="bg-white w-full max-w-5xl h-full md:h-[90vh] rounded-3xl shadow-premium border border-slate-100 flex flex-col overflow-hidden relative print:w-full print:max-w-none print:h-auto print:rounded-none print:shadow-none print:border-none print:block print:overflow-visible">
                {/* Actions */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-wrap gap-4 print:hidden">
                    <button onClick={onClose} className="btn-secondary px-5 py-2.5">
                        ← Fermer
                    </button>
                    <button 
                        onClick={handlePrint} 
                        disabled={isGenerating}
                        className={`btn-primary px-5 py-2.5 flex items-center gap-2 ${isGenerating ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {isGenerating ? '⏳ Création du PDF...' : '📄 Télécharger / Partager en PDF'}
                    </button>
                </div>

                {/* Printable Invoice Area (UI only) */}
                <div className="flex-1 overflow-y-auto p-8 md:p-16 bg-slate-100 flex justify-center print:overflow-visible print:bg-white print:p-0 print:block">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-sm border border-slate-200 p-10 print:w-full print:max-w-none print:shadow-none print:border-none print:m-0 print:p-4">
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
                                <p className="text-primary font-medium">#{receiptIdStr}</p>
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
