import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUploadField } from './ImageUploadField';

const { uploadProductImageMock } = vi.hoisted(() => ({ uploadProductImageMock: vi.fn() }));

vi.mock('../services/imagesService', () => ({
    uploadProductImage: uploadProductImageMock,
}));

describe('ImageUploadField', () => {
    beforeEach(() => {
        uploadProductImageMock.mockReset();
    });

    it('shows a placeholder with no value, and the button reads "Ajouter une photo"', () => {
        render(<ImageUploadField businessId="biz-1" value="" onChange={() => {}} />);

        expect(screen.getByRole('button', { name: 'Ajouter une photo' })).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('shows the existing photo and offers to change/remove it when a value is set', () => {
        // alt="" is deliberate (decorative thumbnail, the "Photo" label
        // already gives context), which removes it from the a11y tree as
        // role="img" — query the DOM node directly instead.
        const { container } = render(<ImageUploadField businessId="biz-1" value="https://x/apple.jpg" onChange={() => {}} />);

        expect(screen.getByRole('button', { name: 'Changer la photo' })).toBeInTheDocument();
        expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/apple.jpg');
        expect(screen.getByLabelText('Retirer la photo')).toBeInTheDocument();
    });

    it('clears the value when "Retirer la photo" is clicked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<ImageUploadField businessId="biz-1" value="https://x/apple.jpg" onChange={onChange} />);

        await user.click(screen.getByLabelText('Retirer la photo'));

        expect(onChange).toHaveBeenCalledWith('');
    });

    it('uploads the selected file and reports the resulting URL via onChange', async () => {
        uploadProductImageMock.mockResolvedValueOnce('https://x/apple.jpg');
        const onChange = vi.fn();
        const user = userEvent.setup();
        const { container } = render(<ImageUploadField businessId="biz-1" value="" onChange={onChange} />);

        const file = new File(['fake'], 'apple.png', { type: 'image/png' });
        const input = container.querySelector('input[type="file"]');
        await user.upload(input, file);

        await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://x/apple.jpg'));
        expect(uploadProductImageMock).toHaveBeenCalledWith('biz-1', file);
    });

    it('shows an error message and does not call onChange when the upload fails', async () => {
        uploadProductImageMock.mockRejectedValueOnce(new Error('Storage quota exceeded'));
        const onChange = vi.fn();
        const user = userEvent.setup();
        const { container } = render(<ImageUploadField businessId="biz-1" value="" onChange={onChange} />);

        const file = new File(['fake'], 'apple.png', { type: 'image/png' });
        const input = container.querySelector('input[type="file"]');
        await user.upload(input, file);

        expect(await screen.findByText('Storage quota exceeded')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('disables the button while there is no businessId yet', () => {
        render(<ImageUploadField businessId={undefined} value="" onChange={() => {}} />);

        expect(screen.getByRole('button', { name: 'Ajouter une photo' })).toBeDisabled();
    });
});
