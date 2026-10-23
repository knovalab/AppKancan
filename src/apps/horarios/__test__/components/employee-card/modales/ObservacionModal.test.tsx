import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObservacionModal } from '../../../../components/employee-card/modales/ObservacionModal';
import {
	LOG_TYPE,
	MAX_CARACTERES_OBSERVACION,
} from '../../../../domain/registro';

describe('ObservacionModal', () => {
	const defaultProps = {
		open: true,
		onClose: vi.fn(),
		marcacion: LOG_TYPE.inicioJornada,
		nombre: 'Juan Pérez',
		inicial: 'Nota inicial previa',
		onGuardar: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders dialog with employee name, mark type and initial text', () => {
		render(<ObservacionModal {...defaultProps} />);

		expect(screen.getByText('Observaciones del evento')).toBeInTheDocument();
		expect(screen.getByText(/Juan Pérez/i)).toBeInTheDocument();
		expect(
			screen.getByText(new RegExp(LOG_TYPE.inicioJornada)),
		).toBeInTheDocument();

		const textarea = screen.getByPlaceholderText(
			'Escriba aquí la observación...',
		);
		expect(textarea).toHaveValue('Nota inicial previa');
		expect(
			screen.getByText(
				new RegExp(`19\\/${MAX_CARACTERES_OBSERVACION} caracteres`, 'i'),
			),
		).toBeInTheDocument();
	});

	it('disables Guardar button when text has not changed from inicial', () => {
		render(<ObservacionModal {...defaultProps} />);

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		expect(saveBtn).toBeDisabled();
	});

	it('enables Guardar button when user edits the text', async () => {
		render(<ObservacionModal {...defaultProps} />);

		const textarea = screen.getByPlaceholderText(
			'Escriba aquí la observación...',
		);
		fireEvent.change(textarea, {
			target: { value: 'Nueva observación editada' },
		});

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		expect(saveBtn).toBeEnabled();
	});

	it('calls onClose when Cancelar is clicked', async () => {
		const user = userEvent.setup();
		render(<ObservacionModal {...defaultProps} />);

		const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
		await user.click(cancelBtn);

		expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onGuardar and closes modal on success', async () => {
		const user = userEvent.setup();
		const onGuardar = vi.fn().mockResolvedValue({ ok: true });
		render(<ObservacionModal {...defaultProps} onGuardar={onGuardar} />);

		const textarea = screen.getByPlaceholderText(
			'Escriba aquí la observación...',
		);
		fireEvent.change(textarea, {
			target: { value: 'Llegada con retraso justificado' },
		});

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		await user.click(saveBtn);

		expect(onGuardar).toHaveBeenCalledWith('Llegada con retraso justificado');
		await waitFor(() => {
			expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
		});
	});

	it('does not close modal if onGuardar returns ok: false', async () => {
		const user = userEvent.setup();
		const onGuardar = vi
			.fn()
			.mockResolvedValue({ ok: false, error: 'Error al guardar' });
		render(<ObservacionModal {...defaultProps} onGuardar={onGuardar} />);

		const textarea = screen.getByPlaceholderText(
			'Escriba aquí la observación...',
		);
		fireEvent.change(textarea, { target: { value: 'Cambio con error' } });

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		await user.click(saveBtn);

		expect(onGuardar).toHaveBeenCalledWith('Cambio con error');
		await waitFor(() => {
			expect(defaultProps.onClose).not.toHaveBeenCalled();
		});
	});

	it('enforces character limit on input', () => {
		render(<ObservacionModal {...defaultProps} inicial="" />);

		const textarea = screen.getByPlaceholderText(
			'Escriba aquí la observación...',
		);
		const max = MAX_CARACTERES_OBSERVACION;
		const longText = 'A'.repeat(max + 50);
		fireEvent.change(textarea, { target: { value: longText } });

		expect(textarea).toHaveValue('A'.repeat(max));
		expect(screen.getByText(`${max}/${max} caracteres`)).toBeInTheDocument();
	});
});
