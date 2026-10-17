import StorefrontIcon from '@mui/icons-material/Storefront';
import {
	CircularProgress,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from '@mui/material';
import type { RegistroTienda } from '../../../../interfaces/registroTienda';
import { MonitoreoOperacionTableRow } from './MonitoreoOperacionTableRow';

export interface MonitoreoOperacionTableProps {
	records: RegistroTienda[];
	loading?: boolean;
}

export function MonitoreoOperacionTable({
	records,
	loading = false,
}: MonitoreoOperacionTableProps) {
	return (
		<TableContainer
			component={Paper}
			elevation={0}
			sx={{
				borderRadius: 3,
				border: '1px solid #e2e8f0',
				overflowX: 'auto',
			}}
		>
			<Table sx={{ minWidth: 800 }}>
				<TableHead sx={{ bgcolor: '#f8fafc' }}>
					<TableRow>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#334155' }}>
							TIENDA
						</TableCell>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#334155' }}>
							FECHA JORNADA
						</TableCell>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#334155' }}>
							HORA APERTURA
						</TableCell>
						<TableCell sx={{ fontWeight: 700, py: 1.5, color: '#334155' }}>
							HORA CIERRE
						</TableCell>
						<TableCell
							align="center"
							sx={{ fontWeight: 700, py: 1.5, color: '#334155' }}
						>
							TIEMPO OPERATIVO
						</TableCell>
						<TableCell
							align="center"
							sx={{ fontWeight: 700, py: 1.5, color: '#334155' }}
						>
							ESTADO
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{loading ? (
						<TableRow>
							<TableCell colSpan={6} align="center" sx={{ py: 6 }}>
								<CircularProgress size={32} sx={{ color: '#004680' }} />
								<Typography
									variant="body2"
									sx={{ mt: 1.5, color: '#64748b', fontWeight: 600 }}
								>
									Cargando estado operativo de tiendas...
								</Typography>
							</TableCell>
						</TableRow>
					) : records.length === 0 ? (
						<TableRow>
							<TableCell colSpan={6} align="center" sx={{ py: 6 }}>
								<StorefrontIcon sx={{ fontSize: 44, color: '#94a3b8' }} />
								<Typography
									variant="body1"
									sx={{ mt: 1, fontWeight: 700, color: '#475569' }}
								>
									No se encontraron registros de operación
								</Typography>
								<Typography variant="body2" sx={{ color: '#94a3b8' }}>
									Prueba seleccionando otro rango de fechas o filtro de estado.
								</Typography>
							</TableCell>
						</TableRow>
					) : (
						records.map((reg, idx) => (
							<MonitoreoOperacionTableRow
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
