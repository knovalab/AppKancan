import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HorariosAcceso } from '../interfaces/acceso';
import type {
	Tienda,
	TiendaSeleccion,
	TiendaSeleccionada,
} from '../interfaces/tiendas';
import type { ModoTienda } from '../navigation/secciones';

export const PARAM_TIENDA = 'tienda';
const VALOR_TODAS = 'todas';

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
		if (roles.has('tienda') || tiendasPermitidas.length === 0) {
			return { tipo: 'propia' };
		}

		const pedida = leerParam(params.get(PARAM_TIENDA));
		if (pedida?.tipo === 'una' && permitida(pedida.id)) return pedida;
		if (pedida?.tipo === 'todas' && modo === 'una-o-todas') return pedida;

		// Roles "solo reporte", comercial y nómina: por defecto ven todas.
		if (
			(rolPrincipal === 'report' ||
				rolPrincipal === 'comercial' ||
				rolPrincipal === 'nomina') &&
			modo === 'una-o-todas'
		) {
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
