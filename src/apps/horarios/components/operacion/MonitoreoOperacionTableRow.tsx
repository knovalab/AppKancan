import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import StorefrontIcon from '@mui/icons-material/Storefront';
import {
	Box,
	Chip,
	TableCell,
	TableRow,
	Tooltip,
	Typography,
} from '@mui/material';
import type { RegistroTienda } from '../../interfaces/registroTienda';
import { ReporteTiendasStatusChip } from '../com_time_record_store/ReporteTiendasStatusChip';

export interface MonitoreoOperacionTableRowProps {
	reg: RegistroTienda;
	idx: number;
}

export function MonitoreoOperacionTableRow({
	reg,
	idx,
}: MonitoreoOperacionTableRowProps) {
	return (
		<TableRow
			hover
			sx={{
				bgcolor: idx % 2 === 0 ? '#ffffff' : '#fafcff',
				transition: 'background-color 0.2s',
				'&:hover': { bgcolor: '#eef4ff' },
			}}
		>
			{/* 1. Tienda */}
			<TableCell sx={{ py: 1.5 }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
					<Box
						sx={{
							p: 0.75,
							borderRadius: 1.5,
							bgcolor: '#f0f7ff',
							color: '#004680',
							display: 'flex',
						}}
					>
						<StorefrontIcon sx={{ fontSize: 18 }} />
					</Box>
					<Box>
						<Typography
							variant="body2"
							sx={{ fontWeight: 700, color: '#0f172a' }}
						>
							{reg.store_name}
						</Typography>
						<Typography variant="caption" sx={{ color: '#64748b' }}>
							ID: {reg.store_id}
						</Typography>
					</Box>
				</Box>
			</TableCell>

			{/* 2. Fecha */}
			<TableCell sx={{ py: 1.5 }}>
				<Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
					{reg.work_day}
				</Typography>
				<Typography variant="caption" sx={{ color: '#94a3b8' }}>
					{reg.work_day_raw}
				</Typography>
			</TableCell>

			{/* 3. Hora Apertura */}
			<TableCell sx={{ py: 1.5 }}>
				{reg.open_time ? (
					<Tooltip title={`Apertura registrada: ${reg.open_time}`} arrow>
						<Box
							sx={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 0.75,
								px: 1,
								py: 0.5,
								borderRadius: 1.5,
								bgcolor: '#f0fdf4',
								border: '1px solid #bbf7d0',
							}}
						>
							<LoginIcon sx={{ fontSize: 14, color: '#16a34a' }} />
							<Typography
								variant="body2"
								sx={{
									fontWeight: 700,
									color: '#15803d',
									fontFamily: 'monospace',
								}}
							>
								{reg.open_time_short || reg.open_time}
							</Typography>
						</Box>
					</Tooltip>
				) : (
					<Chip
						label="Sin abrir"
						size="small"
						sx={{
							bgcolor: '#f1f5f9',
							color: '#64748b',
							fontWeight: 600,
							height: 24,
						}}
					/>
				)}
			</TableCell>

			{/* 4. Hora Cierre */}
			<TableCell sx={{ py: 1.5 }}>
				{reg.close_time ? (
					<Tooltip title={`Cierre registrado: ${reg.close_time}`} arrow>
						<Box
							sx={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 0.75,
								px: 1,
								py: 0.5,
								borderRadius: 1.5,
								bgcolor: '#fef2f2',
								border: '1px solid #fecaca',
							}}
						>
							<LogoutIcon sx={{ fontSize: 14, color: '#dc2626' }} />
							<Typography
								variant="body2"
								sx={{
									fontWeight: 700,
									color: '#b91c1c',
									fontFamily: 'monospace',
								}}
							>
								{reg.close_time_short || reg.close_time}
							</Typography>
						</Box>
					</Tooltip>
				) : reg.status === 'sin_abrir' ? (
					<Typography variant="body2" sx={{ color: '#94a3b8' }}>
						--
					</Typography>
				) : (
					<Chip
						label="En operación"
						size="small"
						sx={{
							bgcolor: '#fffbeb',
							color: '#b45309',
							fontWeight: 600,
							height: 24,
						}}
					/>
				)}
			</TableCell>

			{/* 5. Tiempo Operativo */}
			<TableCell align="center" sx={{ py: 1.5 }}>
				<Typography variant="body2" sx={{ fontWeight: 800, color: '#004680' }}>
					{reg.operative_time_label}
				</Typography>
			</TableCell>

			{/* 6. Estado */}
			<TableCell align="center" sx={{ py: 1.5 }}>
				<ReporteTiendasStatusChip status={reg.status} />
			</TableCell>
		</TableRow>
	);
}
