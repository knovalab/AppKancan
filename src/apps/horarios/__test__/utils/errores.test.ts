import { describe, expect, it, vi } from 'vitest';
import {
	codigoDeError,
	errorDeApi,
	mensajeDeError,
	statusDeError,
} from '@/apps/horarios/utils/errores';

const directus = (
	code: string | undefined,
	message = 'raw message',
	status?: number,
) => ({
	errors: [{ message, extensions: code ? { code } : {} }],
	...(status ? { response: { status } } : {}),
});

describe('utils/errores', () => {
	it('traduce los códigos conocidos de Directus', () => {
		expect(mensajeDeError(directus('FORBIDDEN'), 'x')).toBe(
			'No tienes permiso para esta acción.',
		);
		expect(mensajeDeError(directus('RECORD_NOT_UNIQUE'), 'x')).toBe(
			'Este registro ya existe.',
		);
		expect(mensajeDeError(directus('TOKEN_EXPIRED'), 'x')).toMatch(
			/sesión expiró/,
		);
	});

	it('usa el status HTTP si el código no es conocido', () => {
		expect(mensajeDeError(directus('OTRO', 'msg', 403), 'x')).toBe(
			'No tienes permiso para esta acción.',
		);
	});

	it('sin código conocido ni status, usa el mensaje de Directus', () => {
		expect(mensajeDeError(directus(undefined, 'Campo inválido'), 'x')).toBe(
			'Campo inválido',
		);
	});

	it('detecta los fallos de red', () => {
		expect(mensajeDeError(new TypeError('Failed to fetch'), 'x')).toMatch(
			/Sin conexión/,
		);
	});

	it('conserva el mensaje de un Error propio (p. ej. los de sesión)', () => {
		expect(
			mensajeDeError(
				new Error('Sesión expirada. Por favor inicie sesión de nuevo.'),
				'x',
			),
		).toBe('Sesión expirada. Por favor inicie sesión de nuevo.');
	});

	it('cae en el mensaje por defecto con valores desconocidos', () => {
		expect(mensajeDeError(undefined, 'Por defecto')).toBe('Por defecto');
		expect(mensajeDeError('texto', 'Por defecto')).toBe('Por defecto');
		expect(mensajeDeError({}, 'Por defecto')).toBe('Por defecto');
	});

	it('expone código y status', () => {
		expect(codigoDeError(directus('FORBIDDEN'))).toBe('FORBIDDEN');
		expect(codigoDeError(new Error('x'))).toBeNull();
		expect(statusDeError(directus(undefined, 'm', 404))).toBe(404);
		expect(statusDeError({ status: 500, errors: [] })).toBe(500);
	});

	it('errorDeApi registra el original y devuelve un Error traducido', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const err = errorDeApi(
			directus('FORBIDDEN'),
			'Guardando',
			'Error al guardar',
		);
		expect(err).toBeInstanceOf(Error);
		expect(err.message).toBe('No tienes permiso para esta acción.');
		expect(spy).toHaveBeenCalledWith('❌ Guardando:', expect.anything());
		spy.mockRestore();
	});
});
