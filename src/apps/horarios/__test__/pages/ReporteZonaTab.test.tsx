import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '../utils/test-utils';

const agregado = vi.fn();
const exportar = vi.fn();
const listarZonas = vi.fn();
vi.mock('@/apps/horarios/api/directus/reportesHorasExtras', () => ({
	JEFES_ZONA: ['u1', 'u2'],
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
		{ id: 'u1', nombre: 'Cafetera', tiendas: [40] },
		{ id: 'u2', nombre: 'Narino', tiendas: [26, 30] },
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
// La primera coincidencia es la tarjeta (la cabecera de la tabla viene después).
const kpi = (titulo: string) => screen.getAllByText(titulo)[0].parentElement!.textContent;

describe('Reportes · Horas extras por zona', () => {
	it('jefe: sus tiendas, KPIs, ranking con variación, día de la semana y top personas', async () => {
		montar([26, 30]);
		await screen.findByRole('table', { name: 'Horas extras por tienda' });
		expect(screen.queryByLabelText('Zona')).not.toBeInTheDocument();
		// Solo aprobadas, solo sus tiendas, mes en curso; y el rango anterior para la variación.
		expect(agregado).toHaveBeenCalledWith(
			{ estados: ['aprobada'], tiendas: [26, 30], desde: '2026-10-01', hasta: '2026-10-28' },
			['store_id', 'employee_id', 'work_date'],
		);
		expect(agregado).toHaveBeenCalledWith({ estados: ['aprobada'], tiendas: [26, 30], desde: '2026-09-03', hasta: '2026-09-30' }, ['store_id']);

		expect(kpi('Horas extras')).toContain('4 h 30 min');
		expect(kpi('Personas con horas')).toContain('3');
		expect(kpi('Horas por persona')).toContain('1 h 8 min'); // 270 min / 4 de plantilla ≈ 67,5

		// Ipiales primero (más horas): 210 min, 78 %, +50 % frente a 140.
		expect(celdas(/Ipiales/)).toEqual(['', 'Ipiales', '3 h 30 min', '78 %', '3', '2', '1 h 45 min', '+50 %']);
		expect(celdas(/Pasto/)[7]).toBe('--'); // sin horas en el rango anterior

		expect(screen.getByTestId('grafica').textContent).toBe('0,1.5,1,0,0,0,2');
		const top = within(screen.getByRole('list', { name: 'Personas con más horas' })).getAllByRole('listitem');
		expect(top[0].textContent).toContain('Ana Pérez');
		expect(top[0].textContent).toContain('3 h');
	});

	it('detalle: tienda → personas → días', async () => {
		montar([26, 30]);
		await screen.findByRole('table', { name: 'Horas extras por tienda' });
		fireEvent.click(screen.getByRole('button', { name: 'Ver personas de Ipiales' }));
		const personas = await screen.findByRole('table', { name: 'Personas de Ipiales' });
		const ana = within(personas).getByRole('row', { name: /Ana Pérez/ });
		expect(within(ana).getAllByRole('cell').map((c) => c.textContent).slice(0, 3)).toEqual(['Ana Pérez', '107', '3 h']);
		expect(within(ana).getByText(/20\/10: 1 h/)).toBeInTheDocument();
		expect(within(ana).getByText(/25\/10: 2 h/)).toBeInTheDocument();
	});

	it('comercial: elige la zona (sus tiendas) y exporta con su nombre', async () => {
		montar(null);
		await screen.findByRole('table', { name: 'Horas extras por tienda' });
		// "Todas las zonas": sin filtro de tiendas.
		expect(agregado.mock.calls[0][0].tiendas).toEqual([]);
		fireEvent.mouseDown(screen.getByLabelText('Zona'));
		fireEvent.click(await screen.findByRole('option', { name: 'Narino' }));
		await waitFor(() =>
			expect(agregado).toHaveBeenCalledWith(expect.objectContaining({ tiendas: [26, 30] }), ['store_id', 'employee_id', 'work_date']),
		);
		expect(screen.getByText(/por zona: Narino/)).toBeInTheDocument();
		await screen.findByRole('table', { name: 'Horas extras por tienda' });
		await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar a Excel' })).toBeEnabled());
		fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }));
		await waitFor(() => expect(exportar).toHaveBeenCalledTimes(1));
		expect(exportar.mock.calls[0][0]).toMatchObject({ zona: 'Narino', desde: '2026-10-01', hasta: '2026-10-28' });
	});

	it('filtro de tienda: el jefe elige una de sus tiendas', async () => {
		montar([26, 30]);
		await screen.findByRole('table', { name: 'Horas extras por tienda' });
		fireEvent.mouseDown(screen.getByLabelText('Tienda'));
		const opciones = screen.getAllByRole('option').map((o) => o.textContent);
		expect(opciones).toEqual(['Todas las tiendas', 'Ipiales', 'Pasto']);
		fireEvent.click(screen.getByRole('option', { name: 'Pasto' }));
		await waitFor(() =>
			expect(agregado).toHaveBeenCalledWith(expect.objectContaining({ tiendas: [30] }), ['store_id', 'employee_id', 'work_date']),
		);
		expect(screen.getByText(/por zona: Mi zona, tienda Pasto/)).toBeInTheDocument();
	});

	it('comercial: las tiendas del filtro son las de la zona elegida', async () => {
		montar(null);
		await screen.findByRole('table', { name: 'Horas extras por tienda' });
		fireEvent.mouseDown(screen.getByLabelText('Zona'));
		fireEvent.click(await screen.findByRole('option', { name: 'Narino' }));
		fireEvent.mouseDown(screen.getByLabelText('Tienda'));
		expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas las tiendas', 'Ipiales', 'Pasto']);
	});

	it('comercial: avisa si no se pudieron leer todas las zonas (permiso de core_user_stores)', async () => {
		listarZonas.mockResolvedValue([{ id: 'u2', nombre: 'Narino', tiendas: [26, 30] }]);
		montar(null);
		expect(await screen.findByText(/Solo se cargaron 1 de 2 zonas/)).toBeInTheDocument();
	});

	it('jefe: no consulta zonas ni muestra el aviso', async () => {
		montar([26, 30]);
		await screen.findByRole('table', { name: 'Horas extras por tienda' });
		expect(listarZonas).not.toHaveBeenCalled();
		expect(screen.queryByText(/Solo se cargaron/)).not.toBeInTheDocument();
	});

	it('jefe sin tiendas: aviso y sin consultas', async () => {
		montar([]);
		expect(await screen.findByText('No tienes tiendas asignadas.')).toBeInTheDocument();
		expect(agregado).not.toHaveBeenCalled();
	});
});
