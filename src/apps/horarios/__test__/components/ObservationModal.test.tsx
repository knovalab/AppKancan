import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObservationModal } from '../../components/ObservationModal';
import { LOG_TYPE } from '../../domain/registro';
import type { ObservacionEvento } from '../../interfaces/horarios.interface';

vi.mock('../../components/attendance/LeafletMap', () => ({
	LeafletMap: () => <div data-testid="mock-leaflet-map" />,
}));

describe('ObservationModal', () => {
	const defaultProps = {
		open: true,
		onClose: vi.fn(),
		empleado: 'Diego Martínez',
		fecha: '2026-10-15',
		observaciones: [
			{
				evento: LOG_TYPE.inicioJornada,
				observacion: 'Ingreso puntual a apertura',
				hora: '08:00:00',
			},
			{
				evento: LOG_TYPE.finJornada,
				observacion: 'Cierre de caja cuadrado',
				hora: '17:00:00',
			},
		] as ObservacionEvento[],
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders dialog with header, employee initial, name, date, and Jornada Diaria', () => {
		render(<ObservationModal {...defaultProps} />);

		expect(screen.getByText('Diego Martínez')).toBeInTheDocument();
		expect(screen.getByText('D')).toBeInTheDocument();
		expect(screen.getByText('2026-10-15')).toBeInTheDocument();
		expect(screen.getByText('Jornada Diaria')).toBeInTheDocument();
	});

	it('renders store name, admin chip, and total hours when provided', () => {
		render(
			<ObservationModal
				{...defaultProps}
				tiendaNombre="Tienda Central"
				esAdmin={true}
				totalHoras="08h 15m"
			/>,
		);

		expect(screen.getByText('Tienda Central')).toBeInTheDocument();
		expect(screen.getByText('Admin')).toBeInTheDocument();
		expect(screen.getByText('Total: 08h 15m')).toBeInTheDocument();
	});

	it('renders observation items ordered by standard event sequence', () => {
		const disordered: ObservacionEvento[] = [
			{
				evento: LOG_TYPE.finJornada,
				observacion: 'Salida normal',
				hora: '17:00:00',
			},
			{
				evento: LOG_TYPE.inicioAlmuerzo,
				observacion: 'Sale a almorzar',
				hora: '12:00:00',
			},
			{
				evento: LOG_TYPE.inicioJornada,
				observacion: 'Entrada en turno',
				hora: '08:00:00',
			},
		];

		render(<ObservationModal {...defaultProps} observaciones={disordered} />);

		const eventTitles = screen.getAllByText(
			new RegExp(
				`${LOG_TYPE.inicioJornada}|${LOG_TYPE.inicioAlmuerzo}|${LOG_TYPE.finJornada}`,
			),
		);
		expect(eventTitles[0]).toHaveTextContent(LOG_TYPE.inicioJornada);
		expect(eventTitles[1]).toHaveTextContent(LOG_TYPE.inicioAlmuerzo);
		expect(eventTitles[2]).toHaveTextContent(LOG_TYPE.finJornada);
	});

	it('displays "No hay marcaciones registradas para este día" when list is empty', () => {
		render(<ObservationModal {...defaultProps} observaciones={[]} />);

		expect(
			screen.getByText('No hay marcaciones registradas para este día'),
		).toBeInTheDocument();
	});

	it('renders observation note text and event time for recorded events', () => {
		render(<ObservationModal {...defaultProps} />);

		expect(screen.getByText('Ingreso puntual a apertura')).toBeInTheDocument();
		expect(screen.getByText('Cierre de caja cuadrado')).toBeInTheDocument();
		expect(screen.getByText('08:00')).toBeInTheDocument();
		expect(screen.getByText('17:00')).toBeInTheDocument();
	});

	it('calls onClose when close button is clicked', async () => {
		const user = userEvent.setup();
		render(<ObservationModal {...defaultProps} />);

		const closeBtn = screen.getByRole('button', { name: /cerrar/i });
		await user.click(closeBtn);

		expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when backdrop overlay is clicked', () => {
		render(<ObservationModal {...defaultProps} />);

		const backdrop = document.querySelector('.bg-slate-900\\/40');
		if (backdrop) {
			fireEvent.click(backdrop);
			expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
		}
	});

	it('does not render content when open is false', () => {
		render(<ObservationModal {...defaultProps} open={false} />);

		expect(screen.queryByText('Diego Martínez')).not.toBeInTheDocument();
	});
});
