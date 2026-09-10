import { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { Modal } from './Modal';

// Scanner de code-barres via la caméra du téléphone (ZXing) : utilisé en
// Caisse (ajout rapide au panier) et Inventaires (comptage scan -> quantité
// -> suivant). Chargé dynamiquement (import() plutôt qu'un import statique)
// pour ne pas alourdir le bundle initial de tout le monde avec une
// librairie que seuls les utilisateurs qui scannent réellement chargeront.
//
// continuous=false (par défaut) : un seul scan puis fermeture automatique
// (ex. remplir le champ code-barres d'un produit). continuous=true : reste
// ouvert et notifie onScan à chaque nouveau code détecté, jusqu'à fermeture
// manuelle (ex. scanner plusieurs articles à la caisse ou en inventaire
// d'affilée).
export const BarcodeScannerModal = ({ isOpen, onClose, onScan, continuous = false }) => {
    const videoRef = useRef(null);
    const controlsRef = useRef(null);
    const lastScanRef = useRef({ code: null, at: 0 });
    const [error, setError] = useState('');

    // Toujours à jour sans redémarrer la caméra à chaque rendu : les
    // appelants passent souvent un onScan recréé à chaque render (même
    // piège que onClose dans Modal.jsx) — inclure onScan dans les deps de
    // l'effet ci-dessous relancerait la caméra en boucle.
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        setError('');

        (async () => {
            try {
                const { BrowserMultiFormatReader } = await import('@zxing/browser');
                const reader = new BrowserMultiFormatReader();
                const controls = await reader.decodeFromConstraints(
                    { video: { facingMode: 'environment' } },
                    videoRef.current,
                    (result) => {
                        if (cancelled || !result) return;
                        const code = result.getText();
                        const now = Date.now();
                        // Un même code reste détecté pendant plusieurs
                        // frames tant qu'il est dans le cadre — sans ce
                        // garde-fou, un seul passage devant la caméra
                        // déclencherait onScan des dizaines de fois.
                        if (lastScanRef.current.code === code && now - lastScanRef.current.at < 1500) return;
                        lastScanRef.current = { code, at: now };
                        onScanRef.current?.(code);
                        if (!continuous) {
                            controlsRef.current?.stop();
                        }
                    }
                );
                if (cancelled) {
                    controls.stop();
                    return;
                }
                controlsRef.current = controls;
            } catch (e) {
                if (cancelled) return;
                setError(
                    e?.name === 'NotAllowedError'
                        ? "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur pour scanner."
                        : "Impossible d'accéder à la caméra sur cet appareil."
                );
            }
        })();

        return () => {
            cancelled = true;
            controlsRef.current?.stop();
            controlsRef.current = null;
        };
    }, [isOpen, continuous]);

    const handleClose = () => {
        controlsRef.current?.stop();
        controlsRef.current = null;
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Scanner un code-barres"
            maxWidth="max-w-sm"
            zIndexClassName="z-[60]"
        >
            <div className="space-y-4">
                {error ? (
                    <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                        {error}
                    </div>
                ) : (
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                        {/* muted+playsInline requis pour que Safari iOS lance la vidéo sans geste utilisateur supplémentaire */}
                        <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
                        <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-lg" />
                        <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 text-white/90 text-xs font-medium">
                            <ScanLine className="w-4 h-4" />
                            Visez le code-barres
                        </div>
                    </div>
                )}
                <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                    {continuous ? 'Terminer' : 'Annuler'}
                </button>
            </div>
        </Modal>
    );
};
