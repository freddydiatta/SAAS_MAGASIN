import { describe, it, expect } from 'vitest';
import {
    formatDate,
    formatTime,
    formatDateTime,
    startOfDay,
    monthKey,
    monthKeyFromOffset,
    zonedYearMonth,
} from './dates';

// Toutes les assertions partent d'instants UTC explicites et vérifient le
// rendu en heure de Dakar : elles valent donc quel que soit le fuseau de la
// machine qui exécute les tests (Paris en local, UTC en CI).
describe('dates — fuseau du commerce (Dakar)', () => {
    it('affiche une vente de fin de soirée à son heure de Dakar, pas celle de Paris', () => {
        // 21h30 à Dakar ; un appareil réglé sur Paris afficherait 23h30 en été
        const lateSale = '2026-09-11T21:30:00Z';

        expect(formatTime(lateSale)).toBe('21:30');
        expect(formatDate(lateSale)).toBe('11/09/2026');
        expect(formatDateTime(lateSale)).toBe('11/09/2026 21:30');
    });

    it('garde la bonne date pour un instant qui change de jour selon le fuseau', () => {
        // 23h00 à Dakar le 11 = déjà le 12 à Paris (01h00)
        expect(formatDate('2026-09-11T23:00:00Z')).toBe('11/09/2026');
    });

    it('accepte aussi bien une chaîne ISO qu\'un objet Date', () => {
        expect(formatDate(new Date('2026-09-11T10:00:00Z'))).toBe('11/09/2026');
    });

    it('transmet les options de formatage', () => {
        expect(formatDate('2026-09-11T10:00:00Z', { day: 'numeric', month: 'long' })).toBe('11 septembre');
    });

    describe('startOfDay', () => {
        it('place minuit à minuit heure de Dakar', () => {
            expect(startOfDay('2026-09-11T14:00:00Z')).toBe(Date.parse('2026-09-11T00:00:00Z'));
        });

        it('range une vente de 23h dans sa propre journée, pas dans celle du lendemain', () => {
            // Le bug corrigé : avec minuit calculé en heure de Paris, cette
            // vente basculait dans la caisse du jour suivant.
            const lateSale = Date.parse('2026-09-11T23:30:00Z');

            expect(lateSale).toBeGreaterThanOrEqual(startOfDay('2026-09-11T23:30:00Z'));
            expect(startOfDay('2026-09-11T23:30:00Z')).toBe(Date.parse('2026-09-11T00:00:00Z'));
        });

        it('bascule bien de journée au passage de minuit', () => {
            expect(startOfDay('2026-09-12T00:00:00Z')).toBe(Date.parse('2026-09-12T00:00:00Z'));
        });
    });

    describe('regroupement mensuel', () => {
        it('lit le mois dans le fuseau du commerce', () => {
            expect(zonedYearMonth('2026-09-11T10:00:00Z')).toEqual({ year: 2026, month: 9 });
            // 1er septembre 00h00 à Paris = encore le 31 août à Dakar
            expect(zonedYearMonth('2026-08-31T23:00:00Z')).toEqual({ year: 2026, month: 8 });
        });

        it('produit une clé mois cohérente avec celle calculée par décalage', () => {
            const from = '2026-09-11T10:00:00Z';

            expect(monthKey(from)).toBe(monthKeyFromOffset(0, from).key);
            expect(monthKey('2026-08-15T10:00:00Z')).toBe(monthKeyFromOffset(1, from).key);
        });

        it('remonte correctement au-delà d\'un changement d\'année', () => {
            const from = '2026-01-15T10:00:00Z';

            expect(monthKeyFromOffset(1, from)).toEqual({ key: '2025-11', monthIndex: 11, year: 2025 });
            expect(monthKey('2025-12-20T10:00:00Z')).toBe('2025-11');
        });
    });
});
