import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilaAgregada } from '@/apps/horarios/api/directus/reportesHorasExtras';
import { createQueryWrapper } from '../utils/test-utils';

type Filtros = { estados: string[]; conPeriodo?: boolean; desde?: string; tiendas?: number[] };
const agregadoHorasExtras = vi.fn();
vi.mock('@/apps/horarios/api/directus/reportesHorasExtras', async (original) => ({
	...(await original<typeof import('@/apps/horarios/api/directus/reportesHorasExtras')>()),
	agregadoHorasExtras: (f: Filtros, g: string[]) => agregadoHorasExtras(f, g),
	listarTiendasReporte: async () => [
		{ id: 26, name: 'Ipiales', company: 'Empresa A', zone: 'Narino' },
		{ id: 30, name: 'Pasto', company: 'Empresa B', zone: 'Narino' },
		{ id: 15, name: 'Cosmocentro', company: 'Empresa A', zone: 'Sur' },
	],
}));
vi.mock('@/apps/horarios/api/directus/periodos', () => ({
	listarPeriodosResumen: async () => [
		{ id: 2, name: 'Oct 2', start_date: '2026-10-11', end_date: '2026-10-25', status: 'preliquidado' },
		{ id: 1, name: 'Oct 1', start_date: '2026-10-01', end_date: '2026-10-10', status: 'liquidado' },
	],
}));
vi.mock('@mui/x-charts/BarChart', () => ({
	BarChart: ({ series, layout }: { series: { data: number[] }[]; layout: string }) => (
		<div data-testid="grafica">
			{layout}:{series[0].data.join(',')}
		</div>
	),
}));
vi.mock('@mui/x-charts/LineChart', () => ({
	LineChart: ({ series }: { series: { label: string; data: number[] }[] }) => (
		<div data-testid="tendencia">{series.map((x) => `${x.label}=${x.data.join(',')}`).join(';')}</div>
	),
}));
// El calendario consulta festivos en internet.
vi.mock('@/apps/horarios/components/reportes/DateRangeFilter', () => ({ default: () => <div>CALENDARIO</div> }));
vi.mock('@/apps/horarios/utils/timeSync', () => ({ getRealColombiaTime: () => dayjs('2026-10-28T10:00:00') }));

import ReporteGerencia from '@/apps/horarios/pages/reporte/gerencia/ReporteGerencia';

const fila = (f: Partial<FilaAgregada>): FilaAgregada => ({
	storeId: null,
	empleadoId: null,
	fecha: null,
	periodoId: null,
	estado: null,
	registros: 0,
	minutos: 0,
	...f,
});
const enRango = [
	fila({ storeId: 26, fecha: '2026-10-20', registros: 2, minutos: 120 }), // martes
	fila({ storeId: 30, fecha: '2026-10-21', registros: 1, minutos: 60 }),
	fila({ storeId: 15, fecha: '2026-10-21', registros: 1, minutos: 60 }),
];

beforeEach(() => {
	agregadoHorasExtras.mockImplementation(async (f: Filtros) => {
		if (f.estados[0] === 'pendiente') return [fila({ storeId: 26, registros: 1, minutos: 60 })];
		if (f.conPeriodo === true)
			return [
				fila({ periodoId: 1, storeId: 26, fecha: '2026-10-05', registros: 2, minutos: 120 }),
				fila({ periodoId: 1, storeId: 30, fecha: '2026-09-29', registros: 1, minutos: 30 }),
			];
		if (f.conPeriodo === false) return [fila({ storeId: 26, fecha: '2026-10-12', registros: 2, minutos: 90 })];
		return enRango.filter((r) => !f.tiendas?.length || (r.storeId != null && f.tiendas.includes(r.storeId)));
	});
});

const montar = async () => {
	render(<ReporteGerencia />, { wrapper: createQueryWrapper() });
	await screen.findByText('Total a liquidar');
};
// Título del KPI (un <p>; las cabeceras de tabla repiten algunos nombres).
const kpi = (titulo: string | RegExp) => screen.getByText(titulo, { selector: 'p' }).parentElement!.textContent;
const irAZona = async () => {
	fireEvent.click(screen.getByRole('tab', { name: 'Por zona' }));
	return screen.findByRole('region', { name: '¿Qué tiendas suman más horas?' });
};

describe('Reportes de gerencia · escritorio', () => {
	it('tiempo real: resumen del periodo actual, tabla de periodos, sin avisos ni descargas', async () => {
		await montar();
		expect(kpi('Total a liquidar')).toContain('2 h');
		expect(kpi('Pendientes de aprobación')).toContain('1 h');
		expect(screen.queryByRole('button', { name: /Exportar/ })).toBeNull();
		expect(screen.queryByText(/aviso|sin liquidar/i)).toBeNull();

		const tabla = screen.getByRole('table', { name: 'Horas extras por periodo' });
		fireEvent.click(within(tabla).getByRole('row', { name: /Oct 1/ }));
		expect(kpi('Total liquidado')).toContain('3 h'); // 2 h 30 min
		expect(kpi('Rezagadas')).toContain('30 min');
	});

	it('tiempo real: filtra por empresa', async () => {
		await montar();
		fireEvent.mouseDown(screen.getByLabelText('Empresa'));
		fireEvent.click(screen.getByRole('option', { name: 'Empresa B' }));
		await waitFor(() => expect(kpi('Total a liquidar')).toContain('0 min'));
		expect(kpi('Pendientes de aprobación')).toContain('0 min');
	});

	it('por zona: zonas con barras, ranking de tiendas sin variación ni personas', async () => {
		await montar();
		await irAZona();
		const zonas = screen.getByRole('region', { name: 'Horas por zona' });
		expect(within(zonas).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Narino: 3 h', 'Sur: 1 h']);
		expect(kpi(/Horas extras · todas las zonas/)).toContain('4 h');

		const filas = within(screen.getByRole('table', { name: 'Horas extras por tienda' }))
			.getAllByRole('row')
			.map((r) => within(r).queryAllByRole('cell').map((c) => c.textContent));
		expect(filas.slice(1)).toEqual([
			['Ipiales', 'Narino', '2 h', '50 %'],
			['Pasto', 'Narino', '1 h', '25 %'],
			['Cosmocentro', 'Sur', '1 h', '25 %'],
		]);
		expect(screen.queryByText(/Variación|frente al/)).toBeNull();
		expect(screen.getByTestId('grafica').textContent).toBe('vertical:0,2,2,0,0,0,0');
		expect(screen.queryByText(/persona|documento/i)).toBeNull();
		expect(screen.queryByRole('button', { name: /Exportar/ })).toBeNull();
	});

	it('por zona: elige por periodo (no calendario); arranca en el actual y consulta sus fechas', async () => {
		await montar();
		await irAZona();
		expect(screen.queryByText('CALENDARIO')).toBeNull();
		// Hoy (28/10) no cae en ningún periodo: toma el más reciente.
		expect(agregadoHorasExtras).toHaveBeenCalledWith(
			expect.objectContaining({ desde: '2026-10-11', hasta: '2026-10-25' }),
			['store_id', 'work_date'],
		);
		fireEvent.mouseDown(screen.getByLabelText('Periodo'));
		fireEvent.click(screen.getByRole('option', { name: 'Oct 1 (01/10 al 10/10)' }));
		await waitFor(() =>
			expect(agregadoHorasExtras).toHaveBeenCalledWith(
				expect.objectContaining({ desde: '2026-10-01', hasta: '2026-10-10' }),
				['store_id', 'work_date'],
			),
		);
	});

	it('por zona: tocar una zona la abre (solo sus tiendas, sin columna Zona)', async () => {
		await montar();
		await irAZona();
		fireEvent.click(screen.getByRole('button', { name: 'Narino: 3 h' }));
		await waitFor(() =>
			expect(within(screen.getByRole('table', { name: 'Horas extras por tienda' })).getAllByRole('row')).toHaveLength(3),
		);
		expect(screen.queryByRole('columnheader', { name: 'Zona' })).toBeNull();
		expect(screen.queryByRole('region', { name: 'Horas por zona' })).toBeNull();
		expect(agregadoHorasExtras).toHaveBeenCalledWith(expect.objectContaining({ tiendas: [26, 30] }), ['store_id', 'work_date']);
	});

	it('tendencia: horas por periodo (total y por zona) y mapa de calor día × zona', async () => {
		await montar();
		fireEvent.click(screen.getByRole('tab', { name: 'Tendencia' }));
		// Del más antiguo al más reciente: Oct 1 (2 h 30 min) y Oct 2 (1 h 30 min), todo en Narino.
		expect(await screen.findByTestId('tendencia')).toHaveTextContent('Total=2.5,1.5;Narino=2.5,1.5');
		const calor = await screen.findByRole('table', { name: 'Horas por zona y día de la semana' });
		const filas = within(calor)
			.getAllByRole('row')
			.slice(1)
			.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
		expect(filas).toEqual([
			['Narino', '--', '2 h', '1 h', '--', '--', '--', '--'],
			['Sur', '--', '--', '1 h', '--', '--', '--', '--'],
		]);
	});

	it('por zona: también por mes calendario o por rango libre', async () => {
		await montar();
		await irAZona();
		fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
		// Mes en curso: del 1 a hoy (28/10).
		await waitFor(() =>
			expect(agregadoHorasExtras).toHaveBeenCalledWith(
				expect.objectContaining({ desde: '2026-10-01', hasta: '2026-10-28' }),
				['store_id', 'work_date'],
			),
		);
		fireEvent.mouseDown(screen.getByLabelText('Mes'));
		fireEvent.click(screen.getByRole('option', { name: 'Septiembre 2026' }));
		await waitFor(() =>
			expect(agregadoHorasExtras).toHaveBeenCalledWith(
				expect.objectContaining({ desde: '2026-09-01', hasta: '2026-09-30' }),
				['store_id', 'work_date'],
			),
		);
		fireEvent.click(screen.getByRole('button', { name: 'Rango' }));
		expect(screen.getByText('CALENDARIO')).toBeInTheDocument();
	});


	it('por tienda: tabla de tienda, zona y horas; filtro de zona y periodo o mes', async () => {
		await montar();
		fireEvent.click(screen.getByRole('tab', { name: 'Por tienda' }));
		const tabla = await screen.findByRole('table', { name: 'Horas extras por tienda' });
		expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Tienda', 'Zona', 'Horas']);
		// De más a menos horas.
		const filas = within(tabla)
			.getAllByRole('row')
			.slice(1)
			.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
		expect(filas).toEqual([
			['Ipiales', 'Narino', '2 h'],
			['Pasto', 'Narino', '1 h'],
			['Cosmocentro', 'Sur', '1 h'],
		]);
		expect(screen.queryByText(/Cantidad/)).toBeNull();
		// Solo periodo o mes: sin rango libre ni variación.
		expect(screen.queryByRole('button', { name: 'Rango' })).toBeNull();
		expect(screen.queryByText(/Variación/)).toBeNull();
		expect(screen.queryByRole('button', { name: /Exportar/ })).toBeNull();

		fireEvent.mouseDown(screen.getByLabelText('Zona'));
		fireEvent.click(screen.getByRole('option', { name: 'Sur' }));
		await waitFor(() =>
			expect(agregadoHorasExtras).toHaveBeenCalledWith(expect.objectContaining({ tiendas: [15] }), ['store_id', 'work_date']),
		);
		fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
		await waitFor(() =>
			expect(agregadoHorasExtras).toHaveBeenCalledWith(
				expect.objectContaining({ tiendas: [15], desde: '2026-10-01', hasta: '2026-10-28' }),
				['store_id', 'work_date'],
			),
		);
	});

	it('tendencia: solo por periodo, sin interruptor de meses ni calendario', async () => {
		await montar();
		fireEvent.click(screen.getByRole('tab', { name: 'Tendencia' }));
		await screen.findByTestId('tendencia');
		expect(screen.queryByRole('button', { name: 'Meses' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Mes' })).toBeNull();
		expect(screen.queryByText('CALENDARIO')).toBeNull();
		expect(screen.getByLabelText('Periodo')).toBeInTheDocument();
	});

	it('nunca agrupa por persona (la política de gerencia no lee employee_id)', async () => {
		await montar();
		await irAZona();
		for (const [, agrupar] of agregadoHorasExtras.mock.calls) expect(agrupar).not.toContain('employee_id');
	});
});

describe('Reportes de gerencia · teléfono', () => {
	const original = window.matchMedia;
	beforeEach(() => {
		// Todas las consultas `down(...)` coinciden: ancho de teléfono.
		window.matchMedia = vi.fn().mockImplementation((media: string) => ({
			matches: true,
			media,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: () => false,
		}));
	});
	afterEach(() => {
		window.matchMedia = original;
	});

	it('tarjetas en vez de tablas, filtros plegados y barras horizontales', async () => {
		await montar();
		const resumen = await screen.findByRole('button', { name: 'Todas las empresas · Oct 2' });
		expect(resumen).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('table')).toBeNull();
		// Tocar la tarjeta de un periodo lo elige.
		fireEvent.click(screen.getByRole('button', { name: 'Oct 1, 3 h' }));
		expect(kpi('Total liquidado')).toContain('3 h');

		await irAZona();
		expect(screen.queryByRole('table')).toBeNull();
		expect(screen.getByText('Ipiales')).toBeInTheDocument();
		expect(screen.getByTestId('grafica').textContent).toMatch(/^horizontal:/);
	});

	it('tendencia: solo el total y el mapa como tarjetas con el día más cargado', async () => {
		await montar();
		fireEvent.click(screen.getByRole('tab', { name: 'Tendencia' }));
		expect(await screen.findByTestId('tendencia')).toHaveTextContent(/^Total=2.5,1.5$/);
		await screen.findByText('Narino');
		expect(screen.queryByRole('table')).toBeNull();
		expect(screen.getAllByText(/Día más cargado/)[0].textContent).toBe('Día más cargado: Mar · 2 h');
	});
});
