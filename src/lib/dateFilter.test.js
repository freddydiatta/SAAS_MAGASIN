import { describe, it, expect } from 'vitest';
import { filterByDateRange } from './dateFilter';

const getDate = (item) => item.created_at;

const now = new Date();
const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString();
};

const ITEMS = [
    { id: 'today', created_at: daysAgo(0) },
    { id: '5d', created_at: daysAgo(5) },
    { id: '10d', created_at: daysAgo(10) },
    { id: '40d', created_at: daysAgo(40) },
];

describe('filterByDateRange', () => {
    it('returns everything when the filter is "all"', () => {
        expect(filterByDateRange(ITEMS, getDate, { dateFilter: 'all' })).toEqual(ITEMS);
    });

    it('keeps only items from the last 7 days', () => {
        const result = filterByDateRange(ITEMS, getDate, { dateFilter: '7d' });
        expect(result.map((i) => i.id)).toEqual(['today', '5d']);
    });

    it('keeps only items from the last 30 days', () => {
        const result = filterByDateRange(ITEMS, getDate, { dateFilter: '30d' });
        expect(result.map((i) => i.id)).toEqual(['today', '5d', '10d']);
    });

    it('returns everything for a custom range with no bounds set yet', () => {
        expect(filterByDateRange(ITEMS, getDate, { dateFilter: 'custom', customFrom: '', customTo: '' })).toEqual(ITEMS);
    });

    it('filters a custom range with only a start date', () => {
        const from = daysAgo(6).slice(0, 10); // YYYY-MM-DD
        const result = filterByDateRange(ITEMS, getDate, { dateFilter: 'custom', customFrom: from, customTo: '' });
        expect(result.map((i) => i.id)).toEqual(['today', '5d']);
    });

    it('filters a custom range with both a start and end date', () => {
        const from = daysAgo(11).slice(0, 10);
        const to = daysAgo(4).slice(0, 10);
        const result = filterByDateRange(ITEMS, getDate, { dateFilter: 'custom', customFrom: from, customTo: to });
        expect(result.map((i) => i.id)).toEqual(['5d', '10d']);
    });
});
