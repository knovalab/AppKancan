import { describe, expect, it } from 'vitest';
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
	he.subsecciones!.filter((s) => puedeVerSubseccion(acceso(roles), he, s)).map((s) => s.path);

describe('sub‑secciones de Horas extras por rol', () => {
	it('líder: solo Registradas', () => {
		expect(visibles(['areaManager', 'report'])).toEqual(['registradas']);
	});

	it('comercial: Historial y Aprobación, nunca Registradas', () => {
		expect(visibles(['tienda', 'comercial'])).toEqual(['historial', 'aprobacion']);
		expect(visibles(['areaManager', 'report', 'comercial'])).toEqual(['historial', 'aprobacion']);
		expect(puedeVerSubseccion(acceso(['areaManager', 'comercial']), he, sub('registradas'))).toBe(false);
	});

	it('nómina: solo Historial; con comercial suma Aprobación; nunca Registradas', () => {
		expect(visibles(['tienda', 'nomina'])).toEqual(['historial']);
		expect(visibles(['tienda', 'comercial', 'nomina'])).toEqual(['historial', 'aprobacion']);
		expect(visibles(['areaManager', 'report', 'nomina'])).toEqual(['historial']);
	});

	it('sin ninguno de los roles: nada', () => {
		expect(visibles(['tienda'])).toEqual([]);
	});
});
