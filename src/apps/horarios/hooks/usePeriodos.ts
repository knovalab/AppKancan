import { useQuery } from '@tanstack/react-query';
import { type FiltrosHorasExtras, listarHorasExtras } from '../api/directus/horasExtras';
import { listarPeriodos } from '../api/directus/periodos';
import {
	clasificarParaPeriodo,
	ESTADO_HORA_EXTRA,
	ESTADO_PERIODO,
	preliquidadoMasAntiguo,
	type RangoPeriodo,
} from '../domain/horasExtras';
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
	if (periodo.status === ESTADO_PERIODO.liquidado) return { periodo: periodo.id };
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
				: { vinculadas: [], ...clasificarParaPeriodo(horas, periodo!, periodos) },
	});
}
