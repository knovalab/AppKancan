import {
	Alert,
	Box,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from '@mui/material';
import { useState } from 'react';
import { useZonasGerencia } from '../../../hooks/useReporteGerencia';
import { mensajeDeError } from '../../../utils/errores';
import {
	Bloque,
	BORDE,
	Cargando,
	Filtros,
	GRIS,
	horasCortas,
	Kpi,
	Kpis,
	TACTIL,
} from './bloques';
import { SelectorTiempo, useSelectorTiempo } from './SelectorTiempo';

const TODAS = '';
const nombreZona = (z: string | null) => z ?? 'Sin zona';
const head = { fontWeight: 700, color: '#1e293b', bgcolor: '#f0f7ff' };
// Filas cómodas al tacto y sin desbordar en teléfono: el nombre largo baja de línea.
const fila = {
	'& td': { py: 1.25, px: { xs: 1, sm: 2 } },
	'& td:first-of-type': { wordBreak: 'break-word' },
};

/**
 * Por tienda de gerencia: total de horas extras aprobadas de cada tienda en un
 * periodo o un mes, filtrable por zona. Una tabla simple de tres columnas
 * (tienda, zona, horas), la misma en teléfono y escritorio.
 */
export default function GerenciaPorTienda() {
	const [zona, setZona] = useState(TODAS);
	const tiempo = useSelectorTiempo(['periodo', 'mes']);
	const { zonas, reporte, nombreTienda, isLoading, error } = useZonasGerencia(
		zona,
		tiempo.desde,
		tiempo.hasta,
		tiempo.listo,
	);

	return (
		<Box>
			<Filtros resumen={`${zona || 'Todas las zonas'} · ${tiempo.etiqueta}`}>
				<FormControl
					size="small"
					fullWidth
					sx={{
						minWidth: { sm: 200 },
						width: { sm: 'auto' },
						'& .MuiInputBase-root': { minHeight: TACTIL },
					}}
				>
					<InputLabel id="gt-zona">Zona</InputLabel>
					<Select
						labelId="gt-zona"
						label="Zona"
						value={zona}
						onChange={(e) => setZona(e.target.value)}
					>
						<MenuItem value={TODAS}>Todas las zonas</MenuItem>
						{zonas.map((z) => (
							<MenuItem key={z.id} value={z.id}>
								{z.nombre}
							</MenuItem>
						))}
					</Select>
				</FormControl>
				<SelectorTiempo selector={tiempo} />
			</Filtros>

			{(error || tiempo.error) && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(
						error ?? tiempo.error,
						'Error al cargar el reporte por tienda',
					)}
				</Alert>
			)}

			{tiempo.cargando || isLoading ? (
				<Cargando />
			) : tiempo.sinPeriodos ? (
				<Alert severity="info">Aún no hay periodos creados.</Alert>
			) : reporte.tiendas.length === 0 ? (
				<Alert severity="info">
					No hay horas aprobadas {zona ? `en ${zona} ` : ''}en {tiempo.etiqueta}
					.
				</Alert>
			) : (
				<>
					<Kpis>
						<Kpi
							principal
							titulo={`Horas extras · ${zona || 'todas las zonas'}`}
							valor={horasCortas(reporte.total.minutos)}
							nota={tiempo.etiqueta}
						/>
						<Kpi
							titulo="Tiendas con horas"
							valor={String(reporte.tiendas.length)}
						/>
					</Kpis>

					<Bloque titulo="Horas extras por tienda">
						<TableContainer
							sx={{ borderRadius: 2, border: BORDE, bgcolor: '#fff' }}
						>
							<Table size="small" aria-label="Horas extras por tienda">
								<TableHead>
									<TableRow>
										<TableCell sx={head}>Tienda</TableCell>
										<TableCell sx={head}>Zona</TableCell>
										<TableCell sx={head} align="right">
											Horas
										</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{reporte.tiendas.map((t) => (
										<TableRow key={t.storeId} hover sx={fila}>
											<TableCell sx={{ fontWeight: 600 }}>
												{nombreTienda(t.storeId)}
											</TableCell>
											<TableCell sx={{ color: GRIS }}>
												{nombreZona(t.zona)}
											</TableCell>
											<TableCell
												align="right"
												sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
											>
												{horasCortas(t.minutos)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
						<Typography
							variant="caption"
							sx={{ display: 'block', mt: 1, color: GRIS }}
						>
							Solo horas aprobadas, en la tienda donde se trabajó.
						</Typography>
					</Bloque>
				</>
			)}
		</Box>
	);
}
