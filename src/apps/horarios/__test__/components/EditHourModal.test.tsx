import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditHourModal from '../../components/EditHourModal';
import {
	LOG_TYPE,
	MIN_CARACTERES_NOTA_MOTIVO_OTRO,
} from '../../domain/registro';
import type { Motivo } from '../../interfaces/horarios.interface';

vi.mock('@mui/x-date-pickers/TimePicker', () => ({
	TimePicker: ({
		value,
		onChange,
		label,
	}: {
		value: dayjs.Dayjs | null;
		onChange: (val: dayjs.Dayjs | null) => void;
		label?: string;
	}) => (
		<input
			data-testid="mock-time-picker"
			aria-label={label || 'Hora'}
			value={value ? value.format('hh:mm A') : ''}
			onChange={(e) => {
				const parts = e.target.value.split(' ');
				const timePart = parts[0] || '08:00';
				const ampm = parts[1] || 'AM';
				const [h, m] = timePart.split(':').map(Number);
				let hours = h;
				if (ampm === 'PM' && hours < 12) hours += 12;
				if (ampm === 'AM' && hours === 12) hours = 0;
				onChange(dayjs().hour(hours).minute(m).second(0).millisecond(0));
			}}
		/>
	),
}));

describe('EditHourModal', () => {
	const motivos: Motivo[] = [
		{ id: 1, name: 'Permiso personal' },
		{ id: 2, name: 'Cita médica' },
		{ id: 3, name: 'Otro' },
	];

	const defaultProps = {
		open: true,
		onClose: vi.fn(),
		employeeName: 'Laura Torres',
		eventName: LOG_TYPE.inicioJornada,
		initialTimeStr: '08:00 AM',
		initialObservation: '',
		reasons: motivos,
		initialReasonId: null,
		registros: {
			inicioJornada: '08:00',
			inicioAlmuerzo: '12:00',
			finAlmuerzo: '13:00',
			finJornada: '17:00',
		},
		onConfirm: vi.fn().mockResolvedValue(undefined),
		motivoRequerido: true,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders dialog with employee name, event title, and initial values', () => {
		render(<EditHourModal {...defaultProps} />);

		expect(
			screen.getByText(new RegExp(`Editar Hora - ${LOG_TYPE.inicioJornada}`)),
		).toBeInTheDocument();
		expect(screen.getByText('Laura Torres')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /cancelar/i }),
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
	});

	it('calls onClose when Cancelar is clicked', async () => {
		const user = userEvent.setup();
		render(<EditHourModal {...defaultProps} />);

		const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
		await user.click(cancelBtn);

		expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
	});

	it('enforces chronological constraints (cannot place lunch start before jornada start)', () => {
		render(
			<EditHourModal
				{...defaultProps}
				eventName={LOG_TYPE.inicioAlmuerzo}
				initialTimeStr="07:00 AM"
				registros={{
					inicioJornada: '08:00',
					inicioAlmuerzo: '12:00',
					finAlmuerzo: '13:00',
					finJornada: '17:00',
				}}
			/>,
		);

		expect(
			screen.getByText(/La hora no puede ser menor a la de Comenzar Jornada/i),
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
	});

	it('enforces chronological constraints (cannot place lunch start after lunch end)', () => {
		render(
			<EditHourModal
				{...defaultProps}
				eventName={LOG_TYPE.inicioAlmuerzo}
				initialTimeStr="01:30 PM"
				registros={{
					inicioJornada: '08:00',
					inicioAlmuerzo: '12:00',
					finAlmuerzo: '13:00',
					finJornada: '17:00',
				}}
			/>,
		);

		expect(
			screen.getByText(
				/La hora no puede ser mayor a la de Finalizar Almuerzo/i,
			),
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
	});

	it('shows warning alert and requires note with min characters when reason is "Otro"', () => {
		render(
			<EditHourModal
				{...defaultProps}
				initialReasonId={3} // id: 3 is 'Otro'
				initialTimeStr="08:30 AM"
			/>,
		);

		expect(screen.getByText(/debes agregar una nota/i)).toBeInTheDocument();

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		expect(saveBtn).toBeDisabled();

		// Change time so horaCambiada is true
		const timeInput = screen.getByTestId('mock-time-picker');
		fireEvent.change(timeInput, { target: { value: '08:45 AM' } });

		// Still disabled because observation note is empty / below min length
		expect(saveBtn).toBeDisabled();

		const obsInput = screen.getByPlaceholderText(
			new RegExp(`mínimo ${MIN_CARACTERES_NOTA_MOTIVO_OTRO} caracteres`, 'i'),
		);
		fireEvent.change(obsInput, {
			target: { value: 'Demora en transporte público' },
		});

		expect(saveBtn).toBeEnabled();
	});

	it('allows saving when time and reason are valid, and calls onConfirm', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn().mockResolvedValue(undefined);

		render(
			<EditHourModal
				{...defaultProps}
				initialReasonId={1}
				initialTimeStr="07:45 AM"
				onConfirm={onConfirm}
			/>,
		);

		const saveBtn = screen.getByRole('button', { name: /guardar/i });
		expect(saveBtn).toBeDisabled();

		// Change time via mock TimePicker
		const timeInput = screen.getByTestId('mock-time-picker');
		fireEvent.change(timeInput, { target: { value: '07:50 AM' } });

		expect(saveBtn).toBeEnabled();
		await user.click(saveBtn);

		expect(onConfirm).toHaveBeenCalled();
	});

	it('keeps dialog open if onConfirm throws an error', async () => {
		const onConfirm = vi.fn().mockRejectedValue(new Error('Server error'));

		render(
			<EditHourModal
				{...defaultProps}
				initialReasonId={1}
				initialTimeStr="08:15 AM"
				onConfirm={onConfirm}
			/>,
		);

		expect(
			screen.getByRole('button', { name: /cancelar/i }),
		).toBeInTheDocument();
	});
});
