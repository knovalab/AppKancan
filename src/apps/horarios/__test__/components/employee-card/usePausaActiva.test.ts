import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePausaActiva } from '@/apps/horarios/components/employee-card/hooks/usePausaActiva';
import { DURACION_PAUSA_ACTIVA_MS } from '@/apps/horarios/domain/registro';

const CLAVE = 'activeBreakExpires_101';

describe('usePausaActiva', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		localStorage.clear();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('iniciar guarda el vencimiento y marca la pausa en curso', () => {
		const reportar = vi.fn().mockResolvedValue({ ok: true });
		const { result } = renderHook(() => usePausaActiva('101', false, reportar));

		act(() => result.current.iniciar());

		expect(result.current.pausaEnCurso).toBe(true);
		expect(Number(localStorage.getItem(CLAVE))).toBe(result.current.expiraEn);
	});

	it('al vencer reporta el fin y SOLO entonces borra la clave', async () => {
		const reportar = vi.fn().mockResolvedValue({ ok: true });
		const { result } = renderHook(() => usePausaActiva('101', false, reportar));

		act(() => result.current.iniciar());
		await act(async () => {
			await vi.advanceTimersByTimeAsync(DURACION_PAUSA_ACTIVA_MS);
		});

		expect(reportar).toHaveBeenCalledTimes(1);
		expect(result.current.pausaEnCurso).toBe(false);
		expect(localStorage.getItem(CLAVE)).toBeNull();
	});

	it('si el reporte falla, conserva la clave y reintenta (la pausa no se pierde: E3)', async () => {
		const reportar = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, error: 'sin red' })
			.mockResolvedValueOnce({ ok: true });
		const { result } = renderHook(() => usePausaActiva('101', false, reportar));

		act(() => result.current.iniciar());
		await act(async () => {
			await vi.advanceTimersByTimeAsync(DURACION_PAUSA_ACTIVA_MS);
		});
		expect(reportar).toHaveBeenCalledTimes(1);
		expect(localStorage.getItem(CLAVE)).not.toBeNull();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});
		expect(reportar).toHaveBeenCalledTimes(2);
		expect(localStorage.getItem(CLAVE)).toBeNull();
	});

	it('al montar retoma una pausa en curso guardada', () => {
		localStorage.setItem(CLAVE, String(Date.now() + 60_000));
		const { result } = renderHook(() =>
			usePausaActiva('101', false, vi.fn().mockResolvedValue({ ok: true })),
		);
		expect(result.current.pausaEnCurso).toBe(true);
	});

	it('demo: no usa localStorage', () => {
		const { result } = renderHook(() =>
			usePausaActiva('99999', true, vi.fn().mockResolvedValue({ ok: true })),
		);
		act(() => result.current.iniciar());
		expect(result.current.pausaEnCurso).toBe(true);
		expect(localStorage.length).toBe(0);
	});
});
