import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { uploadProductImage } from '../services/imagesService';

// Champ d'upload de photo réutilisé sur les formulaires produit/moto (Add +
// Edit), menu et villa : aperçu (image existante, placeholder sinon),
// sélection de fichier, redimensionnement + envoi vers Supabase Storage
// gérés par imagesService, puis remonte l'URL publique via onChange — le
// formulaire appelant n'a pas à connaître les détails du bucket/du storage.
export const ImageUploadField = ({ businessId, value, onChange, label = 'Photo' }) => {
    const inputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // permet de reprendre la même photo si l'envoi échoue
        if (!file) return;

        setError('');
        setIsUploading(true);
        try {
            const url = await uploadProductImage(businessId, file);
            onChange(url);
        } catch (err) {
            setError(err.message || "Erreur lors de l'envoi de l'image.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div>
            <label className="block text-sm font-semibold text-primary mb-1.5">{label}</label>
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-surface border border-slate-200 dark:border-border-theme flex items-center justify-center">
                    {isUploading ? (
                        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                    ) : value ? (
                        <img src={value} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <ImagePlus className="w-6 h-6 text-slate-300" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            disabled={isUploading || !businessId}
                            className="py-2 px-3 rounded-lg font-semibold text-sm text-secondary bg-surface border border-slate-200 dark:border-border-theme hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                        >
                            {isUploading ? 'Envoi...' : value ? 'Changer la photo' : 'Ajouter une photo'}
                        </button>
                        {value && !isUploading && (
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                aria-label="Retirer la photo"
                                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
                </div>
            </div>
        </div>
    );
};
