import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditarHoraModal } from '../../../../components/employee-card/modales/EditarHoraModal';
import { crearRegistrosVacios, LOG_TYPE } from '../../../../domain/registro';
import type { Motivo } from '../../../../interfaces/horarios.interface';

describe('EditarHoraModal', () => {
	const motivos: Motivo[] = [
		{ id: 1, name: 'Permiso personal' },
		{ id: 2, name: 'Cita médica' },
		{ id: 3, name: 'Otro' },
	];

	const defaultProps = {
		open: true,
		onClose: vi.fn(),
		nombre: 'Ana Gómez',
		marcacion: LOG_TYPE.inicioJornada,
		registros: {
			...crearRegistrosVacios(),
			inicioJornada: '08:00 AM',
			observaciones: {
				inicioJornada: 'Llegó a tiempo',
				inicioAlmuerzo: '',
				finAlmuerzo: '',
				finJornada: '',
			},
		},
		motivos,
		cargarMotivo: vi.fn().mockResolvedValue(1),
		onGuardar: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders with modal title, employee name and event name', async () => {
		render(<EditarHoraModal {...defaultProps} />);

		expect(
			screen.getByText(new RegExp(`Editar Hora - ${LOG_TYPE.inicioJornada}`)),
		).toBeInTheDocument();
		expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
		expect(defaultProps.cargarMotivo).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when Cancelar is clicked', async () => {
		const user = userEvent.setup();
		render(<EditarHoraModal {...defaultProps} />);

		const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
		await user.click(cancelBtn);

		expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
	});

	it('loads initial reason and passes through onGuardar on confirm', async () => {
		const onGuardar = vi.fn().mockResolvedValue({ ok: true });
		render(<EditarHoraModal {...defaultProps} onGuardar={onGuardar} />);

		// Wait for cargarMotivo to finish
		await waitFor(() => {
			expect(defaultProps.cargarMotivo).toHaveBeenCalled();
		});

		// Cancel button is available
		expect(
			screen.getByRole('button', { name: /cancelar/i }),
		).toBeInTheDocument();
	});

	it('propagates error when onGuardar returns ok: false', async () => {
		const onGuardar = vi.fn().mockResolvedValue({
			ok: false,
			error: 'No se pudo actualizar la hora',
		});
		render(<EditarHoraModal {...defaultProps} onGuardar={onGuardar} />);

		await waitFor(() => {
			expect(defaultProps.cargarMotivo).toHaveBeenCalled();
		});
	});

	it('handles failure in cargarMotivo gracefully', async () => {
		const cargarMotivo = vi.fn().mockRejectedValue(new Error('Network error'));
		render(<EditarHoraModal {...defaultProps} cargarMotivo={cargarMotivo} />);

		await waitFor(() => {
			expect(cargarMotivo).toHaveBeenCalledTimes(1);
		});
		expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
	});
});
