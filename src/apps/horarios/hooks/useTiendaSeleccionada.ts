import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Tienda } from '../interfaces/horarios.interface';
import type { ModoTienda } from '../navigation/secciones';
import type { HorariosAcceso } from './useHorariosAcceso';

/** Query param donde viaja la tienda: `?tienda=12` · `?tienda=todas` · (ausente = por defecto). */
export const PARAM_TIENDA = 'tienda';
const VALOR_TODAS = 'todas';

export type TiendaSeleccion =
	| { tipo: 'propia' }
	| { tipo: 'todas' }
	| { tipo: 'una'; id: number };

export interface TiendaSeleccionada {
	/** Selección efectiva, ya validada contra el rol y la sección. */
	seleccion: TiendaSeleccion;
	/** Tienda concreta, o null cuando la selección es "todas". */
	storeId: number | null;
	/** Siempre explícito: [id] para una tienda, las permitidas para "todas". */
	storeIds: number[];
	/** Nombre para mostrar en el header ('' si es "todas" o se desconoce). */
	nombre: string;
	setSeleccion: (s: TiendaSeleccion) => void;
}

const leerParam = (valor: string | null): TiendaSeleccion | null => {
	if (valor === VALOR_TODAS) return { tipo: 'todas' };
	const id = Number(valor);
	return valor && Number.isFinite(id) && id > 0 ? { tipo: 'una', id } : null;
};

const escribirParam = (s: TiendaSeleccion): string | null => {
	if (s.tipo === 'todas') return VALOR_TODAS;
	if (s.tipo === 'una') return String(s.id);
	return null;
};

/**
 * Tienda seleccionada, persistida en la URL. Resuelve la ambigüedad del antiguo
 * `storeOverride = null` (ver docs/ANALISIS_RUTAS_HORARIOS.md §2.2).
 */
export function useTiendaSeleccionada(
	acceso: HorariosAcceso,
	modo: ModoTienda,
	nombreTiendaUsuario?: string,
): TiendaSeleccionada {
	const [params, setParams] = useSearchParams();
	const { tiendaPropia, tiendasPermitidas, roles, rolPrincipal } = acceso;

	const permitida = useCallback(
		(id: number) => tiendasPermitidas.some((t) => Number(t.id) === id),
		[tiendasPermitidas],
	);

	const seleccion = useMemo<TiendaSeleccion>(() => {
		// Usuario de tienda: siempre su propia tienda, ignore lo que diga la URL.
		if (roles.has('tienda') || tiendasPermitidas.length === 0) {
			return { tipo: 'propia' };
		}

		const pedida = leerParam(params.get(PARAM_TIENDA));
		if (pedida?.tipo === 'una' && permitida(pedida.id)) return pedida;
		if (pedida?.tipo === 'todas' && modo === 'una-o-todas') return pedida;

		// Rol "solo reporte": por defecto ve todas (comportamiento previo de RegistrosPage).
		if (rolPrincipal === 'report' && modo === 'una-o-todas') {
			return { tipo: 'todas' };
		}
		// Por defecto: la propia si está permitida; si no (Area Manager), todas o la primera.
		if (tiendaPropia != null && permitida(tiendaPropia))
			return { tipo: 'propia' };
		if (modo === 'una-o-todas') return { tipo: 'todas' };
		const primera = tiendasPermitidas[0];
		return primera
			? { tipo: 'una', id: Number(primera.id) }
			: { tipo: 'propia' };
	}, [
		params,
		roles,
		rolPrincipal,
		tiendasPermitidas,
		tiendaPropia,
		permitida,
		modo,
	]);

	const storeId =
		seleccion.tipo === 'una'
			? seleccion.id
			: seleccion.tipo === 'propia'
				? tiendaPropia
				: null;

	const storeIds = useMemo(
		() =>
			seleccion.tipo === 'todas'
				? tiendasPermitidas.map((t) => Number(t.id))
				: storeId != null
					? [storeId]
					: [],
		[seleccion.tipo, tiendasPermitidas, storeId],
	);

	const nombre = useMemo(() => {
		if (storeId == null) return '';
		const tienda: Tienda | undefined = tiendasPermitidas.find(
			(t) => Number(t.id) === storeId,
		);
		return (
			tienda?.name ??
			(seleccion.tipo === 'propia' ? (nombreTiendaUsuario ?? '') : '')
		);
	}, [storeId, tiendasPermitidas, seleccion.tipo, nombreTiendaUsuario]);

	const setSeleccion = useCallback(
		(s: TiendaSeleccion) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					const valor = escribirParam(s);
					if (valor == null) next.delete(PARAM_TIENDA);
					else next.set(PARAM_TIENDA, valor);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	return useMemo(
		() => ({ seleccion, storeId, storeIds, nombre, setSeleccion }),
		[seleccion, storeId, storeIds, nombre, setSeleccion],
	);
}
