// Bip court synthétisé (Web Audio API) plutôt qu'un fichier audio à charger
// et à mettre en cache — fiable hors-ligne, aucun asset à livrer. Joué à
// chaque scan de code-barres réussi (Caisse, Inventaires), comme le bip
// des scanners d'inventaire physiques : confirmation immédiate sans avoir
// à lire un message.
let sharedContext = null;

export const playBeep = () => {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        // Un seul AudioContext réutilisé : les navigateurs plafonnent le
        // nombre de contextes simultanés, et le créer à chaque bip a un coût.
        sharedContext = sharedContext || new AudioContextClass();
        if (sharedContext.state === 'suspended') sharedContext.resume();

        const oscillator = sharedContext.createOscillator();
        const gain = sharedContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880; // La5 : aigu et net, comme un bip de scanner
        gain.gain.setValueAtTime(0.2, sharedContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, sharedContext.currentTime + 0.12);
        oscillator.connect(gain);
        gain.connect(sharedContext.destination);
        oscillator.start();
        oscillator.stop(sharedContext.currentTime + 0.12);
    } catch {
        // Best-effort : un souci audio ne doit jamais bloquer le scan lui-même.
    }
};
