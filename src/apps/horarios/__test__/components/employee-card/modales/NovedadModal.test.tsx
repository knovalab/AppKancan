import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NovedadModal } from '../../../../components/employee-card/modales/NovedadModal';
import type { TipoNovedad } from '../../../../interfaces/horarios.interface';

vi.mock('@/apps/reservas/hooks/useHolidays', () => ({
	useHolidays: () => ({ data: {} }),
}));
vi.mock('../../../../reservas/hooks/useHolidays', () => ({
	useHolidays: () => ({ data: {} }),
}));

describe('NovedadModal', () => {
	const tiposNovedad: TipoNovedad[] = [
		{ id: 1, nombre: 'Permiso laboral', name: 'Permiso laboral' },
		{ id: 2, nombre: 'Incapacidad médica', name: 'Incapacidad médica' },
	];

	const defaultProps = {
		open: true,
		onClose: vi.fn(),
		tiposNovedad,
		onGuardar: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
	};

	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});
	});

	const renderComponent = (props = defaultProps) => {
		return render(
			<QueryClientProvider client={queryClient}>
				<NovedadModal {...props} />
			</QueryClientProvider>,
		);
	};

	it('renders dialog title and input fields', () => {
		renderComponent();

		expect(screen.getByText('Registro de Novedad')).toBeInTheDocument();
		expect(screen.getAllByText(/Desde el día/i)[0]).toBeInTheDocument();
		expect(screen.getAllByText(/Hasta el día/i)[0]).toBeInTheDocument();
		expect(screen.getByLabelText(/Observaciones/i)).toBeInTheDocument();
	});

	it('disables Guardar button when no novedad is selected', () => {
		renderComponent();

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		expect(saveBtn).toBeDisabled();
	});

	it('calls onClose when Cancelar button is clicked', async () => {
		const user = userEvent.setup();
		renderComponent();

		const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
		await user.click(cancelBtn);

		expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
	});

	it('allows entering observations and selecting novedad', async () => {
		renderComponent();

		const obsInput = screen.getByLabelText(/Observaciones/i);
		fireEvent.change(obsInput, { target: { value: 'Cita con especialista' } });

		expect(obsInput).toHaveValue('Cita con especialista');
	});

	it('does not close modal if onGuardar returns ok: false', async () => {
		const user = userEvent.setup();
		const onGuardar = vi.fn().mockResolvedValue({ ok: false, error: 'Error' });
		renderComponent({ ...defaultProps, onGuardar });

		// Select a novedad
		const select = screen.getByLabelText('Novedad');
		fireEvent.mouseDown(select);

		const option = await screen.findByRole('option', {
			name: 'Permiso laboral',
		});
		await user.click(option);

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		expect(saveBtn).toBeEnabled();
		await user.click(saveBtn);

		expect(onGuardar).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(defaultProps.onClose).not.toHaveBeenCalled();
		});
	});

	it('calls onGuardar and closes modal on success', async () => {
		const user = userEvent.setup();
		const onGuardar = vi.fn().mockResolvedValue({ ok: true });
		renderComponent({ ...defaultProps, onGuardar });

		const select = screen.getByLabelText('Novedad');
		fireEvent.mouseDown(select);

		const option = await screen.findByRole('option', {
			name: 'Incapacidad médica',
		});
		await user.click(option);

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		await user.click(saveBtn);

		expect(onGuardar).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
		});
	});
});
