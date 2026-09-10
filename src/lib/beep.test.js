import { describe, it, expect, vi, afterEach } from 'vitest';

// sharedContext est un singleton au niveau du module (voir beep.js) : on
// réimporte fraîchement à chaque test (vi.resetModules) pour ne pas laisser
// un AudioContext simulé d'un test fuiter dans le suivant.
describe('playBeep', () => {
    afterEach(() => {
        delete window.AudioContext;
        delete window.webkitAudioContext;
        vi.resetModules();
    });

    const mockAudioContext = () => {
        const oscillator = { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
        const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
        const destination = {};
        const ctor = vi.fn().mockImplementation(function AudioContext() {
            return {
                state: 'running',
                currentTime: 0,
                resume: vi.fn(),
                createOscillator: () => oscillator,
                createGain: () => gain,
                destination,
            };
        });
        window.AudioContext = ctor;
        return { ctor, oscillator, gain, destination };
    };

    it('plays a short tone through a gain envelope', async () => {
        const { oscillator, gain, destination } = mockAudioContext();
        const { playBeep } = await import('./beep');

        playBeep();

        expect(oscillator.connect).toHaveBeenCalledWith(gain);
        expect(gain.connect).toHaveBeenCalledWith(destination);
        expect(oscillator.start).toHaveBeenCalled();
        expect(oscillator.stop).toHaveBeenCalled();
    });

    it('reuses the same AudioContext across multiple calls instead of creating one each time', async () => {
        const { ctor } = mockAudioContext();
        const { playBeep } = await import('./beep');

        playBeep();
        playBeep();

        expect(ctor).toHaveBeenCalledTimes(1);
    });

    it('does nothing and never throws when the Web Audio API is unavailable', async () => {
        const { playBeep } = await import('./beep');

        expect(() => playBeep()).not.toThrow();
    });
});
