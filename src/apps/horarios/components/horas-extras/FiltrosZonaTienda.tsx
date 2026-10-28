import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useMemo, useState } from 'react';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import { useZonas } from '../../hooks/useReporteHorasExtras';

const TODAS = '';

/** Zona y tienda elegidas entre las tiendas permitidas; `tiendas` es lo que se consulta. */
export function useFiltroZonaTienda() {
	const { acceso } = useHorariosLayout();
	const [zonaId, setZonaId] = useState(TODAS);
	const [tiendaId, setTiendaId] = useState<number | ''>('');
	const zonas = useZonas(true).data ?? [];
	const zona = zonas.find((z) => z.id === zonaId);
	const opcionesTienda = useMemo(
		() =>
			acceso.tiendasPermitidas
				.filter((t) => !zona || zona.tiendas.includes(Number(t.id)))
				.sort((a, b) => a.name.localeCompare(b.name, 'es')),
		[acceso.tiendasPermitidas, zona],
	);
	const tiendas = useMemo(
		() =>
			tiendaId === '' ? opcionesTienda.map((t) => Number(t.id)) : [tiendaId],
		[tiendaId, opcionesTienda],
	);
	return {
		zonas,
		zonaId,
		setZonaId,
		tiendaId,
		setTiendaId,
		opcionesTienda,
		tiendas,
	};
}

export function FiltrosZonaTienda({
	filtro,
	onCambio,
}: {
	filtro: ReturnType<typeof useFiltroZonaTienda>;
	onCambio: () => void;
}) {
	return (
		<>
			<FormControl size="small" sx={{ minWidth: 180 }}>
				<InputLabel id="fzt-zona">Zona</InputLabel>
				<Select
					labelId="fzt-zona"
					label="Zona"
					value={filtro.zonaId}
					onChange={(e) => {
						filtro.setZonaId(e.target.value);
						filtro.setTiendaId('');
						onCambio();
					}}
				>
					<MenuItem value={TODAS}>Todas las zonas</MenuItem>
					{filtro.zonas.map((z) => (
						<MenuItem key={z.id} value={z.id}>
							{z.nombre}
						</MenuItem>
					))}
				</Select>
			</FormControl>
			<FormControl size="small" sx={{ minWidth: 180 }}>
				<InputLabel id="fzt-tienda">Tienda</InputLabel>
				<Select
					labelId="fzt-tienda"
					label="Tienda"
					value={filtro.tiendaId}
					onChange={(e) => {
						// Ids de tienda nunca son 0: '' (Todas) → ''.
						filtro.setTiendaId(Number(e.target.value) || '');
						onCambio();
					}}
				>
					<MenuItem value="">Todas las tiendas</MenuItem>
					{filtro.opcionesTienda.map((t) => (
						<MenuItem key={t.id} value={t.id}>
							{t.name}
						</MenuItem>
					))}
				</Select>
			</FormControl>
		</>
	);
}
