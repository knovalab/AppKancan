import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OmitirAlmuerzoModal } from '../../../../components/employee-card/modales/OmitirAlmuerzoModal';

describe('OmitirAlmuerzoModal', () => {
	const defaultProps = {
		open: true,
		onClose: vi.fn(),
		nombre: 'Carlos Mendoza',
		onConfirmar: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders modal dialog with warning and employee name', () => {
		render(<OmitirAlmuerzoModal {...defaultProps} />);

		expect(
			screen.getByText('¿El turno no incluye almuerzo?'),
		).toBeInTheDocument();
		expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
		expect(
			screen.getByText(new RegExp(dayjs().format('DD/MM/YYYY'))),
		).toBeInTheDocument();
		expect(
			screen.getByText(/esta opción solo se puede revertir/i),
		).toBeInTheDocument();
	});

	it('calls onClose when Cancelar is clicked', async () => {
		const user = userEvent.setup();
		render(<OmitirAlmuerzoModal {...defaultProps} />);

		const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
		await user.click(cancelBtn);

		expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onConfirmar and closes modal on success', async () => {
		const user = userEvent.setup();
		const onConfirmar = vi.fn().mockResolvedValue({ ok: true });
		render(<OmitirAlmuerzoModal {...defaultProps} onConfirmar={onConfirmar} />);

		const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
		await user.click(confirmBtn);

		expect(onConfirmar).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
		});
	});

	it('keeps modal open if onConfirmar fails', async () => {
		const user = userEvent.setup();
		const onConfirmar = vi.fn().mockResolvedValue({
			ok: false,
			error: 'Error de red',
		});
		render(<OmitirAlmuerzoModal {...defaultProps} onConfirmar={onConfirmar} />);

		const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
		await user.click(confirmBtn);

		expect(onConfirmar).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(defaultProps.onClose).not.toHaveBeenCalled();
		});
	});

	it('shows loading state while confirmation is in progress', async () => {
		const user = userEvent.setup();
		let resolveConfirm: (value: { ok: boolean }) => void = () => {};
		const pendingPromise = new Promise<{ ok: boolean }>((res) => {
			resolveConfirm = res;
		});
		const onConfirmar = vi.fn().mockReturnValue(pendingPromise);

		render(<OmitirAlmuerzoModal {...defaultProps} onConfirmar={onConfirmar} />);

		const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
		await user.click(confirmBtn);

		expect(screen.getByText('Registrando…')).toBeInTheDocument();
		expect(confirmBtn).toBeDisabled();
		expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();

		resolveConfirm({ ok: true });
		await waitFor(() => {
			expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
		});
	});
});
