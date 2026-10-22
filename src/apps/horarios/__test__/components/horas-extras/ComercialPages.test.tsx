import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import { createQueryWrapper } from '../../utils/test-utils';

const listarHorasExtras = vi.fn();
const revisarHorasExtras = vi.fn();
const showSnackbar = vi.fn();
vi.mock('@/apps/horarios/api/directus/horasExtras', () => ({
	listarHorasExtras: (f: unknown) => listarHorasExtras(f),
	revisarHorasExtras: (ids: unknown, r: unknown) => revisarHorasExtras(ids, r),
}));
vi.mock('@/apps/horarios/hooks/useAvisos', () => ({ useAvisos: () => ({ showSnackbar }) }));
vi.mock('@/apps/horarios/hooks/useHorariosLayout', () => ({
	useHorariosLayout: () => ({ tienda: { storeIds: [26, 30] }, acceso: { roles: new Set(['comercial']) } }),
}));

import AprobacionPage from '@/apps/horarios/pages/horas-extras/AprobacionPage';
import HistorialPage from '@/apps/horarios/pages/horas-extras/HistorialPage';

const dto = (id: number, nombre: string) => ({
	id,
	employee_id: { id: id + 100, first_name: nombre, last_name: 'X', store_id: 26 },
	store_id: { id: 26, name: 'Ipiales' },
	work_date: '2026-10-19',
	minutes: 60,
	status: 'pendiente',
});

const historial = [
	{
		...dto(9, 'Carla'),
		status: 'descartada_comercial',
		observations: 'Cierre de inventario',
		created_by: { id: 'u1', first_name: 'luis', last_name: 'gómez' },
		created_at: '2026-10-19T22:00:00',
		updated_by: { id: 'u2', first_name: 'marta', last_name: 'ríos' },
		reviewed_at: '2026-10-20T09:30:00',
		review_note: 'Sin soporte',
	},
];

beforeEach(() => {
	vi.clearAllMocks();
	// Pendientes para su tabla; el historial pide los demás estados.
	listarHorasExtras.mockImplementation(async (f: { estados?: string[] }) =>
		f.estados?.length === 1 && f.estados[0] === 'pendiente'
			? [dto(1, 'Ana'), dto(2, 'Beto')]
			: historial,
	);
	revisarHorasExtras.mockResolvedValue([]);
});

const montar = () => render(<AprobacionPage />, { wrapper: createQueryWrapper() });
const montarHistorial = () => render(<HistorialPage />, { wrapper: createQueryWrapper() });

describe('HistorialPage', () => {
	it('arranca en el mes en curso con todos los estados menos pendiente', async () => {
		montarHistorial();
		expect(await screen.findByText('Carla X')).toBeInTheDocument();
		const pedido = listarHorasExtras.mock.calls
			.map(([f]) => f)
			.find((f) => !f.estados.includes('pendiente'));
		expect(pedido).toMatchObject({ tiendas: [26, 30], desde: dayjs().startOf('month').format('YYYY-MM-DD'), hasta: dayjs().format('YYYY-MM-DD') });
		expect(pedido.estados).toEqual(['sugerida', 'descartada_lider', 'descartada_comercial', 'aprobada']);
		expect(screen.getByText('Historial de horas extras')).toBeInTheDocument();
	});

	it('la tabla no muestra observación ni creador; el detalle sí, con quién revisó y el motivo', async () => {
		montarHistorial();
		await screen.findByText('Carla X');
		expect(screen.queryByRole('columnheader', { name: 'Observación' })).not.toBeInTheDocument();
		expect(screen.queryByRole('columnheader', { name: 'Creada por' })).not.toBeInTheDocument();
		expect(screen.queryByText('Cierre de inventario')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Carla X' }));
		const detalle = await screen.findByRole('dialog', { name: /Detalle de hora extra/ });
		expect(within(detalle).getByText('Cierre de inventario')).toBeInTheDocument();
		expect(within(detalle).getByText('Luis Gómez')).toBeInTheDocument();
		expect(within(detalle).getByText('19/10/2026 22:00')).toBeInTheDocument();
		expect(within(detalle).getByText('Rechazada por')).toBeInTheDocument();
		expect(within(detalle).getByText('Marta Ríos')).toBeInTheDocument();
		expect(within(detalle).getByText('20/10/2026 09:30')).toBeInTheDocument();
		expect(within(detalle).getByText('Sin soporte')).toBeInTheDocument();

		fireEvent.click(within(detalle).getByRole('button', { name: 'Cerrar' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('busca por nombre o por documento', async () => {
		listarHorasExtras.mockResolvedValue([
			{ ...historial[0] },
			{ ...dto(10, 'Diana'), status: 'aprobada', employee_id: { id: 110, first_name: 'Diana', last_name: 'X', document_number: '1107837464', store_id: 26 } },
		]);
		montarHistorial();
		await screen.findByText('Diana X');
		fireEvent.change(screen.getByLabelText('Buscar empleado'), { target: { value: '1.107.837' } });
		expect(screen.getByText('Diana X')).toBeInTheDocument();
		expect(screen.queryByText('Carla X')).not.toBeInTheDocument();
		fireEvent.change(screen.getByLabelText('Buscar empleado'), { target: { value: 'carla' } });
		expect(screen.getByText('Carla X')).toBeInTheDocument();
		expect(screen.queryByText('Diana X')).not.toBeInTheDocument();
	});

	it('filtra por un estado', async () => {
		montarHistorial();
		await screen.findByText('Carla X');
		fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Estado' }));
		fireEvent.click(await screen.findByRole('option', { name: 'Rechazada' }));
		await waitFor(() =>
			expect(listarHorasExtras).toHaveBeenCalledWith(expect.objectContaining({ estados: ['descartada_comercial'] })),
		);
	});
});

describe('AprobacionPage', () => {
	it('solo muestra pendientes, sin el historial', async () => {
		montar();
		await screen.findByText('Ana X');
		expect(screen.queryByText('Carla X')).not.toBeInTheDocument();
		expect(screen.queryByText('Historial de horas extras')).not.toBeInTheDocument();
	});

	it('pide solo pendientes de las tiendas del header', async () => {
		montar();
		expect(await screen.findByText('Ana X')).toBeInTheDocument();
		expect(listarHorasExtras).toHaveBeenCalledWith({ tiendas: [26, 30], estados: ['pendiente'] });
		expect(screen.getByText('2 pendientes · 2 h en total')).toBeInTheDocument();
	});

	it('el buscador acota lo que se ve y lo que se aprueba en lote', async () => {
		montar();
		await screen.findByText('Ana X');
		fireEvent.change(screen.getByLabelText('Buscar empleado'), { target: { value: 'beto' } });
		expect(screen.queryByText('Ana X')).not.toBeInTheDocument();
		expect(screen.getByText(/1 pendiente/)).toBeInTheDocument();
	});

	it('aprueba en lote las seleccionadas', async () => {
		montar();
		await screen.findByText('Ana X');
		const [aprobarLote] = screen.getAllByRole('button', { name: 'Aprobar' });
		expect(aprobarLote).toBeDisabled();
		fireEvent.click(screen.getByLabelText('Seleccionar todas'));
		expect(screen.getByText('2 seleccionadas')).toBeInTheDocument();
		fireEvent.click(aprobarLote);
		fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aprobar' }));
		await waitFor(() =>
			expect(revisarHorasExtras).toHaveBeenCalledWith([1, 2], { decision: 'aprobada', nota: '' }),
		);
		expect(showSnackbar).toHaveBeenCalledWith('2 horas extras aprobadas', 'success');
	});

	it('rechaza una fila con su motivo', async () => {
		montar();
		await screen.findByText('Beto X');
		fireEvent.click(screen.getByLabelText('Rechazar Beto X'));
		const dialogo = await screen.findByRole('dialog');
		fireEvent.change(within(dialogo).getByLabelText('Motivo del rechazo'), { target: { value: 'Sin soporte' } });
		fireEvent.click(within(dialogo).getByRole('button', { name: 'Rechazar' }));
		await waitFor(() =>
			expect(revisarHorasExtras).toHaveBeenCalledWith([2], { decision: 'descartada_comercial', nota: 'Sin soporte' }),
		);
	});
});
