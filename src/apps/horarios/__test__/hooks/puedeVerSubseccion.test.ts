import { describe, expect, it, vi } from 'vitest';
import { conTextosDeRol } from '@/apps/horarios/hooks/useHorariosLayout';

vi.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({}) }));

import {
	buscarSeccion,
	puedeVerSubseccion,
	type Rol,
} from '@/apps/horarios/navigation/secciones';

const acceso = (roles: Rol[]) => ({
	roles: new Set(roles),
	puede: (r: readonly Rol[]) => r.some((x) => roles.includes(x)),
});
const he = buscarSeccion('horas-extras')!;
const sub = (path: string) => he.subsecciones!.find((s) => s.path === path)!;
const visibles = (roles: Rol[]) =>
	he
		.subsecciones!.filter((s) => puedeVerSubseccion(acceso(roles), he, s))
		.map((s) => s.path);

describe('sub‑secciones de Horas extras por rol', () => {
	it('líder: solo Registradas', () => {
		expect(visibles(['areaManager', 'report'])).toEqual(['registradas']);
	});

	it('comercial: Aprobación primero, Resumen semanal e Historial; nunca Registradas', () => {
		expect(visibles(['tienda', 'comercial'])).toEqual([
			'aprobacion',
			'resumen-semanal',
			'historial',
		]);
		expect(visibles(['areaManager', 'report', 'comercial'])).toEqual([
			'aprobacion',
			'resumen-semanal',
			'historial',
		]);
		expect(
			puedeVerSubseccion(
				acceso(['areaManager', 'comercial']),
				he,
				sub('registradas'),
			),
		).toBe(false);
	});

	it('nómina: Periodos, Resumen semanal e Historial; con comercial suma Aprobación; nunca Registradas', () => {
		expect(visibles(['tienda', 'nomina'])).toEqual([
			'periodos',
			'resumen-semanal',
			'historial',
		]);
		expect(visibles(['tienda', 'comercial', 'nomina'])).toEqual([
			'aprobacion',
			'periodos',
			'resumen-semanal',
			'historial',
		]);
		expect(visibles(['areaManager', 'report', 'nomina'])).toEqual([
			'periodos',
			'resumen-semanal',
			'historial',
		]);
	});

	it('nómina ve la pestaña como "Periodos y horas" aunque también traiga tienda; los demás, "Horas extras"', () => {
		const label = (roles: Rol[]) => conTextosDeRol(he, new Set(roles)).label;
		expect(label(['tienda', 'nomina'])).toBe('PERIODOS Y HORAS');
		expect(label(['report', 'nomina'])).toBe('PERIODOS Y HORAS');
		expect(label(['tienda', 'comercial'])).toBe('HORAS EXTRAS');
		expect(label(['comercial', 'nomina'])).toBe('HORAS EXTRAS'); // ve las dos: nombre general
		expect(conTextosDeRol(null, new Set<Rol>(['nomina']))).toBeNull();
	});

	it('sin ninguno de los roles: nada', () => {
		expect(visibles(['tienda'])).toEqual([]);
	});
});
