import { crearRegistrosVacios, ESTADO } from '@/apps/horarios/domain/registro';
import type { EmpleadoAsistencia } from '../../../domain/registro/modelo';
import type { Cargo, EmpleadoAdmin } from '../../../interfaces/empleados';

export function createMockCargo(overrides: Partial<Cargo> = {}): Cargo {
	return {
		id: 1,
		name: 'Vendedor',
		...overrides,
	};
}

export function createMockEmpleadoAdmin(
	overrides: Partial<EmpleadoAdmin> = {},
): EmpleadoAdmin {
	return {
		id: 10,
		document_type: 'Cédula de Ciudadanía',
		document_number: '12345678',
		first_name: 'Laura',
		middle_name: null,
		last_name: 'Martínez',
		second_last_name: null,
		store_id: 1,
		position_id: 1,
		position_name: 'Vendedor',
		status: 'Activo',
		email: 'laura@kancan.com',
		phone_number: '3001234567',
		...overrides,
	};
}

export function createMockEmpleadoAsistencia(
	overrides: Partial<EmpleadoAsistencia> = {},
): EmpleadoAsistencia {
	return {
		id: '101',
		documento: '1234567890',
		nombre: 'Juan Pérez',
		cargo: 'Vendedor',
		estadoActual: ESTADO.entradaPendiente,
		registros: crearRegistrosVacios(),
		pausasActivasCount: 0,
		storeId: 5,
		...overrides,
	};
}
