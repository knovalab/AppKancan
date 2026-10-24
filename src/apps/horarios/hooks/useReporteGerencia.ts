import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { listarPeriodosResumen } from '../api/directus/periodos';
import {
	agregadoHorasExtras,
	listarTiendasReporte,
	type TiendaReporte,
	zonasDeTiendas,
} from '../api/directus/reportesHorasExtras';
import {
	ESTADO_HORA_EXTRA,
	periodoActual,
	rangoAnterior,
	reporteGerencia,
	resumenPorPeriodo,
} from '../domain/horasExtras';
import type { PeriodDto } from '../interfaces/api/period';
import { getRealColombiaTime } from '../utils/timeSync';
import { horariosKeys } from './registro/keys';
import { TODAS_EMPRESAS } from './useReporteHorasExtras';

/*
 * Datos de los reportes de gerencia. Solo pide lo que permite `time_log_gerencia`:
 * agregados de `com_over_time` sin `employee_id`, periodos sin `updated_by` y
 * tiendas sin `ultra_code`. Por eso no reutiliza los hooks de comercial/nómina.
 */

const SIN_TIENDAS: TiendaReporte[] = [];
const SIN_PERIODOS: PeriodDto[] = [];

// Bajo `horasExtras.todos`: aprobar, registrar o liquidar refresca el reporte.
const clave = (nombre: string) =>
	[...horariosKeys.horasExtras.todos, 'reporte', 'gerencia', nombre] as const;
const fresco = { staleTime: 60 * 1000, refetchInterval: 5 * 60 * 1000 };

function useTiendasReporte() {
	return useQuery({
		queryKey: ['tiendasReporte'],
		queryFn: listarTiendasReporte,
		staleTime: 30 * 60 * 1000,
	});
}

/** Tiempo real de gerencia: resumen de horas aprobadas por periodo y empresa. */
export function useTiempoRealGerencia(empresa: string) {
	const hoy = getRealColombiaTime().format('YYYY-MM-DD');
	const tiendasQ = useTiendasReporte();
	const periodosQ = useQuery({
		// Bajo `periodos`: crear o liquidar un periodo también lo refresca.
		queryKey: [...horariosKeys.periodos, 'resumen'],
		queryFn: listarPeriodosResumen,
		...fresco,
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
	// Aprobadas sin periodo, agregadas: lo que se vincularía a cada preliquidado.
	const porPagarQ = useQuery({
		queryKey: clave('por-pagar'),
		queryFn: () =>
			agregadoHorasExtras(
				{ estados: [ESTADO_HORA_EXTRA.aprobada], conPeriodo: false },
				['store_id', 'work_date'],
			),
		...fresco,
	});
	const pendientesQ = useQuery({
		queryKey: clave('pendientes'),
		queryFn: () =>
			agregadoHorasExtras({ estados: [ESTADO_HORA_EXTRA.pendiente] }, [
				'store_id',
			]),
		...fresco,
	});

	const tiendas = tiendasQ.data ?? SIN_TIENDAS;
	const empresas = useMemo(
		() =>
			[
				...new Set(
					tiendas.map((t) => t.company?.trim()).filter((c): c is string => !!c),
				),
			].sort((a, b) => a.localeCompare(b, 'es')),
		[tiendas],
	);
	const incluirTienda = useMemo(() => {
		if (empresa === TODAS_EMPRESAS) return () => true;
		const ids = new Set(
			tiendas.filter((t) => t.company?.trim() === empresa).map((t) => t.id),
		);
		return (id: number | null) => id != null && ids.has(id);
	}, [tiendas, empresa]);

	const periodos = periodosQ.data ?? SIN_PERIODOS;
	const resumen = useMemo(
		() =>
			resumenPorPeriodo(
				periodos,
				vinculadasQ.data ?? [],
				(porPagarQ.data ?? []).map((f) => ({
					work_date: f.fecha ?? '',
					status: ESTADO_HORA_EXTRA.aprobada,
					period_id: null,
					minutes: f.minutos,
					store_id: f.storeId,
					registros: f.registros,
				})),
				(h) => h.store_id as number | null,
				incluirTienda,
			),
		[periodos, vinculadasQ.data, porPagarQ.data, incluirTienda],
	);
	const pendientes = useMemo(() => {
		const t = { registros: 0, minutos: 0 };
		for (const f of pendientesQ.data ?? []) {
			if (!incluirTienda(f.storeId)) continue;
			t.registros += f.registros;
			t.minutos += f.minutos;
		}
		return t;
	}, [pendientesQ.data, incluirTienda]);

	const zonaDe = useMemo(() => {
		const porId = new Map(tiendas.map((t) => [t.id, t.zone?.trim() || null]));
		return (id: number) => porId.get(id) ?? null;
	}, [tiendas]);

	return {
		empresas,
		resumen,
		zonaDe,
		actual: periodoActual(periodos, hoy),
		pendientes,
		isLoading:
			tiendasQ.isLoading ||
			periodosQ.isLoading ||
			vinculadasQ.isLoading ||
			porPagarQ.isLoading ||
			pendientesQ.isLoading,
		error:
			tiendasQ.error ??
			periodosQ.error ??
			vinculadasQ.error ??
			porPagarQ.error ??
			pendientesQ.error,
	};
}

/**
 * Por zona de gerencia: zonas → tiendas, sin personas. `zona` vacía = todas.
 * Agrega por tienda × día; la variación compara con el rango anterior.
 */
export function useZonasGerencia(zona: string, desde: string, hasta: string) {
	const tiendasQ = useTiendasReporte();
	const tiendas = tiendasQ.data ?? SIN_TIENDAS;
	const zonas = useMemo(() => zonasDeTiendas(tiendas), [tiendas]);
	const elegida = zonas.find((z) => z.id === zona);
	// Zona elegida pero aún sin tiendas cargadas: se espera para no pedir todo.
	const ids = elegida?.tiendas ?? [];
	const listo = tiendasQ.isSuccess && (zona === '' || elegida != null);

	const antes = rangoAnterior(desde, hasta);
	const base = { estados: [ESTADO_HORA_EXTRA.aprobada], tiendas: ids };
	const actualQ = useQuery({
		queryKey: clave(`zona|${ids.join(',')}|${desde}|${hasta}`),
		queryFn: () =>
			agregadoHorasExtras({ ...base, desde, hasta }, ['store_id', 'work_date']),
		enabled: listo,
		...fresco,
	});
	const previoQ = useQuery({
		queryKey: clave(
			`zona-previo|${ids.join(',')}|${antes.desde}|${antes.hasta}`,
		),
		queryFn: () => agregadoHorasExtras({ ...base, ...antes }, ['store_id']),
		enabled: listo,
		...fresco,
	});

	const porId = useMemo(
		() => new Map(tiendas.map((t) => [t.id, t])),
		[tiendas],
	);
	const reporte = useMemo(
		() =>
			reporteGerencia(
				actualQ.data ?? [],
				new Map(
					(previoQ.data ?? [])
						.filter((f) => f.storeId != null)
						.map((f) => [f.storeId as number, f.minutos]),
				),
				(id) => porId.get(id)?.zone?.trim() || null,
			),
		[actualQ.data, previoQ.data, porId],
	);

	return {
		zonas,
		reporte,
		antes,
		nombreTienda: (id: number) => porId.get(id)?.name ?? `Tienda ${id}`,
		isLoading: tiendasQ.isLoading || actualQ.isLoading || previoQ.isLoading,
		error: tiendasQ.error ?? actualQ.error ?? previoQ.error,
	};
}
