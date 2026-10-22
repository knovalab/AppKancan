import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { listarHorasExtras } from '../api/directus/horasExtras';
import { getStores } from '../api/directus/read';
import { idRelacion } from '../api/directus/relacion';
import { agregadoHorasExtras } from '../api/directus/reportesHorasExtras';
import {
	ESTADO_HORA_EXTRA,
	periodoActual,
	periodosVencidos,
	resumenPorPeriodo,
} from '../domain/horasExtras';
import type { PeriodDto } from '../interfaces/api/period';
import type { Tienda } from '../interfaces/tiendas';
import { getRealColombiaTime } from '../utils/timeSync';
import { horariosKeys } from './registro/keys';
import { POR_PAGAR, usePeriodos } from './usePeriodos';

/** Pendientes con más días que estos sin revisar se marcan como alerta. */
export const DIAS_ALERTA_PENDIENTE = 7;
/** Valor del filtro de empresa para "todas". */
export const TODAS_EMPRESAS = '';

// Vacíos estables: un `[]` nuevo en cada render invalidaría los useMemo.
const SIN_TIENDAS: Tienda[] = [];
const SIN_PERIODOS: PeriodDto[] = [];

// Bajo `horasExtras.todos`: aprobar, registrar o liquidar refresca el reporte.
const clave = (nombre: string) =>
	[...horariosKeys.horasExtras.todos, 'reporte', nombre] as const;
const fresco = { staleTime: 60 * 1000, refetchInterval: 5 * 60 * 1000 };

/**
 * Reporte en tiempo real por periodo (R1): solo horas **aprobadas** (por vincular
 * o liquidadas), con filtro por empresa. Las pendientes van aparte, como aviso.
 */
export function useReporteTiempoReal(empresa: string) {
	const hoy = getRealColombiaTime().format('YYYY-MM-DD');
	const periodosQ = usePeriodos();
	const tiendasQ = useQuery<Tienda[]>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		staleTime: 30 * 60 * 1000,
	});
	const vinculadasQ = useQuery({
		queryKey: clave('vinculadas'),
		queryFn: () =>
			agregadoHorasExtras(
				{ estados: [ESTADO_HORA_EXTRA.aprobada], conPeriodo: true },
				['period_id', 'store_id', 'work_date'],
			),
		...fresco,
	});
	const porPagarQ = useQuery({
		queryKey: horariosKeys.horasExtras.lista(POR_PAGAR),
		queryFn: () => listarHorasExtras(POR_PAGAR),
		...fresco,
	});
	const pendientesQ = useQuery({
		queryKey: clave('pendientes'),
		queryFn: () =>
			agregadoHorasExtras({ estados: [ESTADO_HORA_EXTRA.pendiente] }, [
				'store_id',
				'work_date',
			]),
		...fresco,
	});

	const tiendas = tiendasQ.data ?? SIN_TIENDAS;
	const empresas = useMemo(
		() =>
			[...new Set(tiendas.map((t) => t.company?.trim()).filter(Boolean))].sort(
				(a, b) => String(a).localeCompare(String(b), 'es'),
			) as string[],
		[tiendas],
	);
	const incluirTienda = useMemo(() => {
		if (empresa === TODAS_EMPRESAS) return () => true;
		const ids = new Set(
			tiendas
				.filter((t) => t.company?.trim() === empresa)
				.map((t) => Number(t.id)),
		);
		return (id: number | null) => id != null && ids.has(id);
	}, [tiendas, empresa]);

	const periodos = periodosQ.data ?? SIN_PERIODOS;
	const resumen = useMemo(
		() =>
			resumenPorPeriodo(
				periodos,
				vinculadasQ.data ?? [],
				porPagarQ.data ?? [],
				(h) => idRelacion(h.store_id),
				incluirTienda,
			),
		[periodos, vinculadasQ.data, porPagarQ.data, incluirTienda],
	);

	const pendientes = useMemo(() => {
		const limite = dayjs(hoy)
			.subtract(DIAS_ALERTA_PENDIENTE, 'day')
			.format('YYYY-MM-DD');
		const total = { registros: 0, minutos: 0 };
		let antiguas = 0;
		for (const f of pendientesQ.data ?? []) {
			if (!incluirTienda(f.storeId)) continue;
			total.registros += f.registros;
			total.minutos += f.minutos;
			if (f.fecha && f.fecha < limite) antiguas += f.registros;
		}
		return { ...total, antiguas };
	}, [pendientesQ.data, incluirTienda, hoy]);

	return {
		hoy,
		empresas,
		resumen,
		actual: periodoActual(periodos, hoy),
		vencidos: periodosVencidos(periodos, hoy),
		pendientes,
		isLoading:
			periodosQ.isLoading ||
			vinculadasQ.isLoading ||
			porPagarQ.isLoading ||
			pendientesQ.isLoading,
		error:
			periodosQ.error ??
			vinculadasQ.error ??
			porPagarQ.error ??
			pendientesQ.error,
	};
}
