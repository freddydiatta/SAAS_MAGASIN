import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';

export const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

export const renderWithQueryClient = (ui, queryClient = createTestQueryClient()) => {
    return {
        queryClient,
        ...render(
            <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
        ),
    };
};

export const renderHookWithQueryClient = (callback, queryClient = createTestQueryClient()) => {
    return {
        queryClient,
        ...renderHook(callback, {
            wrapper: ({ children }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            ),
        }),
    };
};
