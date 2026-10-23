import { useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { useMemo } from 'react';
import { fetchTimeRecordStore } from '../api/directus/read';
import type { RegistroTienda } from '../interfaces/registroTienda';
import type { Tienda } from '../interfaces/tiendas';
import { mapearTimeRecordStoreDtoARegistroTienda } from '../utils/registroTienda';

export interface UseReporteTiendasDataProps {
	targetStores: number[];
	rangoInicio: Dayjs | null;
	rangoFin: Dayjs | null;
	tiendasAMostrar: Tienda[];
	enabled?: boolean;
}

export function useReporteTiendasData({
	targetStores,
	rangoInicio,
	rangoFin,
	tiendasAMostrar,
	enabled = true,
}: UseReporteTiendasDataProps) {
	const fechaInicioStr = rangoInicio
		? rangoInicio.format('YYYY-MM-DD')
		: undefined;
	const fechaFinStr = rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined;

	const { data: dbRecordsTienda = [], isLoading: cargandoRecordsTiendas } =
		useQuery({
			queryKey: [
				'timeRecordStoreDirectus',
				targetStores,
				fechaInicioStr,
				fechaFinStr,
			],
			queryFn: () => {
				if (targetStores.length === 0) return Promise.resolve([]);
				return fetchTimeRecordStore(fechaInicioStr, fechaFinStr, targetStores);
			},
			enabled: enabled && targetStores.length > 0,
			staleTime: 5 * 60 * 1000,
		});

	const registrosTiendaCalculados = useMemo<RegistroTienda[]>(() => {
		if (!enabled) return [];
		const storesMap = new Map<number, string>(
			tiendasAMostrar.map((t) => [Number(t.id), t.name]),
		);
		return dbRecordsTienda.map((r) =>
			mapearTimeRecordStoreDtoARegistroTienda(r, storesMap),
		);
	}, [enabled, dbRecordsTienda, tiendasAMostrar]);

	return {
		registrosTiendaCalculados,
		cargandoRecordsTiendas,
	};
}
