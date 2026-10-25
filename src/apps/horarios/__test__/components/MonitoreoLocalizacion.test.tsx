import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MonitoreoLocalizacionCard } from '../../components/monitoreo-localizacion/MonitoreoLocalizacionCard';
import { MonitoreoLocalizacionSeccion } from '../../components/monitoreo-localizacion/MonitoreoLocalizacionSeccion';
import { MonitoreoLocalizacionTiendaAccordion } from '../../components/monitoreo-localizacion/MonitoreoLocalizacionTiendaAccordion';
import {
	getLogTypeColor,
	type MonitoreoMultiMarkerMapProps,
} from '../../components/monitoreo-localizacion/MonitoreoMultiMarkerMap';
import type { LocalizacionRecordItem } from '../../hooks/useMonitoreoLocalizacion';
import type { TimeRecordDto } from '../../interfaces/api/timeRecords';

// Mock Leaflet and MultiMarkerMap to avoid jsdom leaflet container issues in tests
vi.mock(
	'../../components/monitoreo-localizacion/MonitoreoMultiMarkerMap',
	async () => {
		const actual = await vi.importActual<Record<string, unknown>>(
			'../../components/monitoreo-localizacion/MonitoreoMultiMarkerMap',
		);
		return {
			...actual,
			MonitoreoMultiMarkerMap: ({
				items,
				logType,
			}: MonitoreoMultiMarkerMapProps) => (
				<div data-testid="mock-multi-marker-map">
					Map for {logType} with {items.length} pins
				</div>
			),
		};
	},
);

describe('getLogTypeColor', () => {
	it('returns green for comenzar jornada / entrada', () => {
		expect(getLogTypeColor('Comenzar Jornada')).toBe('#16a34a');
		expect(getLogTypeColor('Entrada')).toBe('#16a34a');
	});

	it('returns amber for iniciar almuerzo', () => {
		expect(getLogTypeColor('Iniciar Almuerzo')).toBe('#d97706');
	});

	it('returns orange for finalizar almuerzo', () => {
		expect(getLogTypeColor('Finalizar Almuerzo')).toBe('#ea580c');
	});

	it('returns red for terminar jornada / salida', () => {
		expect(getLogTypeColor('Terminar Jornada')).toBe('#dc2626');
		expect(getLogTypeColor('Salida')).toBe('#dc2626');
	});

	it('returns default blue for other log types', () => {
		expect(getLogTypeColor('Pausa Activa')).toBe('#004680');
	});
});

describe('MonitoreoLocalizacionCard', () => {
	const mockItem: LocalizacionRecordItem = {
		lat: 4.60971,
		lon: -74.08175,
		accuracy: 12,
		distanciaTienda: null,
		record: {
			id: 101,
			record_date: '2026-10-18',
			record_time: '08:00:00',
			log_type: 'Comenzar Jornada',
			employee_id: {
				first_name: 'Carlos',
				middle_name: '',
				last_name: 'Rodriguez',
				second_last_name: '',
				document_number: '10203040',
			},
			store_id: {
				id: 1,
				name: 'Tienda Centro',
			},
		} as unknown as TimeRecordDto,
	};

	it('renders employee name, document number, coordinates and punch time', () => {
		render(<MonitoreoLocalizacionCard item={mockItem} />);

		expect(screen.getByText('Carlos Rodriguez')).toBeInTheDocument();
		expect(screen.getByText(/10\s*203\s*040/)).toBeInTheDocument();
		expect(screen.getByText('08:00:00')).toBeInTheDocument();
		expect(screen.getByText(/4\.60971, -74\.08175/)).toBeInTheDocument();
		expect(screen.getByText('±12m')).toBeInTheDocument();
		expect(screen.getByText('Tienda Centro')).toBeInTheDocument();
	});

	it('shows distance to store when the store has a location', () => {
		render(
			<MonitoreoLocalizacionCard
				item={{ ...mockItem, distanciaTienda: 1234 }}
			/>,
		);

		expect(screen.getByText('A 1.2 km de la tienda')).toBeInTheDocument();
	});

	it('calls onFocusOnMap when Centrar button or card is clicked', () => {
		const onFocusOnMap = vi.fn();
		render(
			<MonitoreoLocalizacionCard item={mockItem} onFocusOnMap={onFocusOnMap} />,
		);

		const centrarBtn = screen.getByRole('button', { name: /centrar/i });
		fireEvent.click(centrarBtn);

		expect(onFocusOnMap).toHaveBeenCalled();
	});

	it('shows selected state text when isSelected is true', () => {
		render(<MonitoreoLocalizacionCard item={mockItem} isSelected={true} />);

		expect(
			screen.getByRole('button', { name: /enfocado/i }),
		).toBeInTheDocument();
	});
});

describe('MonitoreoLocalizacionSeccion', () => {
	const mockItems: LocalizacionRecordItem[] = [
		{
			lat: 4.60971,
			lon: -74.08175,
			accuracy: 10,
			distanciaTienda: null,
			record: {
				id: 1,
				record_date: '2026-10-18',
				record_time: '08:00:00',
				log_type: 'Comenzar Jornada',
				employee_id: {
					first_name: 'Ana',
					last_name: 'Gomez',
					document_number: '11111',
				},
				store_id: { id: 1, name: 'Tienda 1' },
			} as unknown as TimeRecordDto,
		},
		{
			lat: 4.6098,
			lon: -74.0819,
			accuracy: 15,
			distanciaTienda: null,
			record: {
				id: 2,
				record_date: '2026-10-18',
				record_time: '08:05:00',
				log_type: 'Comenzar Jornada',
				employee_id: {
					first_name: 'Luis',
					last_name: 'Perez',
					document_number: '22222',
				},
				store_id: { id: 1, name: 'Tienda 1' },
			} as unknown as TimeRecordDto,
		},
	];

	it('returns null if items array is empty', () => {
		const { container } = render(
			<MonitoreoLocalizacionSeccion logType="Comenzar Jornada" items={[]} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it('renders section header, count badge and cards for all employees', () => {
		render(
			<MonitoreoLocalizacionSeccion
				logType="Comenzar Jornada"
				items={mockItems}
			/>,
		);

		expect(screen.getByText('Comenzar Jornada')).toBeInTheDocument();
		expect(screen.getByText('2 ubicaciones registradas')).toBeInTheDocument();
		expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
		expect(screen.getByText('Luis Perez')).toBeInTheDocument();
		expect(
			screen.getByText(/Colaboradores registrados \(2\)/),
		).toBeInTheDocument();
	});
});

describe('MonitoreoLocalizacionTiendaAccordion lazy loading', () => {
	const mockStoreGroup = {
		storeId: 10,
		storeName: 'Tienda Norte',
		totalRecords: 2,
		dates: [
			{
				date: '2026-10-18',
				dateFormatted: '18/10/2026',
				dateLabel: 'Hoy',
				totalRecords: 2,
				sections: [
					{
						logType: 'Comenzar Jornada',
						count: 2,
						items: [
							{
								lat: 4.60971,
								lon: -74.08175,
								accuracy: 10,
								distanciaTienda: null,
								record: {
									id: 1,
									record_date: '2026-10-18',
									record_time: '08:00:00',
									log_type: 'Comenzar Jornada',
									employee_id: {
										first_name: 'Ana',
										last_name: 'Gomez',
									},
								} as unknown as TimeRecordDto,
							},
						],
					},
				],
			},
		],
	};

	it('does not render date sections when collapsed by default', () => {
		render(
			<MonitoreoLocalizacionTiendaAccordion
				storeGroup={mockStoreGroup}
				defaultExpanded={false}
			/>,
		);

		// Store header is visible
		expect(screen.getByText('Tienda Norte')).toBeInTheDocument();
		// Inner employee cards / sections are NOT mounted in DOM before expanding
		expect(screen.queryByText('Ana Gomez')).not.toBeInTheDocument();
	});

	it('renders inner dates and cards when clicked to expand', () => {
		render(
			<MonitoreoLocalizacionTiendaAccordion
				storeGroup={mockStoreGroup}
				defaultExpanded={false}
			/>,
		);

		// Click the store summary to expand
		const summary = screen.getByText('Tienda Norte');
		fireEvent.click(summary);

		// Inner records now mount
		expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
	});
});
