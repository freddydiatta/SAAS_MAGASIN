import React from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const InvoicePrint = ({ invoiceDetails, business, onClose }) => {
    const { user } = useAuth();
    
    if (!invoiceDetails || !business) return null;

    const receiptIdStr = invoiceDetails.receiptId ? invoiceDetails.receiptId.split('-')[0].toUpperCase() : Math.floor(Math.random() * 100000).toString().padStart(5, '0');

    // Native browser print (ideal for Desktop and receipt printers)
    const handleNativePrint = () => {
        window.print();
    };

    // PDF Generation (ideal for Mobile and sharing)
    const handlePDFGenerate = () => {
        try {
            const doc = new jsPDF({ format: 'a4' });
            
            // Set default font
            doc.setFont('helvetica');

            // Header
            doc.setFontSize(22);
            doc.setTextColor(30, 41, 59); // text-primary
            doc.text(business?.name || 'Boutique', 14, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // text-secondary
            const bizType = business?.type === 'pieces_moto' ? 'Pieces detachees et Accessoires' : 'Boutique / Magasin';
            doc.text(bizType, 14, 28);
            if (business?.address) doc.text(`Adresse: ${business.address}`, 14, 34);
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
            doc.text('FACTURE A', 14, 55);
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

            autoTable(doc, {
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

            doc.setDrawColor(226, 232, 240);
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
            doc.setDrawColor(203, 213, 225);
            doc.line(14, finalY + 65, 66, finalY + 65); 

            doc.text('Cachet / Signature Magasin', 160, finalY + 45, { align: 'center' });
            doc.line(134, finalY + 65, 186, finalY + 65); 

            doc.text('Merci de votre confiance !', 105, finalY + 80, { align: 'center' });

            // Save / Share
            const fileName = `Facture_${receiptIdStr}.pdf`;
            const pdfBlob = doc.output('blob');
            
            // 1. Try Native Share API (ideal for mobile)
            if (navigator.share && navigator.canShare) {
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                if (navigator.canShare({ files: [file] })) {
                    navigator.share({
                        title: 'Facture',
                        files: [file]
                    }).catch(err => console.log('Partage annule:', err));
                    return; // Stop here if share was triggered
                }
            }

            // 2. Fallback for iOS Safari or Desktop
            const blobUrl = URL.createObjectURL(pdfBlob);
            
            // We try to open in a new tab (bypasses popup blocker because it's synchronous)
            const newWin = window.open(blobUrl, '_blank');
            
            if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
                // 3. If popup was blocked, fallback to native save
                doc.save(fileName);
            }
            
            // Cleanup
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

        } catch (error) {
            console.error('Erreur PDF:', error);
            toast.error("Impossible de générer le PDF. Réessayez ou utilisez le bouton Imprimer.");
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 print:p-0 print:block">
            <div className="bg-white w-full max-w-5xl h-full md:h-[90vh] rounded-3xl shadow-premium border border-slate-100 flex flex-col overflow-hidden relative print:fixed print:inset-0 print:h-screen print:w-screen print:z-[100] print:rounded-none print:border-none print:bg-white">
                {/* Actions */}
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-wrap gap-4 print:hidden">
                    <button onClick={onClose} className="btn-secondary px-4 md:px-5 py-2 md:py-2.5">
                        ← Fermer
                    </button>
                    <div className="flex gap-2 md:gap-3">
                        <button 
                            onClick={handleNativePrint} 
                            className="btn-secondary bg-white px-4 md:px-5 py-2 md:py-2.5 flex items-center gap-2"
                        >
                            🖨️ Imprimer
                        </button>
                        <button 
                            onClick={handlePDFGenerate} 
                            className="btn-primary px-4 md:px-5 py-2 md:py-2.5 flex items-center gap-2"
                        >
                            📄 PDF / Partager
                        </button>
                    </div>
                </div>

                {/* Printable Invoice Area (UI only) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-16 bg-slate-100 flex justify-center print:overflow-visible print:bg-white print:p-10">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-sm border border-slate-200 p-6 md:p-10 print:w-full print:max-w-none print:shadow-none print:border-none print:m-0 print:p-0">
                        {/* Header */}
                        <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-8">
                            <div>
                                <h1 className="text-2xl md:text-4xl font-bold text-primary mb-2">{business?.name}</h1>
                                <p className="text-secondary text-sm md:text-base">{business?.type === 'pieces_moto' ? 'Pièces détachées et Accessoires' : 'Boutique / Magasin'}</p>
                                {business?.address && <p className="text-secondary mt-1 text-sm md:text-base">📍 {business.address}</p>}
                                {business?.phone && <p className="text-secondary text-sm md:text-base">📞 {business.phone}</p>}
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl md:text-2xl font-bold text-slate-400 uppercase tracking-widest mb-2">Facture</h2>
                                <p className="text-primary font-medium">#{receiptIdStr}</p>
                                <p className="text-secondary text-sm md:text-base">{new Date(invoiceDetails.date).toLocaleDateString('fr-FR')} {new Date(invoiceDetails.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="mb-10 flex justify-between">
                            <div>
                                <h3 className="text-xs md:text-sm font-bold text-slate-400 uppercase mb-2">Facturé à</h3>
                                <p className="text-base md:text-lg font-bold text-primary">{invoiceDetails.customerName || 'Client Comptoir'}</p>
                                {invoiceDetails.customerPhone && (
                                    <p className="text-secondary mt-1 text-sm md:text-base">📞 {invoiceDetails.customerPhone}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <h3 className="text-xs md:text-sm font-bold text-slate-400 uppercase mb-2">Vendeur</h3>
                                <p className="text-primary font-medium text-sm md:text-base">{user?.email}</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full mb-10 text-left border-collapse min-w-[400px]">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="py-3 font-bold text-slate-500 uppercase text-xs md:text-sm">Description</th>
                                        <th className="py-3 font-bold text-slate-500 uppercase text-xs md:text-sm text-center">Qté</th>
                                        <th className="py-3 font-bold text-slate-500 uppercase text-xs md:text-sm text-right">Prix Unitaire</th>
                                        <th className="py-3 font-bold text-slate-500 uppercase text-xs md:text-sm text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceDetails.items.map((item, idx) => {
                                        const name = item.name || item.products?.name || 'Produit Inconnu';
                                        const price = Number(item.price);
                                        const qty = Number(item.quantity);
                                        return (
                                            <tr key={idx} className="border-b border-slate-100">
                                                <td className="py-4 font-medium text-primary text-sm md:text-base">{name}</td>
                                                <td className="py-4 text-center text-sm md:text-base">{qty}</td>
                                                <td className="py-4 text-right text-secondary text-sm md:text-base">{price.toLocaleString('fr-FR')} F</td>
                                                <td className="py-4 text-right font-bold text-primary text-sm md:text-base">{(price * qty).toLocaleString('fr-FR')} F</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="flex justify-end mb-16">
                            <div className="w-full md:w-64">
                                <div className="flex justify-between py-2 border-b border-slate-100">
                                    <span className="text-secondary text-sm md:text-base">Sous-total</span>
                                    <span className="font-medium text-primary text-sm md:text-base">{Number(invoiceDetails.total).toLocaleString('fr-FR')} F</span>
                                </div>
                                <div className="flex justify-between py-4">
                                    <span className="text-lg md:text-xl font-bold text-primary">Total Net</span>
                                    <span className="text-lg md:text-xl font-bold text-accent">{Number(invoiceDetails.total).toLocaleString('fr-FR')} FCFA</span>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="flex justify-between mt-12 pt-8 border-t border-slate-200">
                            <div className="text-center w-[45%]">
                                <p className="font-medium text-slate-400 mb-12 text-xs md:text-sm">Signature du Client</p>
                                <div className="w-full border-b-2 border-dashed border-slate-300"></div>
                            </div>
                            <div className="text-center w-[45%]">
                                <p className="font-medium text-slate-400 mb-12 text-xs md:text-sm">Cachet / Signature</p>
                                <div className="w-full border-b-2 border-dashed border-slate-300 mx-auto"></div>
                            </div>
                        </div>
                        
                        <div className="text-center mt-12 text-xs md:text-sm text-slate-400">
                            Merci de votre confiance !
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
