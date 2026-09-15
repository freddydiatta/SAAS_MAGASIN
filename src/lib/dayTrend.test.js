import { describe, it, expect } from 'vitest';
import { describeDayTrend, sameTimeYesterday } from './dayTrend';

const money = (n) => `${n} FCFA`;

describe('describeDayTrend', () => {
    it('n\'affiche jamais « -100 % » quand la journée n\'a pas encore commencé', () => {
        // le cas signalé : à l'ouverture le matin, rien vendu, alors qu'hier à
        // la même heure un client était déjà passé
        const trend = describeDayTrend({ today: 0, yesterdaySoFar: 2400, format: money });

        expect(trend.value).toBeNull();
        expect(trend.tone).toBe('neutral');
        expect(trend.label).toBe('Hier à la même heure : 2400 FCFA');
    });

    it('reste neutre quand ni aujourd\'hui ni hier à cette heure n\'ont vendu', () => {
        const trend = describeDayTrend({ today: 0, yesterdaySoFar: 0, format: money });

        expect(trend.value).toBeNull();
        expect(trend.tone).toBe('neutral');
    });

    it('ne gonfle pas un « +100 % » quand hier à cette heure était vide', () => {
        const trend = describeDayTrend({ today: 3000, yesterdaySoFar: 0, format: money });

        expect(trend.value).toBeNull();
        expect(trend.tone).toBe('up');
        expect(trend.label).toBe('Hier à la même heure : aucune vente');
    });

    it('donne le pourcentage quand les deux journées ont déjà vendu', () => {
        expect(describeDayTrend({ today: 3000, yesterdaySoFar: 2000, format: money }))
            .toEqual({ tone: 'up', value: '+50 %', label: 'vs hier à la même heure' });
    });

    it('signale un retard sans ton d\'alarme', () => {
        const trend = describeDayTrend({ today: 1500, yesterdaySoFar: 2000, format: money });

        // 'down' est rendu en gris par l'aperçu, jamais en rouge
        expect(trend.tone).toBe('down');
        expect(trend.value).toBe('−25 %');
    });

    it('compare un nombre de ventes en écart plutôt qu\'en pourcentage', () => {
        const trend = describeDayTrend({
            today: 5, yesterdaySoFar: 7, mode: 'difference', format: (n) => `${n} ventes`,
        });

        expect(trend.value).toBe('−2');
    });
});

describe('sameTimeYesterday', () => {
    it('renvoie la même heure de la veille', () => {
        const DAY = 24 * 60 * 60 * 1000;
        const todayStart = Date.UTC(2026, 8, 15);
        const now = todayStart + 9.5 * 60 * 60 * 1000; // 9h30

        expect(sameTimeYesterday({ now, todayStart, yesterdayStart: todayStart - DAY }))
            .toBe(todayStart - DAY + 9.5 * 60 * 60 * 1000);
    });
});
