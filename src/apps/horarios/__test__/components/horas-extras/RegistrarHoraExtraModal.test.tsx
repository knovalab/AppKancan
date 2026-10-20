import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '../../utils/test-utils';

const crearHoraExtra = vi.fn();
const listarHorasExtras = vi.fn();
const showSnackbar = vi.fn();
vi.mock('@/apps/horarios/api/directus/horasExtras', () => ({
	crearHoraExtra: (d: unknown) => crearHoraExtra(d),
	listarHorasExtras: (f: unknown) => listarHorasExtras(f),
}));
vi.mock('@/apps/horarios/hooks/useAvisos', () => ({ useAvisos: () => ({ showSnackbar }) }));
vi.mock('@/apps/horarios/utils/timeSync', () => ({ getRealColombiaTime: () => dayjs('2026-10-20T10:00:00') }));

import { RegistrarHoraExtraModal } from '@/apps/horarios/components/horas-extras/RegistrarHoraExtraModal';
import { crearRegistrosVacios, ESTADO } from '@/apps/horarios/domain/registro';

const empleado = {
	id: '7',
	documento: '1107',
	nombre: 'ANA PÉREZ',
	cargo: 'Asesor',
	storeId: 26,
	estadoActual: ESTADO.entradaPendiente,
	registros: crearRegistrosVacios(),
};
const tiendas = [
	{ id: 26, name: 'Ipiales Centro' },
	{ id: 30, name: 'Pasto' },
];

const montar = (onClose = vi.fn()) =>
	render(
		<RegistrarHoraExtraModal open empleados={[empleado]} tiendas={tiendas} tiendasLider={[26]} onClose={onClose} />,
		{ wrapper: createQueryWrapper() },
	);

/** Busca al empleado en el autocompletar y lo elige. */
const elegirEmpleado = async () => {
	fireEvent.change(screen.getByLabelText('Empleado'), { target: { value: '1107' } });
	fireEvent.click(await screen.findByText('Ana Pérez · 1107'));
};

beforeEach(() => {
	vi.clearAllMocks();
	listarHorasExtras.mockResolvedValue([]);
	crearHoraExtra.mockResolvedValue({ id: 1 });
});

describe('RegistrarHoraExtraModal', () => {
	it('exige elegir un empleado', async () => {
		montar();
		fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
		expect(await screen.findByText('Busca y elige un empleado')).toBeInTheDocument();
		expect(crearHoraExtra).not.toHaveBeenCalled();
	});

	it('no guarda sin horas ni con bloques que no son de media hora', async () => {
		montar();
		await elegirEmpleado();
		fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
		expect(await screen.findByText('Las horas extras deben ser mayores que cero')).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText('Horas extras'), { target: { value: '1.25' } });
		fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
		expect(await screen.findByText('Las horas extras van en bloques de media hora')).toBeInTheDocument();
		expect(crearHoraExtra).not.toHaveBeenCalled();
	});

	it('guarda con la tienda del empleado por defecto y cierra', async () => {
		const onClose = vi.fn();
		montar(onClose);
		await elegirEmpleado();
		fireEvent.change(screen.getByLabelText('Horas extras'), { target: { value: '1.5' } });
		fireEvent.change(screen.getByLabelText('Observación'), { target: { value: ' Inventario ' } });
		fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(crearHoraExtra).toHaveBeenCalledWith({
			employee_id: 7,
			store_id: 26,
			work_date: '2026-10-20',
			minutes: 90,
			observations: 'Inventario',
		});
		expect(showSnackbar).toHaveBeenCalledWith(expect.stringMatching(/pendiente/), 'success');
	});

	it('avisa si el empleado ya tiene una hora extra activa ese día', async () => {
		listarHorasExtras.mockResolvedValue([{ id: 3, status: 'pendiente', minutes: 60 }]);
		montar();
		await elegirEmpleado();
		expect(await screen.findByText(/ya tiene 1 h en estado Pendiente/)).toBeInTheDocument();
		expect(listarHorasExtras).toHaveBeenCalledWith(
			expect.objectContaining({ empleadoId: 7, desde: '2026-10-20', hasta: '2026-10-20' }),
		);
	});
});
