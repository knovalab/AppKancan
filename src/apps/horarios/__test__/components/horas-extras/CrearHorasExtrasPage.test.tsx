import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '../../utils/test-utils';

const crearHorasExtras = vi.fn();
const listarHorasExtras = vi.fn();
const getEmpleadosBulk = vi.fn();
const showSnackbar = vi.fn();
const irA = vi.fn();
vi.mock('@/apps/horarios/api/directus/horasExtras', () => ({
	crearHorasExtras: (d: unknown) => crearHorasExtras(d),
	listarHorasExtras: (f: unknown) => listarHorasExtras(f),
}));
vi.mock('@/apps/horarios/api/directus/readBulk', () => ({
	getEmpleadosBulk: (ids: unknown) => getEmpleadosBulk(ids),
}));
vi.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'uuid-lider' } }) }));
vi.mock('@/apps/horarios/hooks/useAvisos', () => ({ useAvisos: () => ({ showSnackbar }) }));
vi.mock('@/apps/horarios/utils/timeSync', () => ({ getRealColombiaTime: () => dayjs('2026-10-22T10:00:00') }));
vi.mock('@/apps/horarios/hooks/useHorariosLayout', () => ({
	useHorariosLayout: () => ({
		tienda: { storeIds: [26] },
		acceso: {
			tiendasPermitidas: [
				{ id: 26, name: 'Ipiales' },
				{ id: 30, name: 'Pasto' },
			],
		},
		irA,
	}),
}));

import CrearHorasExtrasPage from '@/apps/horarios/pages/horas-extras/CrearHorasExtrasPage';

const emp = (id: number, nombre: string) => ({ id: String(id), documento: `10${id}`, nombre, cargo: 'Asesor', storeId: 26 });

const montar = async () => {
	render(<CrearHorasExtrasPage />, { wrapper: createQueryWrapper() });
	// Las filas se pintan en segundo plano (useDeferredValue): esperar a la primera.
	await screen.findByText('Ana Pérez', {}, { timeout: 5000 });
	return screen.getByRole('table', { name: 'Grilla de horas extras' });
};
const celda = (nombre: string, ddmm: string) => screen.getByLabelText(`Horas de ${nombre} el ${ddmm}`);
const registrar = () => screen.getByRole('button', { name: /^Registrar \(/ });
/** Registrar abre la confirmación; devuelve el diálogo. */
const abrirConfirmacion = async () => {
	fireEvent.click(registrar());
	return screen.findByRole('dialog', { name: /Confirmar registro/ });
};
const confirmar = (d: HTMLElement) => fireEvent.click(within(d).getByRole('button', { name: /Confirmar y registrar/ }));

beforeEach(() => {
	vi.clearAllMocks();
	getEmpleadosBulk.mockResolvedValue([emp(7, 'ANA PÉREZ'), emp(8, 'JOSÉ RUIZ')]);
	listarHorasExtras.mockResolvedValue([]);
	crearHorasExtras.mockResolvedValue([]);
});

describe('CrearHorasExtrasPage (grilla personas × días)', () => {
	it('personas en filas y días en columnas; máximo 5 días', async () => {
		const grilla = await montar();
		expect(getEmpleadosBulk).toHaveBeenCalledWith([26]);
		expect(within(grilla).getByText('Ana Pérez')).toBeInTheDocument();
		expect(celda('Ana Pérez', '22/10')).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-20' } });
		expect(celda('José Ruiz', '20/10')).toBeInTheDocument();
		expect(celda('José Ruiz', '21/10')).toBeInTheDocument();
		expect(screen.getByText('3 días (máximo 5)')).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-17' } });
		expect(screen.getAllByText('El rango admite máximo 5 días').length).toBeGreaterThan(0);
		expect(screen.queryByRole('table', { name: 'Grilla de horas extras' })).not.toBeInTheDocument();
	});

	it('rellenar fila y columna con el valor rápido, observación por persona y registrar en una llamada', async () => {
		await montar();
		fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-21' } });

		// Fila de Ana con 1 h (valor por defecto) en los dos días.
		fireEvent.click(screen.getByRole('button', { name: 'Rellenar fila de Ana Pérez' }));
		// Columna 22/10 con 2 h para todos (sin selección = todas las personas).
		fireEvent.click(screen.getByRole('button', { name: '2 h' }));
		fireEvent.click(screen.getByRole('button', { name: 'Rellenar columna 22/10' }));
		fireEvent.change(screen.getByLabelText('Observación de José Ruiz'), { target: { value: ' Cierre ' } });

		expect(celda('Ana Pérez', '21/10')).toHaveValue(1);
		expect(celda('Ana Pérez', '22/10')).toHaveValue(2);
		expect(celda('José Ruiz', '21/10')).toHaveValue(null);
		expect(screen.getByText('3 horas extras')).toBeInTheDocument();

		const dialogo = await abrirConfirmacion();
		// Resumen: totales, personas con sus días y horas, y observación.
		const total = (label: string) => within(dialogo).getByText(label).nextSibling?.textContent;
		expect(total('Registros Vinculados')).toBe('3');
		expect(total('Personas')).toBe('2');
		expect(total('Tiempo total')).toBe('5 h');
		expect(total('Fechas')).toBe('21/10 al 22/10');
		const fila = (nombre: string) =>
			within(within(dialogo).getByRole('row', { name: new RegExp(nombre) }))
				.getAllByRole('cell')
				.map((c) => c.textContent);
		expect(fila('Ana Pérez')).toEqual(['Ana Pérez', 'Ipiales', '21/10: 1 h22/10: 2 h', '3 h', 'Sin observación']);
		expect(fila('José Ruiz')).toEqual(['José Ruiz', 'Ipiales', '22/10: 2 h', '2 h', 'Cierre']);
		expect(crearHorasExtras).not.toHaveBeenCalled();

		confirmar(dialogo);
		await waitFor(() => expect(crearHorasExtras).toHaveBeenCalledTimes(1));
		const enviadas = crearHorasExtras.mock.calls[0][0].map(
			(d: { employee_id: number; work_date: string; minutes: number; observations: string; store_id: number; created_by: string }) =>
				`${d.employee_id}|${d.work_date}|${d.minutes}|${d.store_id}|${d.observations}|${d.created_by}`,
		);
		expect(enviadas).toEqual([
			'7|2026-10-21|60|26||uuid-lider',
			'7|2026-10-22|120|26||uuid-lider',
			'8|2026-10-22|120|26|Cierre|uuid-lider',
		]);
		await waitFor(() => expect(irA).toHaveBeenCalledWith('horas-extras/registradas'));
		expect(showSnackbar).toHaveBeenCalledWith('3 horas extras registradas: quedan pendientes de aprobación', 'success');
	});

	it('aplicar a seleccionadas; rellenar columna respeta la selección; limpiar', async () => {
		await montar();
		fireEvent.click(screen.getByLabelText('Seleccionar José Ruiz'));
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar a seleccionadas (1)' }));
		expect(celda('José Ruiz', '22/10')).toHaveValue(1);
		expect(celda('Ana Pérez', '22/10')).toHaveValue(null);

		fireEvent.click(screen.getByRole('button', { name: '30 min' }));
		fireEvent.click(screen.getByRole('button', { name: 'Rellenar columna 22/10' }));
		expect(celda('José Ruiz', '22/10')).toHaveValue(0.5);
		expect(celda('Ana Pérez', '22/10')).toHaveValue(null);

		fireEvent.click(screen.getByRole('button', { name: 'Limpiar horas' }));
		expect(celda('José Ruiz', '22/10')).toHaveValue(null);
		expect(registrar()).toBeDisabled();
	});

	it('una celda fuera de bloque bloquea; la tienda por fila (rotación) va en el envío', async () => {
		await montar();
		fireEvent.change(celda('Ana Pérez', '22/10'), { target: { value: '0.75' } });
		expect(screen.getByText(/1 celda tiene errores/)).toBeInTheDocument();
		expect(registrar()).toBeDisabled();
		fireEvent.change(celda('Ana Pérez', '22/10'), { target: { value: '1.5' } });
		expect(registrar()).toBeEnabled();

		fireEvent.change(screen.getByLabelText('Tienda donde trabajó Ana Pérez'), { target: { value: '30' } });
		const dialogo = await abrirConfirmacion();
		expect(within(dialogo).getByText('Pasto')).toBeInTheDocument();
		confirmar(dialogo);
		await waitFor(() => expect(crearHorasExtras).toHaveBeenCalled());
		expect(crearHorasExtras.mock.calls[0][0][0]).toMatchObject({ employee_id: 7, store_id: 30, minutes: 90 });
	});

	it('marca la hora extra ya registrada ese día sin bloquear', async () => {
		listarHorasExtras.mockResolvedValue([{ id: 3, employee_id: 7, work_date: '2026-10-22', status: 'pendiente', minutes: 60 }]);
		await montar();
		expect(await screen.findByText('Ya: 1 h pendiente')).toBeInTheDocument();
		fireEvent.change(celda('Ana Pérez', '22/10'), { target: { value: '1' } });
		expect(screen.getByText(/1 celda coincide con una hora extra ya registrada/)).toBeInTheDocument();
		const dialogo = await abrirConfirmacion();
		expect(within(dialogo).getByText(/1 hora extra coincide con otra ya registrada/)).toBeInTheDocument();
		// Volver a editar no registra.
		fireEvent.click(within(dialogo).getByRole('button', { name: 'Volver a editar' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(crearHorasExtras).not.toHaveBeenCalled();
	});

	it('muestra el cargando mientras llegan las personas', async () => {
		let resolver: (v: unknown) => void = () => {};
		getEmpleadosBulk.mockReturnValue(new Promise((r) => (resolver = r)));
		render(<CrearHorasExtrasPage />, { wrapper: createQueryWrapper() });
		expect(await screen.findByText('Cargando personas de 1 tienda...')).toBeInTheDocument();
		resolver([emp(7, 'ANA PÉREZ')]);
		expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
	});

	it('pagina la grilla (25 por página) y rellenar columna alcanza a todas las filtradas', async () => {
		getEmpleadosBulk.mockResolvedValue(Array.from({ length: 30 }, (_, i) => emp(i + 1, `PERSONA ${String(i + 1).padStart(2, '0')}`)));
		render(<CrearHorasExtrasPage />, { wrapper: createQueryWrapper() });
		await screen.findByText('Persona 01', {}, { timeout: 5000 });
		expect(screen.queryByText('Persona 26')).not.toBeInTheDocument();
		expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Rellenar columna 22/10' }));
		expect(screen.getByText('30 horas extras')).toBeInTheDocument();
	});

	it('buscar sin tildes filtra filas', async () => {
		await montar();
		fireEvent.change(screen.getByLabelText('Buscar persona'), { target: { value: 'jose' } });
		expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
		expect(screen.getByText('José Ruiz')).toBeInTheDocument();
	});
});
