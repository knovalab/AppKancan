import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '../utils/test-utils';

const agregadoHorasExtras = vi.fn();
const listarHorasExtras = vi.fn();
const listarPeriodos = vi.fn();
const exportar = vi.fn();
vi.mock('@/apps/horarios/api/directus/reportesHorasExtras', () => ({
	agregadoHorasExtras: (f: { estados: string[] }, g: unknown) => agregadoHorasExtras(f, g),
}));
vi.mock('@/apps/horarios/api/directus/horasExtras', () => ({ listarHorasExtras: (f: unknown) => listarHorasExtras(f) }));
vi.mock('@/apps/horarios/api/directus/periodos', () => ({
	listarPeriodos: () => listarPeriodos(),
	totalesVinculados: async () => new Map(),
}));
vi.mock('@/apps/horarios/api/directus/read', () => ({
	STORE_PRUEBAS: 90,
	getStores: async () => [
		{ id: 26, name: 'Ipiales', company: 'Empresa A' },
		{ id: 30, name: 'Pasto', company: 'Empresa B' },
	],
}));
vi.mock('@/apps/horarios/utils/exportarReporteHorasExtras', () => ({
	exportarReporteTiempoRealExcel: (r: unknown, tiendaDe: unknown, e: unknown, t: unknown) => exportar(r, tiendaDe, e, t),
}));
vi.mock('@/apps/horarios/hooks/useAvisos', () => ({ useAvisos: () => ({ showSnackbar: vi.fn() }) }));
vi.mock('@/apps/horarios/utils/timeSync', () => ({ getRealColombiaTime: () => dayjs('2026-10-28T10:00:00') }));

import ReporteHorasExtrasTab from '@/apps/horarios/pages/reporte/ReporteHorasExtrasTab';

const liquidado = { id: 1, name: 'Oct 1', start_date: '2026-10-01', end_date: '2026-10-10', status: 'liquidado', liquidacion_at: '2026-10-11T15:00:00Z' };
// Terminó el 25/10 y hoy es 28/10: vencido sin liquidar.
const abierto = { id: 2, name: 'Oct 2', start_date: '2026-10-11', end_date: '2026-10-25', status: 'preliquidado' };

beforeEach(() => {
	vi.clearAllMocks();
	listarPeriodos.mockResolvedValue([abierto, liquidado]);
	agregadoHorasExtras.mockImplementation(async (f: { estados: string[] }) =>
		f.estados[0] === 'pendiente'
			? [
					{ storeId: 26, fecha: '2026-10-27', registros: 1, minutos: 60, periodoId: null, estado: null },
					{ storeId: 30, fecha: '2026-10-10', registros: 2, minutos: 120, periodoId: null, estado: null }, // >7 días
				]
			: [
					{ periodoId: 1, storeId: 26, fecha: '2026-10-05', registros: 2, minutos: 120, estado: null },
					{ periodoId: 1, storeId: 30, fecha: '2026-09-29', registros: 1, minutos: 30, estado: null },
				],
	);
	listarHorasExtras.mockResolvedValue([
		{ id: 9, work_date: '2026-10-12', status: 'aprobada', minutes: 90, store_id: 26, employee_id: 7 },
	]);
});

const montar = async () => {
	render(<ReporteHorasExtrasTab />, { wrapper: createQueryWrapper() });
	return screen.findByText('Horas extras en tiempo real');
};
const tarjeta = (titulo: string) => screen.getByText(titulo).parentElement!.textContent;
/** "Todos los periodos" está plegado: se abre para leer la tabla. */
const tablaPeriodos = () => {
	fireEvent.click(screen.getByRole('button', { name: /Todos los periodos/ }));
	return screen.getByRole('table', { name: 'Horas extras por periodo' });
};
const filasTiendas = () =>
	within(screen.getByRole('table', { name: 'Horas extras por tienda' }))
		.getAllByRole('row')
		.slice(1)
		.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
const elegirPeriodo = (nombre: RegExp) => {
	fireEvent.mouseDown(screen.getByLabelText('Periodo'));
	fireEvent.click(screen.getByRole('option', { name: nombre }));
};
const botonExportar = () => screen.getByRole('button', { name: 'Exportar a Excel' });

describe('Reportes · Horas extras en tiempo real', () => {
	it('abre en el periodo actual con tarjetas, avisos agrupados y todos los periodos plegados', async () => {
		await montar();
		// Periodo actual: el preliquidado más reciente (hoy cae después de todos).
		expect(tarjeta('Aprobadas por vincular')).toContain('1 h 30 min');
		expect(tarjeta('Pendientes de aprobación')).toContain('3 h');
		// Los avisos van en un solo bloque, plegado.
		expect(screen.getByText('2 avisos')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
		expect(screen.getByText(/1 periodo terminó y sigue sin liquidar: Oct 2/)).toBeVisible();
		expect(screen.getByText(/2 horas extras llevan más de 7 días pendientes/)).toBeVisible();

		expect(screen.queryByRole('table', { name: 'Horas extras por periodo' })).toBeNull();
		const fila = within(tablaPeriodos()).getByRole('row', { name: /Oct 1/ });
		expect(within(fila).getAllByRole('cell').map((c) => c.textContent)).toEqual([
			'Oct 1',
			'01/10/2026 al 10/10/2026',
			'Liquidado',
			'2 h',
			'30 min',
			'2 h 30 min',
			expect.stringMatching(/11\/10\/2026/),
		]);
		// Solo aprobadas: los agregados se piden por estado.
		expect(agregadoHorasExtras).toHaveBeenCalledWith({ estados: ['aprobada'], conPeriodo: true }, ['period_id', 'store_id', 'work_date']);
	});

	it('detalle por tienda del periodo elegido: suma lo mismo que el total', async () => {
		await montar();
		expect(filasTiendas()).toEqual([['Ipiales', 'Empresa A', '1 h 30 min', '0 min', '1 h 30 min']]);

		elegirPeriodo(/Oct 1/);
		expect(tarjeta('Total liquidado')).toContain('2 h 30 min');
		expect(filasTiendas()).toEqual([
			['Ipiales', 'Empresa A', '2 h', '0 min', '2 h'],
			['Pasto', 'Empresa B', '0 min', '30 min', '30 min'],
		]);
	});

	it('solo exporta periodos liquidados', async () => {
		await montar();
		// Periodo actual: preliquidado.
		expect(botonExportar()).toBeDisabled();

		elegirPeriodo(/Oct 1/);
		expect(botonExportar()).toBeEnabled();
		fireEvent.click(botonExportar());
		await waitFor(() => expect(exportar).toHaveBeenCalledTimes(1));
		const [r, tiendaDe] = exportar.mock.calls[0];
		expect(r.periodo.id).toBe(1);
		expect(r.tiendas.map((t: { storeId: number }) => t.storeId)).toEqual([26, 30]);
		expect(tiendaDe(30)).toMatchObject({ name: 'Pasto', company: 'Empresa B' });
	});

	it('filtra por empresa y exporta lo filtrado', async () => {
		await montar();
		fireEvent.mouseDown(screen.getByLabelText('Empresa'));
		fireEvent.click(screen.getByRole('option', { name: 'Empresa B' }));
		await waitFor(() => expect(tarjeta('Pendientes de aprobación')).toContain('2 h'));
		// El preliquidado no tiene horas de Pasto.
		expect(screen.getByText('No hay horas aprobadas en este periodo con estos filtros.')).toBeInTheDocument();
		const fila = within(tablaPeriodos()).getByRole('row', { name: /Oct 1/ });
		expect(within(fila).getAllByRole('cell')[5].textContent).toBe('30 min'); // solo la rezagada de Pasto

		elegirPeriodo(/Oct 1/);
		expect(filasTiendas()).toEqual([['Pasto', 'Empresa B', '0 min', '30 min', '30 min']]);
		fireEvent.click(botonExportar());
		await waitFor(() => expect(exportar).toHaveBeenCalledTimes(1));
		expect(exportar.mock.calls[0].slice(2)).toEqual(['Empresa B', '']);
	});

	it('filtro de tienda: opciones según la empresa y totales solo de esa tienda', async () => {
		await montar();
		fireEvent.mouseDown(screen.getByLabelText('Empresa'));
		fireEvent.click(screen.getByRole('option', { name: 'Empresa A' }));
		fireEvent.mouseDown(screen.getByLabelText('Tienda'));
		expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas las tiendas', 'Ipiales']);
		fireEvent.click(screen.getByRole('option', { name: 'Ipiales' }));
		await waitFor(() => expect(tarjeta('Pendientes de aprobación')).toContain('1 h'));
		const fila = within(tablaPeriodos()).getByRole('row', { name: /Oct 1/ });
		expect(within(fila).getAllByRole('cell')[5].textContent).toBe('2 h');

		elegirPeriodo(/Oct 1/);
		fireEvent.click(botonExportar());
		await waitFor(() => expect(exportar).toHaveBeenCalledTimes(1));
		expect(exportar.mock.calls[0].slice(2)).toEqual(['Empresa A', 'Ipiales']);
	});
});
