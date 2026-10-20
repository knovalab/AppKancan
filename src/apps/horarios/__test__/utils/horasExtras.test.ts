import { describe, expect, it } from 'vitest';
import type { OverTimeDto } from '@/apps/horarios/interfaces/api/overTime';
import { aFilaHoraExtra } from '@/apps/horarios/utils/horasExtras';

const base: OverTimeDto = {
	id: 1,
	employee_id: { id: 7, first_name: 'ANA MARÍA', last_name: 'PÉREZ', document_number: '1107837464', store_id: 26 },
	store_id: { id: '26', name: 'Ipiales Centro' },
	work_date: '2026-10-10',
	minutes: 90,
	status: 'pendiente',
	observations: 'Inventario',
	created_by: { id: 'u1', first_name: 'luis', last_name: 'gómez' },
	created_at: '2026-10-11T14:00:00Z',
};

describe('aFilaHoraExtra', () => {
	it('resuelve nombres, documento y tienda', () => {
		expect(aFilaHoraExtra(base)).toMatchObject({
			id: 1,
			fecha: '2026-10-10',
			empleado: 'Ana María Pérez',
			documento: '1 107 837 464',
			tiendaId: 26,
			tienda: 'Ipiales Centro',
			rotacion: false,
			minutos: 90,
			creadaPor: 'Luis Gómez',
		});
	});

	it('marca rotación cuando la tienda trabajada no es la del empleado (ids texto o número)', () => {
		expect(aFilaHoraExtra({ ...base, store_id: { id: '90', name: 'Oficina' } }).rotacion).toBe(true);
	});

	it('tolera relaciones sin expandir', () => {
		const f = aFilaHoraExtra({ ...base, employee_id: 7, store_id: 26, created_by: 'u1', observations: null });
		expect(f).toMatchObject({ empleado: 'Empleado 7', tienda: '', rotacion: false, creadaPor: '', observacion: '' });
	});
});
