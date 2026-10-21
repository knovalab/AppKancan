import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '../../utils/test-utils';

const listarPeriodos = vi.fn();
const totalesVinculados = vi.fn();
const crearPeriodo = vi.fn();
const listarHorasExtras = vi.fn();
const showSnackbar = vi.fn();
vi.mock('@/apps/horarios/api/directus/periodos', () => ({
	listarPeriodos: () => listarPeriodos(),
	totalesVinculados: () => totalesVinculados(),
	crearPeriodo: (d: unknown) => crearPeriodo(d),
}));
vi.mock('@/apps/horarios/api/directus/horasExtras', () => ({
	listarHorasExtras: (f: unknown) => listarHorasExtras(f),
}));
vi.mock('@/apps/horarios/hooks/useAvisos', () => ({ useAvisos: () => ({ showSnackbar }) }));
vi.mock('@/apps/horarios/utils/timeSync', () => ({ getRealColombiaTime: () => dayjs('2026-10-21T10:00:00') }));

import PeriodosPage from '@/apps/horarios/pages/horas-extras/PeriodosPage';

const liquidado = { id: 1, name: 'Octubre 1', start_date: '2026-10-01', end_date: '2026-10-10', status: 'liquidado', liquidacion_at: '2026-10-11T15:00:00Z' };
const abierto = { id: 2, start_date: '2026-10-11', end_date: '2026-10-25', status: 'preliquidado' };
const hora = (id: number, work_date: string, minutes: number, extra = {}) => ({
	id,
	employee_id: { id: id + 100, first_name: `Emp${id}`, last_name: 'X', store_id: 26 },
	store_id: { id: 26, name: 'Ipiales' },
	work_date,
	minutes,
	status: 'aprobada',
	...extra,
});
// Aprobadas sin periodo: una del periodo abierto y una rezagada (antes del inicio).
const porPagar = [hora(1, '2026-10-12', 60), hora(2, '2026-10-05', 30)];
const vinculadas = [hora(3, '2026-10-02', 90, { period_id: 1 }), hora(4, '2026-09-28', 30, { period_id: 1 })];

const montar = (url = '/horarios/horas-extras/periodos') => {
	const Query = createQueryWrapper();
	return render(<PeriodosPage />, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<MemoryRouter initialEntries={[url]}>
				<Query>{children}</Query>
			</MemoryRouter>
		),
	});
};

beforeEach(() => {
	vi.clearAllMocks();
	listarPeriodos.mockResolvedValue([abierto, liquidado]);
	totalesVinculados.mockResolvedValue(new Map([[1, { horas: 2, minutos: 120 }]]));
	listarHorasExtras.mockImplementation(async (f: { periodo?: number }) => (f.periodo === 1 ? vinculadas : porPagar));
	crearPeriodo.mockResolvedValue({});
});

describe('PeriodosPage', () => {
	it('lista los periodos con totales: calculados si preliquidado, agregados si liquidado', async () => {
		montar();
		const fila = await screen.findByRole('row', { name: /11\/10\/2026 al 25\/10\/2026/ });
		expect(within(fila).getByText('Preliquidado')).toBeInTheDocument();
		expect(within(fila).getByText('15')).toBeInTheDocument(); // días
		expect(within(fila).getByText('1 h 30 min')).toBeInTheDocument(); // 60 + 30 rezagada
		expect(within(fila).getByText('Sin nombre')).toBeInTheDocument();
		const otra = screen.getByRole('row', { name: /Octubre 1, del 01\/10\/2026 al 10\/10\/2026/ });
		expect(within(otra).getByText('Octubre 1')).toBeInTheDocument();
		expect(within(otra).getByText('Liquidado')).toBeInTheDocument();
		expect(within(otra).getByText('2 h')).toBeInTheDocument();
	});

	it('?periodo= abre el detalle; un liquidado separa del periodo y rezagadas', async () => {
		montar('/horarios/horas-extras/periodos?periodo=1');
		const dialogo = await screen.findByRole('dialog', { name: /Octubre 1.*01\/10\/2026 al 10\/10\/2026/ });
		await within(dialogo).findByText('Emp3 X');
		expect(within(dialogo).getByText(/Del periodo · 1 · 1 h 30 min/)).toBeInTheDocument();
		expect(within(dialogo).getByText(/Rezagadas · 1 · 30 min/)).toBeInTheDocument();
		expect(listarHorasExtras).toHaveBeenCalledWith({ periodo: 1 });

		fireEvent.click(within(dialogo).getByRole('tab', { name: 'Resumen por empleado' }));
		expect(within(dialogo).getByRole('table', { name: 'Resumen por empleado' })).toBeInTheDocument();
		expect(within(dialogo).getAllByRole('row')).toHaveLength(3); // cabecera + 2 empleados
	});

	it('abrir un preliquidado desde la tabla muestra la vista previa con rezagadas', async () => {
		montar();
		fireEvent.click(await screen.findByRole('row', { name: /11\/10\/2026 al 25\/10\/2026/ }));
		const dialogo = await screen.findByRole('dialog');
		expect(within(dialogo).getByText(/Vista previa/)).toBeInTheDocument();
		await within(dialogo).findByText('Emp1 X');
		expect(within(dialogo).getByText('Emp2 X')).toBeInTheDocument();
		expect(within(dialogo).getByText(/Rezagadas · 1/)).toBeInTheDocument();
	});

	it('crear periodo: inicio fijo al día siguiente del último y accesos rápidos', async () => {
		montar();
		await screen.findByRole('row', { name: /11\/10\/2026 al 25\/10\/2026/ });
		fireEvent.click(screen.getByRole('button', { name: 'Crear periodo' }));
		const dialogo = await screen.findByRole('dialog');
		const inicio = within(dialogo).getByLabelText('Inicio');
		expect(inicio).toHaveValue('2026-10-26');
		expect(inicio).toBeDisabled();

		fireEvent.change(within(dialogo).getByLabelText('Nombre (opcional)'), { target: { value: '  Octubre 2  ' } });
		fireEvent.click(within(dialogo).getByRole('button', { name: '5 días' }));
		expect(within(dialogo).getByLabelText('Fin')).toHaveValue('2026-10-30');
		expect(within(dialogo).getByText('5 días', { selector: 'p' })).toBeInTheDocument();

		fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear periodo' }));
		await waitFor(() => expect(crearPeriodo).toHaveBeenCalledWith({ name: 'Octubre 2', start_date: '2026-10-26', end_date: '2026-10-30' }));
		expect(showSnackbar).toHaveBeenCalledWith('Periodo creado', 'success');
	});

	it('no crea si el fin es anterior al inicio', async () => {
		listarPeriodos.mockResolvedValue([]);
		montar();
		await screen.findByText(/Aún no hay periodos/);
		fireEvent.click(screen.getByRole('button', { name: 'Crear periodo' }));
		const dialogo = await screen.findByRole('dialog');
		expect(within(dialogo).getByLabelText('Inicio')).toBeEnabled(); // primer periodo: inicio libre
		fireEvent.change(within(dialogo).getByLabelText('Fin'), { target: { value: '2026-10-01' } });
		fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear periodo' }));
		expect(await within(dialogo).findByText(/anterior al inicio/)).toBeInTheDocument();
		expect(crearPeriodo).not.toHaveBeenCalled();
	});
});
