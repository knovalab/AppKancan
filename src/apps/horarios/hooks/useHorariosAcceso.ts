import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { obtenerTiendasIdsUsuarioActual } from '@/services/directus/userStores';

import { getStoreIdUsuarioActual, getStores } from '../api/directus/read';
import type { Tienda } from '../interfaces/horarios.interface';
import {
	INICIO_POR_ROL,
	PRIORIDAD_ROL,
	type Rol,
} from '../navigation/secciones';
import useHorariosPolicies from './useHorariosPolicies';

/** Tienda que se excluye del listado del Area Manager (mismo criterio que RegistrosPage). */
const TIENDA_EXCLUIDA_AREA = 5;

export interface HorariosAcceso {
	cargando: boolean;
	roles: ReadonlySet<Rol>;
	rolPrincipal: Rol;
	puede: (roles: readonly Rol[]) => boolean;
	/** Sección inicial (relativa a BASE) según el rol principal. */
	inicio: string;
	puedeVerDemo: boolean;
	/** Tienda asignada al usuario en Directus (`readMe().store_id`). */
	tiendaPropia: number | null;
	/** admin/report: todas · areaManager: sus tiendas asignadas · tienda: ninguna. */
	tiendasPermitidas: Tienda[];
}

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
	const { esAdmin, esAreaManager, esReport, puedeVerDemo } =
		useHorariosPolicies();

	const admin = esAdmin();
	const areaManager = esAreaManager() && !admin;
	const report = esReport();

	const roles = useMemo(() => {
		const set = new Set<Rol>();
		if (admin) set.add('admin');
		if (areaManager) set.add('areaManager');
		if (report) set.add('report');
		if (!admin && !areaManager && !report) set.add('tienda');
		return set as ReadonlySet<Rol>;
	}, [admin, areaManager, report]);

	const rolPrincipal = PRIORIDAD_ROL.find((r) => roles.has(r)) ?? 'tienda';

	const puede = useCallback(
		(permitidos: readonly Rol[]) => permitidos.some((r) => roles.has(r)),
		[roles],
	);

	const { data: tiendaPropia = null } = useQuery<number | null>({
		queryKey: ['horariosStoreId'],
		queryFn: getStoreIdUsuarioActual,
		enabled: !!user,
		staleTime: 30 * 60 * 1000,
	});

	const { data: todasLasTiendas = [], isLoading: cargandoTiendas } = useQuery<
		Tienda[]
	>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		enabled: admin || report || areaManager,
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

	const cargando =
		cargandoAuth ||
		!user ||
		((admin || report || areaManager) && cargandoTiendas) ||
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
		}),
		[
			cargando,
			roles,
			rolPrincipal,
			puede,
			verDemo,
			tiendaPropia,
			tiendasPermitidas,
		],
	);
}
