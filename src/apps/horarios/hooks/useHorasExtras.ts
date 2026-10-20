import { useQuery } from '@tanstack/react-query';
import {
	type FiltrosHorasExtras,
	listarHorasExtras,
} from '../api/directus/horasExtras';
import { horariosKeys } from './registro/keys';

export function useHorasExtras(filtros: FiltrosHorasExtras, enabled = true) {
	return useQuery({
		queryKey: horariosKeys.horasExtras.lista(filtros),
		queryFn: () => listarHorasExtras(filtros),
		enabled: enabled && (filtros.tiendas?.length ?? 0) > 0,
		staleTime: 60 * 1000,
	});
}
