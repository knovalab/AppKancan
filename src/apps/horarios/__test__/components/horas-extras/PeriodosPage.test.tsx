import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '../../utils/test-utils';

const listarPeriodos = vi.fn();
const totalesVinculados = vi.fn();
const crearPeriodo = vi.fn();
const liquidarPeriodo = vi.fn();
const listarHorasExtras = vi.fn();
const showSnackbar = vi.fn();
vi.mock('@/apps/horarios/api/directus/periodos', () => ({
	listarPeriodos: () => listarPeriodos(),
	totalesVinculados: () => totalesVinculados(),
	crearPeriodo: (d: unknown) => crearPeriodo(d),
	liquidarPeriodo: (id: unknown, ids: unknown) => liquidarPeriodo(id, ids),
}));
vi.mock('@/apps/horarios/api/directus/horasExtras', () => ({
	listarHorasExtras: (f: unknown) => listarHorasExtras(f),
}));
const exportarPeriodosExcel = vi.fn();
vi.mock('@/apps/horarios/utils/exportarPeriodos', async (original) => ({
	...(await original<typeof import('@/apps/horarios/utils/exportarPeriodos')>()),
	exportarPeriodosExcel: (h: unknown) => exportarPeriodosExcel(h),
}));
vi.mock('@/apps/horarios/api/directus/read', () => ({
	getStores: async () => [{ id: 26, name: 'Ipiales', company: 'Empresa A' }],
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

/** Texto de la cabecera de un bloque del detalle ("Del periodo", "Rezagadas"). */
const bloque = (d: HTMLElement, titulo: string) => within(d).getByText(titulo).parentElement!.textContent;

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
	liquidarPeriodo.mockResolvedValue({});
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
		expect(bloque(dialogo, 'Del periodo')).toBe('Del periodoHoras extras: 1Tiempo: 1 h 30 min');
		expect(bloque(dialogo, 'Rezagadas')).toBe('RezagadasHoras extras: 1Tiempo: 30 min');
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
		expect(bloque(dialogo, 'Rezagadas')).toContain('Horas extras: 1');
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
		// Sugerencias de fin (11 a 15 días desde el inicio 26/10), solo con la fecha, debajo de Fin.
		expect(within(dialogo).getByRole('button', { name: '05/11/2026' })).toBeInTheDocument();
		fireEvent.click(within(dialogo).getByRole('button', { name: '08/11/2026' }));
		expect(within(dialogo).getByLabelText('Fin')).toHaveValue('2026-11-08');
		expect(within(dialogo).getByText('14 días', { selector: 'p' })).toBeInTheDocument();

		fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear periodo' }));
		await waitFor(() => expect(crearPeriodo).toHaveBeenCalledWith({ name: 'Octubre 2', start_date: '2026-10-26', end_date: '2026-11-08' }));
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

	describe('preliquidar y liquidar (F4)', () => {
		const abrirPreliquidado = async () => {
			montar('/horarios/horas-extras/periodos?periodo=2');
			const dialogo = await screen.findByRole('dialog');
			await within(dialogo).findByText('Emp1 X');
			return dialogo;
		};

		it('un liquidado no tiene acciones', async () => {
			montar('/horarios/horas-extras/periodos?periodo=1');
			const dialogo = await screen.findByRole('dialog');
			await within(dialogo).findByText('Emp3 X');
			expect(within(dialogo).queryByRole('button', { name: 'Liquidar' })).not.toBeInTheDocument();
			expect(within(dialogo).queryByRole('button', { name: 'Preliquidar' })).not.toBeInTheDocument();
		});

		it('preliquidar recalcula y avisa si no hubo cambios', async () => {
			const dialogo = await abrirPreliquidado();
			fireEvent.click(within(dialogo).getByRole('button', { name: 'Preliquidar' }));
			await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith('Preliquidación al día: sin cambios', 'info'));
		});

		it('preliquidar muestra las horas aprobadas entre medias', async () => {
			const dialogo = await abrirPreliquidado();
			listarHorasExtras.mockResolvedValue([...porPagar, hora(5, '2026-10-20', 30)]);
			fireEvent.click(within(dialogo).getByRole('button', { name: 'Preliquidar' }));
			await waitFor(() =>
				expect(showSnackbar).toHaveBeenCalledWith('Preliquidación actualizada: 1 nueva, 0 retiradas', 'success'),
			);
			expect(await within(dialogo).findByText('Emp5 X')).toBeInTheDocument();
		});

		it('liquidar recalcula, avisa del cambio, confirma y vincula del periodo + rezagadas', async () => {
			const dialogo = await abrirPreliquidado();
			listarHorasExtras.mockResolvedValue([...porPagar, hora(5, '2026-10-20', 30)]);
			fireEvent.click(within(dialogo).getByRole('button', { name: 'Liquidar' }));

			const confirmar = await screen.findByRole('dialog', { name: /Liquidar periodo/ });
			expect(within(confirmar).getByText(/1 hora extra nueva y 0 retiradas/)).toBeInTheDocument();
			const celdas = (fila: RegExp) =>
				within(within(confirmar).getByRole('row', { name: fila }))
					.getAllByRole('cell')
					.map((c) => c.textContent);
			expect(celdas(/Del periodo/)).toEqual(['Del periodo', '2', '1 h 30 min']); // 60 + 30
			expect(celdas(/Rezagadas/)).toEqual(['Rezagadas', '1', '30 min']);
			expect(celdas(/Total a vincular/)).toEqual(['Total a vincular', '3', '2 h']);
			expect(within(confirmar).getByText(/Personas con horas extras/).textContent).toBe('Personas con horas extras: 3');
			expect(within(confirmar).getByText(/no se puede deshacer/)).toBeInTheDocument();

			fireEvent.click(within(confirmar).getByRole('button', { name: 'Liquidar' }));
			await waitFor(() => expect(liquidarPeriodo).toHaveBeenCalledWith(2, [1, 5, 2]));
			expect(showSnackbar).toHaveBeenCalledWith('Periodo liquidado: 3 horas extra vinculadas', 'success');
		});

		it('cancelar no liquida; un error se informa', async () => {
			const dialogo = await abrirPreliquidado();
			fireEvent.click(within(dialogo).getByRole('button', { name: 'Liquidar' }));
			let confirmar = await screen.findByRole('dialog', { name: /Liquidar periodo/ });
			fireEvent.click(within(confirmar).getByRole('button', { name: 'Cancelar' }));
			await waitFor(() => expect(screen.queryByRole('dialog', { name: /Liquidar periodo/ })).not.toBeInTheDocument());
			expect(liquidarPeriodo).not.toHaveBeenCalled();

			liquidarPeriodo.mockRejectedValueOnce(new Error('Sin permiso'));
			fireEvent.click(within(dialogo).getByRole('button', { name: 'Liquidar' }));
			confirmar = await screen.findByRole('dialog', { name: /Liquidar periodo/ });
			fireEvent.click(within(confirmar).getByRole('button', { name: 'Liquidar' }));
			await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.stringMatching(/Sin permiso|Error al liquidar/), 'error'));
		});
	});

	describe('exportar a Excel', () => {
		it('elige uno o varios periodos y genera una hoja por empresa con un bloque por periodo', async () => {
			montar();
			await screen.findByRole('row', { name: /11\/10\/2026 al 25\/10\/2026/ });
			fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }));
			const dialogo = await screen.findByRole('dialog', { name: /Exportar periodos/ });
			// Por defecto, el más reciente.
			expect(within(dialogo).getByText('1 de 2 seleccionados')).toBeInTheDocument();
			fireEvent.click(within(dialogo).getByRole('button', { name: 'Seleccionar todos' }));
			fireEvent.click(within(dialogo).getByRole('button', { name: 'Exportar (2)' }));

			await waitFor(() => expect(exportarPeriodosExcel).toHaveBeenCalledTimes(1));
			const hojas = exportarPeriodosExcel.mock.calls[0][0];
			expect(hojas.map((h: { empresa: string }) => h.empresa)).toEqual(['Empresa A']);
			// Orden cronológico: liquidado (01/10) y luego el preliquidado (11/10).
			const [b1, b2] = hojas[0].bloques;
			expect(b1.periodo.id).toBe(1);
			expect(b1.totales).toEqual({ horasExtras: 2, minutos: 120, empleados: 2 });
			expect(b2.periodo.id).toBe(2);
			expect(b2.totales).toEqual({ horasExtras: 2, minutos: 90, empleados: 2 }); // del periodo + rezagada
			expect(showSnackbar).toHaveBeenCalledWith('Excel de periodos generado', 'success');
		});

		it('sin periodos seleccionados no exporta', async () => {
			montar();
			await screen.findByRole('row', { name: /11\/10\/2026 al 25\/10\/2026/ });
			fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }));
			const dialogo = await screen.findByRole('dialog', { name: /Exportar periodos/ });
			fireEvent.click(within(dialogo).getByRole('button', { name: 'Quitar todos' }));
			expect(within(dialogo).getByRole('button', { name: 'Exportar (0)' })).toBeDisabled();
		});
	});
});
