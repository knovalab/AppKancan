import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
	type FiltrosHorasExtras,
	listarHorasExtras,
} from '../api/directus/horasExtras';
import {
	listarPeriodos,
	type TotalesPeriodo,
	totalesVinculados,
} from '../api/directus/periodos';
import {
	clasificarParaPeriodo,
	ESTADO_HORA_EXTRA,
	ESTADO_PERIODO,
	preliquidadoMasAntiguo,
	type RangoPeriodo,
} from '../domain/horasExtras';
import type { OverTimeDto } from '../interfaces/api/overTime';
import type { PeriodDto } from '../interfaces/api/period';
import { horariosKeys } from './registro/keys';

export function usePeriodos(enabled = true) {
	return useQuery({
		queryKey: horariosKeys.periodos,
		queryFn: listarPeriodos,
		enabled,
		staleTime: 60 * 1000,
	});
}

/** Consulta mínima: un liquidado lee sus vinculadas; un preliquidado, las aprobadas sin periodo hasta su fin. */
export function filtrosDePeriodo(
	periodo: RangoPeriodo,
	periodos: readonly RangoPeriodo[],
): FiltrosHorasExtras {
	if (periodo.status === ESTADO_PERIODO.liquidado)
		return { periodo: periodo.id };
	const conRezagadas = preliquidadoMasAntiguo(periodos)?.id === periodo.id;
	return {
		estados: [ESTADO_HORA_EXTRA.aprobada],
		sinPeriodo: true,
		desde: conRezagadas ? undefined : periodo.start_date,
		hasta: periodo.end_date,
	};
}

/**
 * Horas de un periodo. Liquidado: `vinculadas`. Preliquidado: lo que se
 * vincularía al liquidar (`delPeriodo` + `rezagadas`), recalculado en cada consulta.
 */
export function useHorasExtrasDePeriodo(
	periodo: RangoPeriodo | undefined,
	periodos: readonly RangoPeriodo[],
) {
	const filtros = periodo ? filtrosDePeriodo(periodo, periodos) : {};
	return useQuery({
		// Bajo horasExtras.todos: aprobar o liquidar invalida también esta consulta.
		queryKey: horariosKeys.horasExtras.lista(filtros),
		queryFn: () => listarHorasExtras(filtros),
		enabled: periodo != null,
		staleTime: 60 * 1000,
		select: (horas) =>
			periodo?.status === ESTADO_PERIODO.liquidado
				? { vinculadas: horas, delPeriodo: [], rezagadas: [] }
				: {
						vinculadas: [],
						...clasificarParaPeriodo(horas, periodo!, periodos),
					},
	});
}

export type PeriodoConTotales = PeriodDto & TotalesPeriodo;

/** Aprobadas aún sin periodo: lo que falta por pagar (base de todos los preliquidados). */
const POR_PAGAR: FiltrosHorasExtras = {
	estados: [ESTADO_HORA_EXTRA.aprobada],
	sinPeriodo: true,
};

/** Liquidado: lo vinculado (agregado en Directus). Preliquidado: lo que se vincularía hoy. */
export function totalesDePeriodos(
	periodos: readonly PeriodDto[],
	vinculados: ReadonlyMap<number, TotalesPeriodo>,
	porPagar: readonly OverTimeDto[],
): PeriodoConTotales[] {
	return periodos.map((p) => {
		if (p.status === ESTADO_PERIODO.liquidado)
			return { ...p, ...(vinculados.get(p.id) ?? { horas: 0, minutos: 0 }) };
		const { delPeriodo, rezagadas } = clasificarParaPeriodo(
			porPagar,
			p,
			periodos,
		);
		const horas = [...delPeriodo, ...rezagadas];
		return {
			...p,
			horas: horas.length,
			minutos: horas.reduce((s, h) => s + h.minutes, 0),
		};
	});
}

/** Periodos con sus totales: 3 consultas en total, sin importar cuántos periodos haya. */
export function usePeriodosConTotales() {
	const periodos = usePeriodos();
	const vinculados = useQuery({
		// Bajo `periodos`: invalidar los periodos refresca también sus totales.
		queryKey: [...horariosKeys.periodos, 'totales'],
		queryFn: totalesVinculados,
		staleTime: 60 * 1000,
	});
	const porPagar = useQuery({
		queryKey: horariosKeys.horasExtras.lista(POR_PAGAR),
		queryFn: () => listarHorasExtras(POR_PAGAR),
		staleTime: 60 * 1000,
	});
	const filas = useMemo(
		() =>
			totalesDePeriodos(
				periodos.data ?? [],
				vinculados.data ?? new Map(),
				porPagar.data ?? [],
			),
		[periodos.data, vinculados.data, porPagar.data],
	);
	return {
		periodos: periodos.data ?? [],
		filas,
		isLoading: periodos.isLoading || vinculados.isLoading || porPagar.isLoading,
		error: periodos.error ?? vinculados.error ?? porPagar.error,
	};
}
