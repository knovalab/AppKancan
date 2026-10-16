import StorefrontIcon from '@mui/icons-material/Storefront';
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
import type { RegistroTienda } from '../../interfaces/registroTienda';
import { ReporteTiendasTableRow } from './ReporteTiendasTableRow';

export interface ReporteTiendasTableProps {
	records: RegistroTienda[];
	loading?: boolean;
}

export function ReporteTiendasTable({
	records,
	loading = false,
}: ReporteTiendasTableProps) {
	return (
		<TableContainer
			sx={{
				overflow: 'auto',
				borderRadius: 2,
				border: '1px solid #e2e8f0',
			}}
		>
			<Table sx={{ minWidth: 950 }}>
				<TableHead sx={{ bgcolor: '#f0f7ff' }}>
					<TableRow>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#1e293b' }}>
							Tienda
						</TableCell>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#1e293b' }}>
							Fecha Jornada
						</TableCell>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#1e293b' }}>
							Apertura
						</TableCell>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#1e293b' }}>
							Cierre
						</TableCell>
						<TableCell
							align="center"
							sx={{ fontWeight: 700, py: 1.5, color: '#1e293b' }}
						>
							Tiempo Operativo
						</TableCell>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#1e293b' }}>
							Personal Apertura / Cierre
						</TableCell>
						<TableCell
							align="center"
							sx={{ fontWeight: 700, py: 1.5, color: '#1e293b' }}
						>
							Estado
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{loading ? (
						<TableRow>
							<TableCell colSpan={7} align="center" sx={{ py: 6 }}>
								<CircularProgress size={32} sx={{ color: '#004680' }} />
								<Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
									Cargando registros de tienda...
								</Typography>
							</TableCell>
						</TableRow>
					) : records.length === 0 ? (
						<TableRow>
							<TableCell colSpan={7} align="center" sx={{ py: 6 }}>
								<StorefrontIcon sx={{ fontSize: 44, color: '#94a3b8' }} />
								<Typography
									variant="body1"
									sx={{ mt: 1, fontWeight: 600, color: '#475569' }}
								>
									No se encontraron registros de tienda
								</Typography>
								<Typography variant="body2" sx={{ color: '#94a3b8' }}>
									Prueba seleccionando otro rango de fechas o tienda.
								</Typography>
							</TableCell>
						</TableRow>
					) : (
						records.map((reg, idx) => (
							<ReporteTiendasTableRow
								key={`${reg.store_id}_${reg.work_day_raw}`}
								reg={reg}
								idx={idx}
							/>
						))
					)}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
