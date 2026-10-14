import { useQuery } from '@tanstack/react-query';
import { getReasons, getTiposNovedad } from '../../api/directus/read';
import type { Motivo, TipoNovedad } from '../../interfaces/horarios.interface';
import { horariosKeys } from './keys';

/** Catálogos del registro: motivos de edición de hora y tipos de novedad (2 queries compartidas). */
export function useCatalogosHorarios() {
	const reasons = useMotivosEdicion();

	const { data: tiposNovedad = [], error: errorTipos } = useQuery<
		TipoNovedad[]
	>({
		queryKey: horariosKeys.tiposNovedad,
		queryFn: getTiposNovedad,
		staleTime: 10 * 60 * 1000,
	});

	return { reasons, tiposNovedad, errorTipos };
}

/** Solo los motivos: para pantallas que no necesitan nada más del registro. */
export function useMotivosEdicion() {
	const { data: reasons = [] } = useQuery<Motivo[]>({
		queryKey: horariosKeys.reasons,
		queryFn: getReasons,
		staleTime: 10 * 60 * 1000,
	});
	return reasons;
}
