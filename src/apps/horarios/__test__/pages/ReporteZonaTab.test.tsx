import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '../utils/test-utils';

const agregado = vi.fn();
const exportar = vi.fn();
const listarZonas = vi.fn();
vi.mock('@/apps/horarios/api/directus/reportesHorasExtras', () => ({
	agregadoHorasExtras: (f: unknown, g: string[]) => agregado(f, g),
	listarZonas: () => listarZonas(),
}));
vi.mock('@/apps/horarios/api/directus/readBulk', () => ({
	getEmpleadosBulk: async () => [
		{ id: '7', nombre: 'ANA PÉREZ', documento: '107', storeId: 26 },
		{ id: '8', nombre: 'BETO RUIZ', documento: '108', storeId: 26 },
		{ id: '9', nombre: 'LUZ MORA', documento: '109', storeId: 30 },
		{ id: '10', nombre: 'SIN HORAS', documento: '110', storeId: 30 },
	],
}));
vi.mock('@/apps/horarios/api/directus/read', () => ({
	STORE_PRUEBAS: 90,
	getStores: async () => [
		{ id: 26, name: 'Ipiales' },
		{ id: 30, name: 'Pasto' },
		{ id: 40, name: 'Pereira' },
	],
}));
// jsdom no mide el SVG: la gráfica se sustituye por sus datos.
vi.mock('@mui/x-charts/BarChart', () => ({
	BarChart: ({ series }: { series: { data: number[] }[] }) => <div data-testid="grafica">{series[0].data.join(',')}</div>,
}));
vi.mock('@/apps/horarios/utils/exportarReporteHorasExtras', () => ({ exportarReporteZonaExcel: (a: unknown) => exportar(a) }));
vi.mock('@/apps/horarios/hooks/useAvisos', () => ({ useAvisos: () => ({ showSnackbar: vi.fn() }) }));
vi.mock('@/apps/horarios/utils/timeSync', () => ({ getRealColombiaTime: () => dayjs('2026-10-28T10:00:00') }));

import ReporteZonaTab from '@/apps/horarios/pages/reporte/ReporteZonaTab';

const fila = (storeId: number, empleadoId: number, fecha: string, minutos: number, registros = 1) => ({
	storeId,
	empleadoId,
	fecha,
	minutos,
	registros,
	periodoId: null,
	estado: null,
});

beforeEach(() => {
	vi.clearAllMocks();
	listarZonas.mockResolvedValue([
		{ id: 'Cafetera', nombre: 'Cafetera', tiendas: [40] },
		{ id: 'Narino', nombre: 'Narino', tiendas: [26, 30] },
	]);
	agregado.mockImplementation(async (_f: unknown, g: string[]) =>
		g.includes('employee_id')
			? [
					fila(26, 7, '2026-10-20', 60), // martes
					fila(26, 7, '2026-10-25', 120), // domingo
					fila(26, 8, '2026-10-20', 30),
					fila(30, 9, '2026-10-21', 60), // miércoles
				]
			: [{ ...fila(26, 0, '', 140), empleadoId: null, fecha: null }], // rango anterior: solo Ipiales
	);
});

const montar = (tiendasJefe: number[] | null) =>
	render(<ReporteZonaTab tiendasJefe={tiendasJefe} />, { wrapper: createQueryWrapper() });
const tabla = () => screen.getByRole('table', { name: 'Horas extras por tienda' });
const celdas = (nombre: RegExp) =>
	within(within(tabla()).getByRole('row', { name: nombre })).getAllByRole('cell').map((c) => c.textContent);
const kpi = (titulo: string) => screen.getByText(titulo).parentElement!.textContent;
/** Espera a que cargue (aparecen las sub-pestañas). */
const cargado = () => screen.findByRole('tab', { name: /Tiendas/ });
const irATiendas = async () => {
	fireEvent.click(await cargado());
	return tabla();
};

describe('Reportes · Horas extras por zona', () => {
	it('jefe: Resumen (KPIs, día de la semana, top) y Tiendas (ranking sin variación)', async () => {
		montar([26, 30]);
		await cargado();
		// Abre en Resumen: sin la tabla de tiendas.
		expect(screen.queryByRole('table', { name: 'Horas extras por tienda' })).toBeNull();
		expect(screen.queryByLabelText('Zona')).not.toBeInTheDocument();
		// Solo aprobadas, solo sus tiendas, mes en curso; sin consultar el rango anterior.
		expect(agregado).toHaveBeenCalledWith(
			{ estados: ['aprobada'], tiendas: [26, 30], desde: '2026-10-01', hasta: '2026-10-28' },
			['store_id', 'employee_id', 'work_date'],
		);
		expect(agregado).toHaveBeenCalledTimes(1);

		expect(kpi('Horas extras')).toContain('4 h 30 min');
		expect(kpi('Personas con horas')).toContain('3');
		expect(kpi('Horas por persona')).toContain('1 h 8 min'); // 270 min / 4 de plantilla ≈ 67,5

		expect(screen.getByTestId('grafica').textContent).toBe('0,1.5,1,0,0,0,2');
		const top = within(screen.getByRole('list', { name: 'Personas con más horas' })).getAllByRole('listitem');
		expect(top[0].textContent).toContain('Ana Pérez');
		expect(top[0].textContent).toContain('3 h');

		await irATiendas();
		expect(screen.getByRole('tab', { name: 'Tiendas (2)' })).toHaveAttribute('aria-selected', 'true');
		// Ipiales primero (más horas): 210 min, 78 %, 2 personas.
		expect(celdas(/Ipiales/)).toEqual(['', 'Ipiales', '3 h 30 min', '78 %', '2']);
	});

	it('detalle: tienda (registros y por persona) → personas → días plegados', async () => {
		montar([26, 30]);
		await irATiendas();
		fireEvent.click(screen.getByRole('button', { name: 'Ver personas de Ipiales' }));
		const personas = await screen.findByRole('table', { name: 'Personas de Ipiales' });
		expect(screen.getByText('3 registros · 1 h 45 min por persona de plantilla')).toBeInTheDocument();
		const ana = within(personas).getByRole('row', { name: /Ana Pérez/ });
		expect(within(ana).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Ana Pérez', '107', '3 h', '2 días']);
		expect(within(personas).queryByText(/20\/10: 1 h/)).toBeNull();

		fireEvent.click(within(ana).getByRole('button', { name: 'Ver días de Ana Pérez' }));
		expect(within(personas).getByText(/20\/10: 1 h/)).toBeInTheDocument();
		expect(within(personas).getByText(/25\/10: 2 h/)).toBeInTheDocument();
	});

	it('comercial: elige la zona (sus tiendas) y exporta con su nombre', async () => {
		montar(null);
		await cargado();
		// "Todas las zonas": sin filtro de tiendas.
		expect(agregado.mock.calls[0][0].tiendas).toEqual([]);
		fireEvent.mouseDown(screen.getByLabelText('Zona'));
		fireEvent.click(await screen.findByRole('option', { name: 'Narino' }));
		await waitFor(() =>
			expect(agregado).toHaveBeenCalledWith(expect.objectContaining({ tiendas: [26, 30] }), ['store_id', 'employee_id', 'work_date']),
		);
		expect(screen.getByText(/por zona: Narino/)).toBeInTheDocument();
		await cargado();
		await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar a Excel' })).toBeEnabled());
		fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }));
		await waitFor(() => expect(exportar).toHaveBeenCalledTimes(1));
		expect(exportar.mock.calls[0][0]).toMatchObject({ zona: 'Narino', desde: '2026-10-01', hasta: '2026-10-28' });
	});

	it('filtro de tienda: el jefe elige una de sus tiendas', async () => {
		montar([26, 30]);
		await cargado();
		fireEvent.mouseDown(screen.getByLabelText('Tienda'));
		const opciones = screen.getAllByRole('option').map((o) => o.textContent);
		expect(opciones).toEqual(['Todas las tiendas', 'Ipiales', 'Pasto']);
		fireEvent.click(screen.getByRole('option', { name: 'Pasto' }));
		await waitFor(() =>
			expect(agregado).toHaveBeenCalledWith(expect.objectContaining({ tiendas: [30] }), ['store_id', 'employee_id', 'work_date']),
		);
		expect(screen.getByText(/por zona: Narino, tienda Pasto/)).toBeInTheDocument();
	});

	it('comercial: las tiendas del filtro son las de la zona elegida', async () => {
		montar(null);
		await cargado();
		fireEvent.mouseDown(screen.getByLabelText('Zona'));
		fireEvent.click(await screen.findByRole('option', { name: 'Narino' }));
		fireEvent.mouseDown(screen.getByLabelText('Tienda'));
		expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas las tiendas', 'Ipiales', 'Pasto']);
	});

	it('comercial: avisa si ninguna tienda tiene zona', async () => {
		listarZonas.mockResolvedValue([]);
		montar(null);
		expect(await screen.findByText(/Ninguna tienda tiene zona asignada/)).toBeInTheDocument();
	});

	it('jefe: el título lleva la zona de sus tiendas', async () => {
		montar([26, 30]);
		expect(await screen.findByText(/por zona: Narino$/)).toBeInTheDocument();
	});

	it('jefe sin tiendas: aviso y sin consultas', async () => {
		montar([]);
		expect(await screen.findByText('No tienes tiendas asignadas.')).toBeInTheDocument();
		expect(agregado).not.toHaveBeenCalled();
	});
});
