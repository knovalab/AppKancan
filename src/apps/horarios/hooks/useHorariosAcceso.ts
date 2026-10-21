import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { obtenerTiendasIdsUsuarioActual } from '@/services/directus/userStores';
import { getStoreIdUsuarioActual, getStores } from '../api/directus/read';
import type { HorariosAcceso } from '../interfaces/acceso';
import type { Tienda } from '../interfaces/tiendas';
import {
	INICIO_POR_ROL,
	PRIORIDAD_ROL,
	type Rol,
} from '../navigation/secciones';
import { horariosKeys } from './registro/keys';
import useHorariosPolicies from './useHorariosPolicies';

const TIENDA_EXCLUIDA_AREA = 5;
const SIN_TIENDAS: Tienda[] = [];

const idDeTienda = (valor: unknown): number => {
	if (valor && typeof valor === 'object') {
		const obj = valor as { id?: unknown; store_id?: unknown };
		return Number(obj.id ?? obj.store_id);
	}
	return Number(valor);
};

/**
 * Roles y tiendas permitidas del usuario, resueltos una sola vez.
 * Reutiliza `useHorariosPolicies` para no crear una segunda definición de cada rol,
 * y usa las mismas query keys que el resto de la app para compartir caché.
 */
export function useHorariosAcceso(): HorariosAcceso {
	const { user, loading: cargandoAuth } = useAuth();
	const { esAdmin, esAreaManager, esReport, esComercial, esNomina, puedeVerDemo } =
		useHorariosPolicies();

	const admin = esAdmin();
	const areaManager = esAreaManager() && !admin;
	const report = esReport();
	const comercial = esComercial();
	const nomina = esNomina();

	const roles = useMemo(() => {
		const set = new Set<Rol>();
		if (admin) set.add('admin');
		if (areaManager) set.add('areaManager');
		if (report) set.add('report');
		if (comercial) set.add('comercial');
		if (nomina) set.add('nomina');
		if (!admin && !areaManager && !report) set.add('tienda');
		return set as ReadonlySet<Rol>;
	}, [admin, areaManager, report, comercial, nomina]);

	const rolPrincipal = PRIORIDAD_ROL.find((r) => roles.has(r)) ?? 'tienda';

	const puede = useCallback(
		(permitidos: readonly Rol[]) => permitidos.some((r) => roles.has(r)),
		[roles],
	);

	const { data: tiendaPropia = null } = useQuery<number | null>({
		queryKey: horariosKeys.storeUsuario,
		queryFn: getStoreIdUsuarioActual,
		enabled: !!user,
		staleTime: 30 * 60 * 1000,
	});

	const { data: todasLasTiendas = [], isLoading: cargandoTiendas } = useQuery<
		Tienda[]
	>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		enabled: admin || report || areaManager || comercial || nomina,
		staleTime: 30 * 60 * 1000,
	});

	const { data: tiendasAcceso = [], isLoading: cargandoAcceso } = useQuery<
		number[]
	>({
		queryKey: ['tiendasAccesoUsuario'],
		queryFn: () => obtenerTiendasIdsUsuarioActual({ excludeOnline: true }),
		enabled: areaManager,
		staleTime: 30 * 60 * 1000,
	});

	const tiendasPermitidas = useMemo<Tienda[]>(() => {
		if (areaManager) {
			const ids = new Set(
				tiendasAcceso
					.map(idDeTienda)
					.filter((id) => Number.isFinite(id) && id !== TIENDA_EXCLUIDA_AREA),
			);
			return todasLasTiendas.filter((t) => ids.has(Number(t.id)));
		}
		if (admin || report) return todasLasTiendas;
		return [];
	}, [areaManager, admin, report, tiendasAcceso, todasLasTiendas]);

	const tiendasGlobales = comercial || nomina ? todasLasTiendas : SIN_TIENDAS;

	const cargando =
		cargandoAuth ||
		!user ||
		((admin || report || areaManager || comercial || nomina) && cargandoTiendas) ||
		(areaManager && cargandoAcceso);
	const verDemo = puedeVerDemo();

	return useMemo(
		() => ({
			cargando,
			roles,
			rolPrincipal,
			puede,
			inicio: INICIO_POR_ROL[rolPrincipal],
			puedeVerDemo: verDemo,
			tiendaPropia,
			tiendasPermitidas,
			tiendasGlobales,
		}),
		[
			cargando,
			roles,
			rolPrincipal,
			puede,
			verDemo,
			tiendaPropia,
			tiendasPermitidas,
			tiendasGlobales,
		],
	);
}
