import { describe, expect, it } from 'vitest';
import { calidadProceso, type HoraCalidad } from '@/apps/horarios/domain/horasExtras';

const h = (o: Partial<HoraCalidad>): HoraCalidad => ({
	storeId: 26,
	empleadoId: 7,
	registrador: 'Líder Ipiales',
	fecha: '2026-10-20',
	estado: 'aprobada',
	creada: '2026-10-20 18:00',
	revisada: '2026-10-21 10:00',
	inicioPeriodo: null,
	minutos: 60,
	...o,
});

describe('calidadProceso (R5)', () => {
	const horas = [
		h({}), // aprobada en 16 h, registrada el mismo día
		h({ empleadoId: 8, fecha: '2026-10-10', creada: '2026-10-15 09:00', revisada: '2026-10-17 09:00', inicioPeriodo: '2026-10-11', minutos: 90 }), // tardía (5 días), 48 h, rezagada
		h({ empleadoId: 9, estado: 'descartada_comercial', creada: '2026-10-21 08:00', revisada: '2026-10-21 12:00' }), // rechazada en 4 h, 1 día
		h({ storeId: 30, registrador: 'Líder Pasto', estado: 'pendiente', revisada: null }), // sin revisar
		h({ storeId: 30, registrador: 'Líder Pasto', estado: 'pendiente', revisada: null }), // duplicada (7, 20/10)
		h({ estado: 'sugerida' }), // no cuenta: no pasó por el flujo
	];
	const r = calidadProceso(horas);

	it('total: aprobación, atraso, tardías, rechazo y rezagadas', () => {
		expect(r.total).toMatchObject({
			registros: 5,
			revisadas: 3,
			rechazadas: 1,
			medianaAprobacion: 16,
			medianaAtraso: 0,
			tardias: 1,
			rezagadas: 1,
			minutosRezagados: 90,
		});
		expect(r.total.tasaRechazo).toBeCloseTo(1 / 3);
	});

	it('por tienda y por quién registra, más rechazo primero', () => {
		expect(r.porTienda.map((g) => [g.clave, g.registros, g.tasaRechazo])).toEqual([
			['26', 3, 1 / 3],
			['30', 2, null],
		]);
		expect(r.porRegistrador.map((g) => g.clave)).toEqual(['Líder Ipiales', 'Líder Pasto']);
		expect(r.porRegistrador[0].medianaAtraso).toBe(1); // 0, 5 y 1 días
	});

	it('duplicados: misma persona y día con más de una activa (las rechazadas no cuentan)', () => {
		// Empleado 7 el 20/10: aprobada + 2 pendientes = 2 de más.
		expect(r.duplicados).toBe(2);
	});
});
