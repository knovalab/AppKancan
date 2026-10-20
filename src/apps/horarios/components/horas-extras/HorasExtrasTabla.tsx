import MoreTimeIcon from '@mui/icons-material/MoreTime';
import {
	Checkbox,
	Chip,
	CircularProgress,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Tooltip,
	Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { formatoMinutos } from '../../domain/horasExtras';
import type { HoraExtraFila } from '../../interfaces/horasExtras';
import { HoraExtraEstadoChip } from './HoraExtraEstadoChip';

const COLUMNAS = [
	'Fecha',
	'Asesor',
	'Tienda',
	'Horas',
	'Observación',
	'Creada por',
	'Estado',
];

const celdaHead = { fontWeight: 700, py: 1.5, color: '#1e293b' };

export interface HorasExtrasTablaProps {
	filas: HoraExtraFila[];
	loading?: boolean;
	vacio?: string;
	seleccion?: {
		ids: ReadonlySet<number>;
		onCambiar: (ids: number[], marcar: boolean) => void;
	};
	acciones?: (fila: HoraExtraFila) => ReactNode;
}

export function HorasExtrasTabla({
	filas,
	loading = false,
	vacio = 'No hay horas extras con estos filtros',
	seleccion,
	acciones,
}: HorasExtrasTablaProps) {
	const columnas = COLUMNAS.length + (seleccion ? 1 : 0) + (acciones ? 1 : 0);
	const marcadas = seleccion
		? filas.filter((f) => seleccion.ids.has(f.id)).length
		: 0;
	return (
		<TableContainer
			sx={{ overflow: 'auto', borderRadius: 2, border: '1px solid #e2e8f0' }}
		>
			<Table sx={{ minWidth: 900 }} aria-label="Horas extras">
				<TableHead sx={{ bgcolor: '#f0f7ff' }}>
					<TableRow>
						{seleccion && (
							<TableCell padding="checkbox">
								<Checkbox
									checked={filas.length > 0 && marcadas === filas.length}
									indeterminate={marcadas > 0 && marcadas < filas.length}
									disabled={filas.length === 0}
									onChange={(e) =>
										seleccion.onCambiar(
											filas.map((f) => f.id),
											e.target.checked,
										)
									}
									slotProps={{ input: { 'aria-label': 'Seleccionar todas' } }}
								/>
							</TableCell>
						)}
						{COLUMNAS.map((c) => (
							<TableCell key={c} sx={celdaHead}>
								{c}
							</TableCell>
						))}
						{acciones && <TableCell sx={celdaHead} align="right" />}
					</TableRow>
				</TableHead>
				<TableBody>
					{loading ? (
						<TableRow>
							<TableCell colSpan={columnas} align="center" sx={{ py: 6 }}>
								<CircularProgress size={32} sx={{ color: '#004680' }} />
								<Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
									Cargando horas extras...
								</Typography>
							</TableCell>
						</TableRow>
					) : filas.length === 0 ? (
						<TableRow>
							<TableCell colSpan={columnas} align="center" sx={{ py: 6 }}>
								<MoreTimeIcon sx={{ fontSize: 44, color: '#94a3b8' }} />
								<Typography
									variant="body1"
									sx={{ mt: 1, fontWeight: 600, color: '#475569' }}
								>
									{vacio}
								</Typography>
							</TableCell>
						</TableRow>
					) : (
						filas.map((f) => (
							<TableRow
								key={f.id}
								hover
								selected={seleccion?.ids.has(f.id) ?? false}
							>
								{seleccion && (
									<TableCell padding="checkbox">
										<Checkbox
											checked={seleccion.ids.has(f.id)}
											onChange={(e) =>
												seleccion.onCambiar([f.id], e.target.checked)
											}
											slotProps={{
												input: { 'aria-label': `Seleccionar ${f.empleado}` },
											}}
										/>
									</TableCell>
								)}
								<TableCell sx={{ whiteSpace: 'nowrap' }}>
									{dayjs(f.fecha).format('DD/MM/YYYY')}
								</TableCell>
								<TableCell>
									<Typography variant="body2" sx={{ fontWeight: 600 }}>
										{f.empleado}
									</Typography>
								</TableCell>
								<TableCell>
									{f.tienda || '--'}
									{f.rotacion && (
										<Tooltip title="Trabajó en una tienda distinta a la suya">
											<Chip
												label="Rotación"
												size="small"
												variant="outlined"
												sx={{ ml: 1 }}
											/>
										</Tooltip>
									)}
								</TableCell>
								<TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
									{formatoMinutos(f.minutos)}
								</TableCell>
								<TableCell sx={{ maxWidth: 260 }}>
									<Typography variant="body2" noWrap title={f.observacion}>
										{f.observacion || '--'}
									</Typography>
								</TableCell>
								<TableCell>
									<Typography variant="body2">{f.creadaPor || '--'}</Typography>
									{f.creadaEl && (
										<Typography variant="caption" sx={{ color: '#64748b' }}>
											{dayjs(f.creadaEl).format('DD/MM/YYYY HH:mm')}
										</Typography>
									)}
								</TableCell>
								<TableCell>
									<HoraExtraEstadoChip estado={f.estado} />
								</TableCell>
								{acciones && (
									<TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
										{acciones(f)}
									</TableCell>
								)}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
