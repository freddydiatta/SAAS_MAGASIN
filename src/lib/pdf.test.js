import { describe, it, expect } from 'vitest';
import { pdfText, pdfAmount, pdfFCFA } from './pdf';

describe('pdfAmount', () => {
    it('sépare les milliers par une espace ordinaire, pas une espace fine', () => {
        // le bug qui rendait les factures illisibles : toLocaleString('fr-FR')
        // sépare par U+202F, que jsPDF tronque à un octet — 0x2F, une barre
        // oblique. « 1 600 F » s'imprimait « 1/600 F ».
        const formatted = pdfAmount(1600);

        expect(formatted).toBe('1 600');
        expect(formatted).not.toContain(' ');
        expect([...formatted].every((c) => c.codePointAt(0) <= 0xFF)).toBe(true);
    });

    it('tient sur les grands montants et les décimales', () => {
        expect(pdfAmount(1234567)).toBe('1 234 567');
        expect(pdfAmount(231474.63)).toBe('231 474,63');
    });

    it('ne casse pas sur une valeur absente ou aberrante', () => {
        expect(pdfAmount(null)).toBe('0');
        expect(pdfAmount(undefined)).toBe('0');
        expect(pdfAmount('pas un nombre')).toBe('0');
    });

    it('accole la devise en toutes lettres', () => {
        expect(pdfFCFA(51000)).toBe('51 000 FCFA');
    });
});

describe('pdfText', () => {
    it('garde les accents français, qui passent très bien en un octet', () => {
        // rien n'oblige à écrire « Qte » ou « Pieces detachees » dans un PDF
        expect(pdfText('Pièces détachées et Accessoires')).toBe('Pièces détachées et Accessoires');
        expect(pdfText('Qté')).toBe('Qté');
    });

    it('ramène les caractères typographiques à leur équivalent ASCII', () => {
        // un nom de produit collé depuis un message garde son sens
        expect(pdfText('Coca 1,5L – Pack')).toBe('Coca 1,5L - Pack');
        expect(pdfText('L’huile d’arachide')).toBe("L'huile d'arachide");
        expect(pdfText('« Promo »')).toBe('« Promo »');
        expect(pdfText('Lot “spécial”')).toBe('Lot "spécial"');
    });

    it('retire ce qui n\'a pas d\'équivalent, au lieu d\'imprimer du charabia', () => {
        // un emoji tronqué à un octet sortirait en symbole aléatoire
        expect(pdfText('Ananas 🍍 GM')).toBe('Ananas  GM');
    });

    it('ne laisse passer aucun caractère que le PDF ne sait pas écrire', () => {
        const sortie = pdfText('Prix 1 600 € — «Ananas» 🍍');
        expect([...sortie].every((c) => c.codePointAt(0) <= 0xFF)).toBe(true);
        expect(sortie).toContain('EUR');
    });

    it('rend une chaîne vide pour une valeur absente', () => {
        expect(pdfText(null)).toBe('');
        expect(pdfText(undefined)).toBe('');
    });
});
