import { describe, it, expect, vi, beforeEach } from 'vitest';
import { savePushSubscription, deletePushSubscriptionByEndpoint } from './pushSubscriptionsService';

function createQueryBuilder(result) {
    const builder = {
        upsert: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

describe('pushSubscriptionsService', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('savePushSubscription upserts on endpoint with the subscription keys', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);
        const subscription = {
            toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
        };

        await savePushSubscription({ businessId: 'biz-1', userId: 'user-1', subscription });

        expect(fromMock).toHaveBeenCalledWith('push_subscriptions');
        expect(builder.upsert).toHaveBeenCalledWith({
            business_id: 'biz-1',
            user_id: 'user-1',
            endpoint: 'https://push.example/abc',
            p256dh: 'p256dh-key',
            auth: 'auth-key',
        }, { onConflict: 'endpoint' });
    });

    it('propagates a database error from savePushSubscription', async () => {
        fromMock.mockImplementation(() => createQueryBuilder({ data: null, error: new Error('boom') }));
        const subscription = { toJSON: () => ({ endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } }) };

        await expect(savePushSubscription({ businessId: 'biz-1', userId: 'user-1', subscription })).rejects.toThrow('boom');
    });

    it('deletePushSubscriptionByEndpoint deletes the row matching the endpoint', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await deletePushSubscriptionByEndpoint('https://push.example/abc');

        expect(builder.delete).toHaveBeenCalled();
        expect(builder.eq).toHaveBeenCalledWith('endpoint', 'https://push.example/abc');
    });
});
