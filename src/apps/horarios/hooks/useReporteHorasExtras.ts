import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { listarHorasExtras } from '../api/directus/horasExtras';
import { getStores, STORE_PRUEBAS } from '../api/directus/read';
import { getEmpleadosBulk } from '../api/directus/readBulk';
import { idRelacion } from '../api/directus/relacion';
import {
	agregadoHorasExtras,
	listarZonas,
} from '../api/directus/reportesHorasExtras';
import {
	calidadProceso,
	ESTADO_HORA_EXTRA,
	type HoraCalidad,
	periodoActual,
	periodosVencidos,
	rangoAnterior,
	reporteZona,
	resumenPorPeriodo,
} from '../domain/horasExtras';
import type { PeriodDto } from '../interfaces/api/period';
import type { Tienda } from '../interfaces/tiendas';
import { formatNombrePropio } from '../utils/format';
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
/** `tienda`: una tienda (de la empresa elegida); `null` = todas. */
export function useReporteTiempoReal(
	empresa: string,
	tienda: number | null = null,
) {
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
	// Tiendas de la empresa elegida (sin la de pruebas): opciones del filtro de tienda.
	const tiendasEmpresa = useMemo(
		() =>
			tiendas
				.filter(
					(t) =>
						Number(t.id) !== STORE_PRUEBAS &&
						(empresa === TODAS_EMPRESAS || t.company?.trim() === empresa),
				)
				.sort((a, b) => a.name.localeCompare(b.name, 'es')),
		[tiendas, empresa],
	);
	const incluirTienda = useMemo(() => {
		if (tienda != null) return (id: number | null) => id === tienda;
		if (empresa === TODAS_EMPRESAS) return () => true;
		const ids = new Set(tiendasEmpresa.map((t) => Number(t.id)));
		return (id: number | null) => id != null && ids.has(id);
	}, [tiendasEmpresa, empresa, tienda]);

	// Nombre y empresa de cada fila del detalle por tienda.
	const tiendaDe = useMemo(() => {
		const porId = new Map(tiendas.map((t) => [Number(t.id), t]));
		return (id: number | null) =>
			(id != null && porId.get(id)) || {
				name: id == null ? 'Sin tienda' : `Tienda ${id}`,
				company: '',
			};
	}, [tiendas]);

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
		tiendasEmpresa,
		tiendaDe,
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

/** Zonas de las tiendas (`core_stores.zone`) y sus tiendas. */
export function useZonas(enabled: boolean) {
	return useQuery({
		queryKey: ['zonasTiendas'],
		queryFn: listarZonas,
		enabled,
		staleTime: 30 * 60 * 1000,
	});
}

/**
 * Reporte por zona (R2 + R4): horas **aprobadas** del rango en las tiendas
 * indicadas (las de la zona; vacío = todas), por tienda → persona → día.
 */
export function useReporteZona(
	tiendas: number[],
	desde: string,
	hasta: string,
	enabled = true,
) {
	const antes = rangoAnterior(desde, hasta);
	const base = { estados: [ESTADO_HORA_EXTRA.aprobada], tiendas };
	const actualQ = useQuery({
		queryKey: clave(`zona|${tiendas.join(',')}|${desde}|${hasta}`),
		queryFn: () =>
			agregadoHorasExtras({ ...base, desde, hasta }, [
				'store_id',
				'employee_id',
				'work_date',
			]),
		enabled,
		...fresco,
	});
	const previoQ = useQuery({
		queryKey: clave(
			`zona-previo|${tiendas.join(',')}|${antes.desde}|${antes.hasta}`,
		),
		queryFn: () => agregadoHorasExtras({ ...base, ...antes }, ['store_id']),
		enabled,
		...fresco,
	});
	const tiendasQ = useQuery<Tienda[]>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		staleTime: 30 * 60 * 1000,
	});
	// Plantilla y nombres de las tiendas consultadas (o de todas).
	const idsEmpleados = tiendas.length
		? tiendas
		: (tiendasQ.data ?? SIN_TIENDAS).map((t) => Number(t.id));
	const empleadosQ = useQuery({
		queryKey: horariosKeys.empleados.tiendas(idsEmpleados),
		queryFn: () => getEmpleadosBulk(idsEmpleados),
		// Sin tiendas no se consulta: getEmpleadosBulk sin filtro traería a todos.
		enabled: enabled && idsEmpleados.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	const empleados = empleadosQ.data;
	const { plantilla, personas } = useMemo(() => {
		const plantilla = new Map<number, number>();
		const personas = new Map<number, { nombre: string; documento: string }>();
		for (const e of empleados ?? []) {
			if (e.storeId != null)
				plantilla.set(e.storeId, (plantilla.get(e.storeId) ?? 0) + 1);
			personas.set(Number(e.id), {
				nombre: formatNombrePropio(e.nombre),
				documento: e.documento,
			});
		}
		return { plantilla, personas };
	}, [empleados]);

	const reporte = useMemo(
		() =>
			reporteZona(
				actualQ.data ?? [],
				new Map((previoQ.data ?? []).map((f) => [f.storeId ?? -1, f.minutos])),
				plantilla,
			),
		[actualQ.data, previoQ.data, plantilla],
	);
	const nombresTiendas = useMemo(
		() =>
			new Map(
				(tiendasQ.data ?? SIN_TIENDAS).map((t) => [Number(t.id), t.name]),
			),
		[tiendasQ.data],
	);

	return {
		reporte,
		personas,
		nombresTiendas,
		antes,
		isLoading: actualQ.isLoading || previoQ.isLoading,
		error: actualQ.error ?? previoQ.error ?? empleadosQ.error,
	};
}

const fechaLocal = (f?: string | null) =>
	f ? dayjs(f).format('YYYY-MM-DD HH:mm') : null;

/**
 * Calidad del proceso (R5): las horas extras del rango (por fecha trabajada) en
 * las tiendas indicadas (vacío = todas), con sus fechas de registro y revisión.
 */
export function useCalidadProceso(
	tiendas: number[],
	desde: string,
	hasta: string,
	enabled = true,
) {
	const horasQ = useQuery({
		queryKey: clave(`calidad|${tiendas.join(',')}|${desde}|${hasta}`),
		// shortcut: trae las filas del rango (no agregado); si el rango crece a años, paginar o agregar en Directus.
		queryFn: () =>
			listarHorasExtras({
				tiendas,
				desde,
				hasta,
				estados: [
					ESTADO_HORA_EXTRA.pendiente,
					ESTADO_HORA_EXTRA.aprobada,
					ESTADO_HORA_EXTRA.descartadaComercial,
				],
			}),
		enabled,
		...fresco,
	});
	const tiendasQ = useQuery<Tienda[]>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		staleTime: 30 * 60 * 1000,
	});

	const calidad = useMemo(
		() =>
			calidadProceso(
				(horasQ.data ?? []).map(
					(h): HoraCalidad => ({
						storeId: idRelacion(h.store_id),
						empleadoId: idRelacion(h.employee_id),
						registrador:
							h.created_by && typeof h.created_by === 'object'
								? formatNombrePropio(
										`${h.created_by.first_name ?? ''} ${h.created_by.last_name ?? ''}`.trim(),
									) || null
								: null,
						fecha: h.work_date,
						estado: h.status,
						creada: fechaLocal(h.created_at),
						revisada: fechaLocal(h.reviewed_at),
						inicioPeriodo:
							h.period_id && typeof h.period_id === 'object'
								? (h.period_id.start_date ?? null)
								: null,
						minutos: h.minutes,
					}),
				),
			),
		[horasQ.data],
	);
	const nombresTiendas = useMemo(
		() =>
			new Map(
				(tiendasQ.data ?? SIN_TIENDAS).map((t) => [String(t.id), t.name]),
			),
		[tiendasQ.data],
	);

	return {
		calidad,
		nombreTienda: (clave: string) =>
			nombresTiendas.get(clave) ?? (clave ? `Tienda ${clave}` : 'Sin tienda'),
		isLoading: horasQ.isLoading,
		error: horasQ.error,
	};
}
