import { useQuery } from '@tanstack/react-query';
import { getStoreIdUsuarioActual } from '../../api/directus/read';
import { horariosKeys } from './keys';

/** Tienda con la que trabaja el registro: la recibida o, si no hay, la del usuario (readMe). */
export function useTiendaActual(storeOverride?: number | null): number | null {
	const { data: storeUsuario = null } = useQuery<number | null>({
		queryKey: horariosKeys.storeUsuario,
		queryFn: getStoreIdUsuarioActual,
		staleTime: 30 * 60 * 1000,
	});
	return storeOverride != null ? storeOverride : storeUsuario;
}
