import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFlujoMarcacion } from '@/apps/horarios/components/employee-card/hooks/useFlujoMarcacion';
import { LOG_TYPE } from '@/apps/horarios/domain/registro';
import type { AccionesTarjeta } from '@/apps/horarios/interfaces/registro';

const FOTO = {
	latitude: 4.6,
	longitude: -74.08,
	accuracy: 8,
	photo: 'uuid-foto',
};

function crearAcciones(
	parcial: Partial<AccionesTarjeta> = {},
): AccionesTarjeta {
	return {
		registrar: vi.fn().mockResolvedValue({ ok: true }),
		editarHora: vi.fn().mockResolvedValue({ ok: true }),
		observar: vi.fn().mockResolvedValue({ ok: true }),
		reportarEvento: vi.fn().mockResolvedValue({ ok: true }),
		agregarNovedad: vi.fn().mockResolvedValue({ ok: true }),
		verificarNormas: vi.fn().mockResolvedValue(true),
		aceptarNormas: vi.fn().mockResolvedValue({ ok: true }),
		motivoDeMarcacion: vi.fn().mockResolvedValue(null),
		...parcial,
	};
}

const CTX = { esDemo: false, hayNormas: true };

function montar(acciones: AccionesTarjeta, ctx = CTX) {
	return renderHook(() => useFlujoMarcacion('101', acciones, ctx));
}

describe('useFlujoMarcacion', () => {
	it('almuerzo: registra directamente, sin pasos', async () => {
		const acciones = crearAcciones();
		const { result } = montar(acciones);

		await act(async () => result.current.iniciar(LOG_TYPE.inicioAlmuerzo));

		expect(result.current.paso).toBeNull();
		expect(acciones.registrar).toHaveBeenCalledWith({
			empleadoId: '101',
			marcacion: LOG_TYPE.inicioAlmuerzo,
			verificacion: undefined,
		});
	});

	it('Comenzar Jornada con normas aceptadas: va a foto + GPS y registra con la evidencia', async () => {
		const acciones = crearAcciones();
		const { result } = montar(acciones);

		await act(async () => result.current.iniciar(LOG_TYPE.inicioJornada));
		expect(acciones.verificarNormas).toHaveBeenCalledWith('101');
		expect(result.current.paso).toBe('verificacion');
		expect(result.current.marcacion).toBe(LOG_TYPE.inicioJornada);

		await act(async () => result.current.confirmarVerificacion(FOTO));
		expect(acciones.registrar).toHaveBeenCalledWith({
			empleadoId: '101',
			marcacion: LOG_TYPE.inicioJornada,
			verificacion: FOTO,
		});

		act(() => result.current.cerrarVerificacion());
		expect(result.current.paso).toBeNull();
	});

	it('Comenzar Jornada sin normas aceptadas: normas → aceptar → foto + GPS', async () => {
		const acciones = crearAcciones({
			verificarNormas: vi.fn().mockResolvedValue(false),
		});
		const { result } = montar(acciones);

		await act(async () => result.current.iniciar(LOG_TYPE.inicioJornada));
		expect(result.current.paso).toBe('normas');
		expect(acciones.registrar).not.toHaveBeenCalled();

		await act(async () => result.current.aceptarNormas());
		expect(acciones.aceptarNormas).toHaveBeenCalledWith('101');
		expect(result.current.paso).toBe('verificacion');
	});

	it('si aceptar normas falla, el modal de normas sigue abierto', async () => {
		const acciones = crearAcciones({
			verificarNormas: vi.fn().mockResolvedValue(false),
			aceptarNormas: vi.fn().mockResolvedValue({ ok: false, error: 'sin red' }),
		});
		const { result } = montar(acciones);

		await act(async () => result.current.iniciar(LOG_TYPE.inicioJornada));
		await act(async () => result.current.aceptarNormas());

		expect(result.current.paso).toBe('normas');
		expect(result.current.aceptandoNormas).toBe(false);
	});

	it('si el registro falla, confirmar lanza y el paso de foto sigue abierto para reintentar', async () => {
		const registrar = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, error: 'Error de red' })
			.mockResolvedValueOnce({ ok: true });
		const acciones = crearAcciones({ registrar });
		const { result } = montar(acciones);

		await act(async () => result.current.iniciar(LOG_TYPE.finJornada));
		await act(async () => {
			await expect(result.current.confirmarVerificacion(FOTO)).rejects.toThrow(
				'Error de red',
			);
		});
		expect(result.current.paso).toBe('verificacion');

		await act(async () => result.current.confirmarVerificacion(FOTO));
		expect(registrar).toHaveBeenCalledTimes(2);
	});

	it('demo: Comenzar Jornada registra sin normas ni cámara', async () => {
		const acciones = crearAcciones();
		const { result } = montar(acciones, { esDemo: true, hayNormas: true });

		await act(async () => result.current.iniciar(LOG_TYPE.inicioJornada));

		expect(acciones.verificarNormas).not.toHaveBeenCalled();
		expect(result.current.paso).toBeNull();
		expect(acciones.registrar).toHaveBeenCalledTimes(1);
	});

	it('"Aceptar normas" a mano: abre normas y al aceptar no registra nada', async () => {
		const acciones = crearAcciones();
		const { result } = montar(acciones);

		act(() => result.current.abrirNormas());
		expect(result.current.paso).toBe('normas');

		await act(async () => result.current.aceptarNormas());
		expect(result.current.paso).toBeNull();
		expect(acciones.registrar).not.toHaveBeenCalled();
	});
});
