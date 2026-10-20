import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearRegistrosVacios, ESTADO } from '../../../domain/registro';
import type { EmpleadoAsistencia } from '../../../domain/registro/modelo';
import { useTarjetasColapsables } from '../../../hooks/registro/useTarjetasColapsables';

function crearEmpleadoMock(
	id: string,
	nombre: string,
	overrideRegistros: Partial<ReturnType<typeof crearRegistrosVacios>> = {},
): EmpleadoAsistencia {
	const registros = { ...crearRegistrosVacios(), ...overrideRegistros };
	return {
		id,
		documento: `DOC-${id}`,
		nombre,
		cargo: 'Asesor',
		estadoActual: ESTADO.entradaPendiente,
		registros,
	};
}

describe('useTarjetasColapsables', () => {
	const storeId = 123;
	const storageKey = `horarios:registros:colapsadas:${storeId}`;

	const mockEmpleados: EmpleadoAsistencia[] = [
		crearEmpleadoMock('1', 'Empleado Uno'), // pendiente
		crearEmpleadoMock('2', 'Empleado Dos', { inicioJornada: '08:00' }), // jornada_iniciada (activa)
		crearEmpleadoMock('3', 'Empleado Tres', {
			inicioJornada: '08:00',
			finJornada: '17:00',
		}), // jornada_finalizada
	];

	beforeEach(() => {
		localStorage.clear();
	});

	it('inicia con todas las tarjetas expandidas por defecto cuando localStorage está vacío', () => {
		const { result } = renderHook(() =>
			useTarjetasColapsables(storeId, mockEmpleados),
		);

		expect(result.current.isExpanded('1')).toBe(true);
		expect(result.current.isExpanded('2')).toBe(true);
		expect(result.current.isExpanded('3')).toBe(true);
		expect(result.current.totalEmpleados).toBe(3);
		expect(result.current.totalExpandidas).toBe(3);
		expect(result.current.totalColapsadas).toBe(0);
		expect(result.current.todasExpandidas).toBe(true);
		expect(result.current.todasColapsadas).toBe(false);
	});

	it('recupera las tarjetas colapsadas guardadas en localStorage', () => {
		localStorage.setItem(storageKey, JSON.stringify(['2']));

		const { result } = renderHook(() =>
			useTarjetasColapsables(storeId, mockEmpleados),
		);

		expect(result.current.isExpanded('1')).toBe(true);
		expect(result.current.isExpanded('2')).toBe(false);
		expect(result.current.isExpanded('3')).toBe(true);
		expect(result.current.totalExpandidas).toBe(2);
		expect(result.current.totalColapsadas).toBe(1);
	});

	it('alterna (toggle) el estado de una tarjeta y persiste en localStorage', () => {
		const { result } = renderHook(() =>
			useTarjetasColapsables(storeId, mockEmpleados),
		);

		// Contraer empleado 1
		act(() => {
			result.current.toggle('1');
		});

		expect(result.current.isExpanded('1')).toBe(false);
		expect(JSON.parse(localStorage.getItem(storageKey) || '[]')).toEqual(['1']);

		// Volver a expandir empleado 1
		act(() => {
			result.current.toggle('1');
		});

		expect(result.current.isExpanded('1')).toBe(true);
		expect(JSON.parse(localStorage.getItem(storageKey) || '[]')).toEqual([]);
	});

	it('permite contraer todas las tarjetas', () => {
		const { result } = renderHook(() =>
			useTarjetasColapsables(storeId, mockEmpleados),
		);

		act(() => {
			result.current.contraerTodas();
		});

		expect(result.current.isExpanded('1')).toBe(false);
		expect(result.current.isExpanded('2')).toBe(false);
		expect(result.current.isExpanded('3')).toBe(false);
		expect(result.current.totalColapsadas).toBe(3);
		expect(result.current.totalExpandidas).toBe(0);
		expect(result.current.todasColapsadas).toBe(true);
		expect(result.current.todasExpandidas).toBe(false);
	});

	it('permite expandir todas las tarjetas', () => {
		localStorage.setItem(storageKey, JSON.stringify(['1', '2', '3']));

		const { result } = renderHook(() =>
			useTarjetasColapsables(storeId, mockEmpleados),
		);

		act(() => {
			result.current.expandirTodas();
		});

		expect(result.current.isExpanded('1')).toBe(true);
		expect(result.current.isExpanded('2')).toBe(true);
		expect(result.current.isExpanded('3')).toBe(true);
		expect(result.current.totalColapsadas).toBe(0);
		expect(result.current.todasExpandidas).toBe(true);
	});

	it('filtra y expande solo las tarjetas con jornada activa (en turno)', () => {
		const { result } = renderHook(() =>
			useTarjetasColapsables(storeId, mockEmpleados),
		);

		act(() => {
			result.current.expandirPorEstado('activas');
		});

		// Empleado 2 tiene inicioJornada = '08:00' -> activa
		expect(result.current.isExpanded('1')).toBe(false);
		expect(result.current.isExpanded('2')).toBe(true);
		expect(result.current.isExpanded('3')).toBe(false);
	});

	it('filtra y expande solo las tarjetas con estado pendiente de entrada', () => {
		const { result } = renderHook(() =>
			useTarjetasColapsables(storeId, mockEmpleados),
		);

		act(() => {
			result.current.expandirPorEstado('pendientes');
		});

		// Empleado 1 no tiene registros -> entradaPendiente
		expect(result.current.isExpanded('1')).toBe(true);
		expect(result.current.isExpanded('2')).toBe(false);
		expect(result.current.isExpanded('3')).toBe(false);
	});

	it('filtra y expande solo las tarjetas con jornada finalizada', () => {
		const { result } = renderHook(() =>
			useTarjetasColapsables(storeId, mockEmpleados),
		);

		act(() => {
			result.current.expandirPorEstado('finalizadas');
		});

		// Empleado 3 tiene finJornada -> jornadaFinalizada
		expect(result.current.isExpanded('1')).toBe(false);
		expect(result.current.isExpanded('2')).toBe(false);
		expect(result.current.isExpanded('3')).toBe(true);
	});

	it('maneja con seguridad cuando storeId es nulo o indefinido sin lanzar excepciones', () => {
		const { result } = renderHook(() =>
			useTarjetasColapsables(null, mockEmpleados),
		);

		expect(result.current.isExpanded('1')).toBe(true);

		act(() => {
			result.current.toggle('1');
		});

		expect(result.current.isExpanded('1')).toBe(false);
	});
});

