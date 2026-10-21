import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import {
	CircularProgress,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { duracionDias, formatoMinutos } from '../../domain/horasExtras';
import type { PeriodoConTotales } from '../../hooks/usePeriodos';
import { PeriodoEstadoChip } from './PeriodoEstadoChip';

const COLUMNAS = [
	'Nombre',
	'Inicio',
	'Fin',
	'Días',
	'Estado',
	'Vinculadas',
	'Total',
	'Liquidado el',
];

const celdaHead = { fontWeight: 700, py: 1.5, color: '#1e293b' };
const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');

export interface PeriodosTablaProps {
	filas: PeriodoConTotales[];
	loading?: boolean;
	onAbrir: (periodo: PeriodoConTotales) => void;
}

export function PeriodosTabla({
	filas,
	loading = false,
	onAbrir,
}: PeriodosTablaProps) {
	return (
		<TableContainer
			sx={{ overflow: 'auto', borderRadius: 2, border: '1px solid #e2e8f0' }}
		>
			<Table sx={{ minWidth: 760 }} aria-label="Periodos">
				<TableHead sx={{ bgcolor: '#f0f7ff' }}>
					<TableRow>
						{COLUMNAS.map((c) => (
							<TableCell key={c} sx={celdaHead}>
								{c}
							</TableCell>
						))}
					</TableRow>
				</TableHead>
				<TableBody>
					{loading ? (
						<TableRow>
							<TableCell
								colSpan={COLUMNAS.length}
								align="center"
								sx={{ py: 6 }}
							>
								<CircularProgress size={32} sx={{ color: '#004680' }} />
								<Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
									Cargando periodos...
								</Typography>
							</TableCell>
						</TableRow>
					) : filas.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={COLUMNAS.length}
								align="center"
								sx={{ py: 6 }}
							>
								<EventRepeatIcon sx={{ fontSize: 44, color: '#94a3b8' }} />
								<Typography
									variant="body1"
									sx={{ mt: 1, fontWeight: 600, color: '#475569' }}
								>
									Aún no hay periodos. Crea el primero.
								</Typography>
							</TableCell>
						</TableRow>
					) : (
						filas.map((p) => (
							<TableRow
								key={p.id}
								hover
								onClick={() => onAbrir(p)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onAbrir(p);
									}
								}}
								tabIndex={0}
								aria-label={`Ver periodo ${p.name ? `${p.name}, ` : ''}del ${fecha(p.start_date)} al ${fecha(p.end_date)}`}
								sx={{ cursor: 'pointer' }}
							>
								<TableCell sx={{ fontWeight: 600 }}>
									{p.name || (
										<Typography
											variant="body2"
											component="span"
											sx={{ color: '#94a3b8' }}
										>
											Sin nombre
										</Typography>
									)}
								</TableCell>
								<TableCell sx={{ whiteSpace: 'nowrap' }}>
									{fecha(p.start_date)}
								</TableCell>
								<TableCell sx={{ whiteSpace: 'nowrap' }}>
									{fecha(p.end_date)}
								</TableCell>
								<TableCell>{duracionDias(p.start_date, p.end_date)}</TableCell>
								<TableCell>
									<PeriodoEstadoChip estado={p.status} />
								</TableCell>
								<TableCell>{p.horas}</TableCell>
								<TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
									{formatoMinutos(p.minutos)}
								</TableCell>
								<TableCell sx={{ whiteSpace: 'nowrap' }}>
									{p.liquidacion_at
										? dayjs(p.liquidacion_at).format('DD/MM/YYYY HH:mm')
										: '--'}
								</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
