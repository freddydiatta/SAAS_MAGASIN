import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeFilter } from './DateRangeFilter';

describe('DateRangeFilter', () => {
    it('calls onChange with the preset value when a pill is clicked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<DateRangeFilter value="all" onChange={onChange} customFrom="" customTo="" onCustomFromChange={() => {}} onCustomToChange={() => {}} />);

        await user.click(screen.getByRole('button', { name: '7 jours' }));
        expect(onChange).toHaveBeenCalledWith('7d');

        await user.click(screen.getByRole('button', { name: '30 jours' }));
        expect(onChange).toHaveBeenCalledWith('30d');
    });

    it('does not show the custom date inputs unless the value is "custom"', () => {
        render(<DateRangeFilter value="7d" onChange={() => {}} customFrom="" customTo="" onCustomFromChange={() => {}} onCustomToChange={() => {}} />);
        expect(screen.queryByLabelText('Date de début')).not.toBeInTheDocument();
    });

    it('shows the custom date inputs and reports changes on them once "Période" is selected', () => {
        const onCustomFromChange = vi.fn();
        render(<DateRangeFilter value="custom" onChange={() => {}} customFrom="" customTo="" onCustomFromChange={onCustomFromChange} onCustomToChange={() => {}} />);

        const fromInput = screen.getByLabelText('Date de début');
        expect(fromInput).toBeInTheDocument();

        // input[type=date] doesn't respond to userEvent.type reliably —
        // fireEvent.change is the standard workaround for date inputs.
        fireEvent.change(fromInput, { target: { value: '2026-09-01' } });
        expect(onCustomFromChange).toHaveBeenCalledWith('2026-09-01');
    });
});
