import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventoModal } from '../../../../components/employee-card/modales/EventoModal';
import {
	EVENTOS_REPORTABLES,
	MAX_CARACTERES_OBSERVACION,
} from '../../../../domain/registro';

describe('EventoModal', () => {
	const defaultProps = {
		open: true,
		onClose: vi.fn(),
		nombre: 'Pedro Ramírez',
		onGuardar: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders dialog title, employee prompt and default reportable event', () => {
		render(<EventoModal {...defaultProps} />);

		expect(screen.getByText('Reporta un evento')).toBeInTheDocument();
		expect(
			screen.getByText(/Escoja la novedad presentada para Pedro Ramírez:/i),
		).toBeInTheDocument();
		expect(screen.getByLabelText('Observaciones')).toBeInTheDocument();
	});

	it('calls onClose when Cancelar is clicked', async () => {
		const user = userEvent.setup();
		render(<EventoModal {...defaultProps} />);

		const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
		await user.click(cancelBtn);

		expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
	});

	it('submits selected event and observation on Guardar and closes on success', async () => {
		const user = userEvent.setup();
		const onGuardar = vi.fn().mockResolvedValue({ ok: true });
		render(<EventoModal {...defaultProps} onGuardar={onGuardar} />);

		const obsInput = screen.getByLabelText('Observaciones');
		fireEvent.change(obsInput, { target: { value: 'Dolor de cabeza leve' } });

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		await user.click(saveBtn);

		expect(onGuardar).toHaveBeenCalledWith({
			tipo: EVENTOS_REPORTABLES[0],
			observacion: 'Dolor de cabeza leve',
		});
		await waitFor(() => {
			expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
		});
	});

	it('does not close modal when onGuardar returns ok: false', async () => {
		const user = userEvent.setup();
		const onGuardar = vi
			.fn()
			.mockResolvedValue({ ok: false, error: 'Fallo al guardar' });
		render(<EventoModal {...defaultProps} onGuardar={onGuardar} />);

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		await user.click(saveBtn);

		expect(onGuardar).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(defaultProps.onClose).not.toHaveBeenCalled();
		});
	});

	it('enforces character limit on observation field', () => {
		render(<EventoModal {...defaultProps} />);

		const obsInput = screen.getByLabelText('Observaciones');
		const max = MAX_CARACTERES_OBSERVACION;
		const longText = 'Z'.repeat(max + 50);
		fireEvent.change(obsInput, { target: { value: longText } });

		expect(obsInput).toHaveValue('Z'.repeat(max));
		expect(screen.getByText(`${max}/${max} caracteres`)).toBeInTheDocument();
	});
});
