import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

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
