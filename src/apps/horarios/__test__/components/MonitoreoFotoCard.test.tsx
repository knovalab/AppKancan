import { describe, expect, it, vi } from 'vitest';
import * as directusCreate from '../../api/directus/create';
import { MonitoreoFotoCard } from '../../components/monitoreo-fotos/MonitoreoFotoCard';
import type { TimeRecordDto } from '../../interfaces/api/timeRecords';
import {
	createQueryWrapper,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '../utils/test-utils';

vi.mock('../../api/directus/create', () => ({
	updateTimeRecord: vi.fn().mockResolvedValue({}),
}));

const record = (extra: Partial<TimeRecordDto> = {}) =>
	({
		id: 7,
		record_date: '2026-10-26',
		record_time: '08:00:00',
		log_type: 'Comenzar Jornada',
		employee_id: { first_name: 'Ana', last_name: 'Gomez' },
		store_id: { id: 1, name: 'Tienda 1' },
		photo: null,
		...extra,
	}) as unknown as TimeRecordDto;

describe('MonitoreoFotoCard · revisión', () => {
	it('pide confirmación y razón antes de marcar para revisión', async () => {
		render(<MonitoreoFotoCard record={record()} />, {
			wrapper: createQueryWrapper(),
		});

		fireEvent.click(
			screen.getByRole('button', { name: /marcar para revisión/i }),
		);
		const confirmar = within(screen.getByRole('dialog')).getByRole('button', {
			name: /marcar para revisión/i,
		});
		// Sin razón no se puede confirmar
		expect(confirmar).toBeDisabled();

		fireEvent.change(screen.getByLabelText(/razón/i), {
			target: { value: '  Foto borrosa  ' },
		});
		fireEvent.click(confirmar);

		await waitFor(() =>
			expect(directusCreate.updateTimeRecord).toHaveBeenCalledWith(7, {
				is_under_review: true,
				review_reason: 'Foto borrosa',
			}),
		);
	});

	it('en revisión muestra insignia y razón, sin opción de desmarcar', () => {
		render(
			<MonitoreoFotoCard
				record={record({ is_under_review: true, review_reason: 'No es ella' })}
			/>,
			{ wrapper: createQueryWrapper() },
		);

		expect(screen.getByText('En revisión')).toBeInTheDocument();
		// La razón no se muestra bajo la foto: queda en el tooltip de la insignia
		expect(screen.queryByText('No es ella')).not.toBeInTheDocument();
		expect(screen.getByLabelText('No es ella')).toHaveTextContent(
			'En revisión',
		);
		expect(
			screen.queryByRole('button', { name: /revisión/i }),
		).not.toBeInTheDocument();
	});
});
