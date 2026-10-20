import { describe, expect, it } from 'vitest';
import { accesoDeSubseccion } from '@/apps/horarios/hooks/useHorariosLayout';
import type { HorariosAcceso } from '@/apps/horarios/interfaces/acceso';
import type { Rol } from '@/apps/horarios/navigation/secciones';

const todas = [
	{ id: 1, name: 'A' },
	{ id: 2, name: 'B' },
	{ id: 3, name: 'C' },
];
const acceso = (roles: Rol[], tiendasPermitidas = [] as typeof todas): HorariosAcceso => ({
	cargando: false,
	roles: new Set(roles),
	rolPrincipal: roles[0],
	puede: (r) => r.some((x) => roles.includes(x)),
	inicio: 'registros',
	puedeVerDemo: false,
	tiendaPropia: 1,
	tiendasPermitidas,
	tiendasComercial: roles.includes('comercial') ? todas : [],
});
const aprobacion = { path: 'aprobacion', label: 'Aprobación', roles: ['comercial'] as Rol[] };
const registradas = { path: 'registradas', label: 'Registradas', roles: ['areaManager'] as Rol[] };

describe('accesoDeSubseccion', () => {
	it('fuera de las sub‑secciones del comercial no cambia nada', () => {
		const a = acceso(['tienda', 'comercial']);
		expect(accesoDeSubseccion(a, null)).toBe(a);
		expect(accesoDeSubseccion(a, registradas)).toBe(a);
	});

	it('en Aprobación, un usuario de tienda + comercial ve todas las tiendas y no queda fijado a la suya', () => {
		const efectivo = accesoDeSubseccion(acceso(['tienda', 'comercial']), aprobacion);
		expect(efectivo.tiendasPermitidas).toEqual(todas);
		expect(efectivo.roles.has('tienda')).toBe(false);
		expect(efectivo.rolPrincipal).toBe('comercial');
		expect(efectivo.inicio).toBe('registros');
	});

	it('un Area Manager + comercial ve todas en Aprobación, sin perder sus tiendas fuera de ella', () => {
		const base = acceso(['areaManager', 'comercial'], [todas[0]]);
		expect(accesoDeSubseccion(base, aprobacion).tiendasPermitidas).toEqual(todas);
		expect(accesoDeSubseccion(base, registradas).tiendasPermitidas).toEqual([todas[0]]);
	});

	it('sin el rol comercial no aplica', () => {
		const a = acceso(['areaManager']);
		expect(accesoDeSubseccion(a, aprobacion)).toBe(a);
	});
});
