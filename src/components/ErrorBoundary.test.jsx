import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const Bomb = () => {
    throw new Error('boom');
};

describe('ErrorBoundary', () => {
    it('renders children when nothing throws', () => {
        render(
            <ErrorBoundary>
                <p>Tout va bien</p>
            </ErrorBoundary>
        );
        expect(screen.getByText('Tout va bien')).toBeInTheDocument();
    });

    it('shows the fallback UI instead of crashing when a child throws', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary>
                <Bomb />
            </ErrorBoundary>
        );
        expect(screen.getByText(/une erreur inattendue/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /recharger la page/i })).toBeInTheDocument();
        console.error.mockRestore();
    });
});
