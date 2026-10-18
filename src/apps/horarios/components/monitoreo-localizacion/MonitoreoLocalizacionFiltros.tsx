import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
	Box,
	Chip,
	IconButton,
	InputAdornment,
	Paper,
	TextField,
} from '@mui/material';
import type { Dayjs } from 'dayjs';
import { MapPin } from 'lucide-react';
import DateRangeFilter from '../reportes/DateRangeFilter';

export interface MonitoreoLocalizacionFiltrosProps {
	fechaInicio: Dayjs | null;
	fechaFin: Dayjs | null;
	onFechaChange: (inicio: Dayjs | null, fin: Dayjs | null) => void;
	searchEmpleado: string;
	onSearchEmpleadoChange: (val: string) => void;
	totalRecords: number;
}

export function MonitoreoLocalizacionFiltros({
	fechaInicio,
	fechaFin,
	onFechaChange,
	searchEmpleado,
	onSearchEmpleadoChange,
	totalRecords,
}: MonitoreoLocalizacionFiltrosProps) {
	return (
		<Paper
			elevation={0}
			sx={{
				p: { xs: 1.5, sm: 2 },
				borderRadius: 3,
				border: '1px solid #e2e8f0',
				display: 'flex',
				flexDirection: 'column',
				gap: 1.5,
				bgcolor: '#ffffff',
			}}
		>
			<Box
				sx={{
					display: 'flex',
					flexDirection: { xs: 'column', md: 'row' },
					alignItems: { xs: 'stretch', md: 'center' },
					justifyContent: 'space-between',
					gap: { xs: 1.5, sm: 2 },
				}}
			>
				<Box
					sx={{
						width: { xs: '100%', md: 280 },
						flexShrink: 0,
					}}
				>
					<DateRangeFilter
						fechaInicio={fechaInicio}
						fechaFin={fechaFin}
						onChange={onFechaChange}
					/>
				</Box>

				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: { xs: 1, sm: 1.5 },
						width: { xs: '100%', md: 'auto' },
						flex: { md: 1 },
						justifyContent: { md: 'flex-end' },
					}}
				>
					<TextField
						size="small"
						fullWidth
						placeholder="Buscar por empleado o cédula..."
						value={searchEmpleado}
						onChange={(e) => onSearchEmpleadoChange(e.target.value)}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon fontSize="small" sx={{ color: '#004680' }} />
									</InputAdornment>
								),
								endAdornment: searchEmpleado ? (
									<InputAdornment position="end">
										<IconButton
											size="small"
											onClick={() => onSearchEmpleadoChange('')}
											edge="end"
											sx={{ color: '#94a3b8', p: 0.5 }}
											title="Limpiar búsqueda"
										>
											<CloseIcon sx={{ fontSize: 16 }} />
										</IconButton>
									</InputAdornment>
								) : null,
							},
						}}
						sx={{
							flex: 1,
							maxWidth: { md: 360 },
							'& .MuiOutlinedInput-root': {
								borderRadius: 2,
								bgcolor: '#f8fafc',
								height: 40,
								fontSize: '0.875rem',
							},
						}}
					/>

					<Chip
						icon={<MapPin size={15} color="#0284c7" />}
						label={
							<Box component="span" sx={{ fontWeight: 700 }}>
								<Box
									component="span"
									sx={{ display: { xs: 'none', sm: 'inline' } }}
								>
									{totalRecords}{' '}
									{totalRecords === 1
										? 'marcación con GPS'
										: 'marcaciones con GPS'}
								</Box>
								<Box
									component="span"
									sx={{ display: { xs: 'inline', sm: 'none' } }}
								>
									{totalRecords} {totalRecords === 1 ? 'GPS' : 'GPS'}
								</Box>
							</Box>
						}
						size="small"
						sx={{
							bgcolor: '#e0f2fe',
							color: '#0284c7',
							height: 40,
							borderRadius: 2,
							px: { xs: 0.75, sm: 1.25 },
							flexShrink: 0,
							border: '1px solid #bae6fd',
							'& .MuiChip-icon': {
								ml: { xs: 0.25, sm: 0.5 },
								mr: -0.25,
							},
						}}
					/>
				</Box>
			</Box>
		</Paper>
	);
}
