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
	getStores: async () => [
		{ id: 26, name: 'Ipiales', company: 'Empresa A' },
		{ id: 30, name: 'Pasto', company: 'Empresa B' },
	],
}));
vi.mock('@/apps/horarios/utils/exportarReporteHorasExtras', () => ({
	exportarReporteTiempoRealExcel: (r: unknown, e: unknown) => exportar(r, e),
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

describe('Reportes · Horas extras en tiempo real', () => {
	it('abre en el periodo actual con tarjetas, alertas y tabla por periodo', async () => {
		await montar();
		// Periodo actual: el preliquidado más reciente (hoy cae después de todos).
		expect(tarjeta('Aprobadas por vincular')).toContain('1 h 30 min');
		expect(tarjeta('Pendientes de aprobación')).toContain('3 h');
		expect(screen.getByText(/1 periodo terminó y sigue sin liquidar: Oct 2/)).toBeInTheDocument();
		expect(screen.getByText(/2 horas extras llevan más de 7 días pendientes/)).toBeInTheDocument();

		const fila = within(screen.getByRole('table', { name: 'Horas extras por periodo' })).getByRole('row', { name: /Oct 1/ });
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

	it('filtra por empresa y exporta lo filtrado', async () => {
		await montar();
		fireEvent.mouseDown(screen.getByLabelText('Empresa'));
		fireEvent.click(screen.getByRole('option', { name: 'Empresa B' }));
		await waitFor(() => expect(tarjeta('Pendientes de aprobación')).toContain('2 h'));
		const fila = within(screen.getByRole('table', { name: 'Horas extras por periodo' })).getByRole('row', { name: /Oct 1/ });
		expect(within(fila).getAllByRole('cell')[5].textContent).toBe('30 min'); // solo la rezagada de Pasto

		fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }));
		await waitFor(() => expect(exportar).toHaveBeenCalledTimes(1));
		expect(exportar.mock.calls[0][1]).toBe('Empresa B');
	});
});
