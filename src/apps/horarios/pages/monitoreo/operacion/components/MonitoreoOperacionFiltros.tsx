import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import {
	Box,
	Button,
	FormControl,
	InputAdornment,
	MenuItem,
	Paper,
	Select,
	TextField,
} from '@mui/material';
import type { Dayjs } from 'dayjs';
import DateRangeFilter from '../../../../components/reportes/DateRangeFilter';
import type { StatusFilterOption } from '../hooks/useMonitoreoOperacionTiendas';

export interface MonitoreoOperacionFiltrosProps {
	fechaInicio: Dayjs | null;
	fechaFin: Dayjs | null;
	onFechaChange: (inicio: Dayjs | null, fin: Dayjs | null) => void;
	searchTienda: string;
	onSearchTiendaChange: (val: string) => void;
	statusFilter: StatusFilterOption;
	onStatusFilterChange: (val: StatusFilterOption) => void;
	onExportExcel?: () => void;
}

export function MonitoreoOperacionFiltros({
	fechaInicio,
	fechaFin,
	onFechaChange,
	searchTienda,
	onSearchTiendaChange,
	statusFilter,
	onStatusFilterChange,
	onExportExcel,
}: MonitoreoOperacionFiltrosProps) {
	return (
		<Paper
			elevation={0}
			sx={{
				p: 2,
				borderRadius: 3,
				border: '1px solid #e2e8f0',
				display: 'flex',
				flexDirection: 'column',
				gap: 2,
				bgcolor: '#ffffff',
			}}
		>
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 2,
				}}
			>
				{/* Left: Quick Date shortcuts + DateRangeFilter */}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: 1.5,
					}}
				>
					<DateRangeFilter
						fechaInicio={fechaInicio}
						fechaFin={fechaFin}
						onChange={onFechaChange}
					/>
				</Box>

				{/* Right: Search + Status + Export button */}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: 1.5,
					}}
				>
					{/* Search store */}
					<TextField
						size="small"
						placeholder="Buscar por tienda o ID..."
						value={searchTienda}
						onChange={(e) => onSearchTiendaChange(e.target.value)}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon fontSize="small" sx={{ color: '#004680' }} />
									</InputAdornment>
								),
							},
						}}
						sx={{
							minWidth: 220,
							'& .MuiOutlinedInput-root': {
								borderRadius: 2,
								bgcolor: '#f8fafc',
								height: 38,
							},
						}}
					/>

					{/* Status Filter */}
					<FormControl size="small" sx={{ minWidth: 160 }}>
						<Select
							value={statusFilter}
							onChange={(e) =>
								onStatusFilterChange(e.target.value as StatusFilterOption)
							}
							sx={{
								height: 38,
								borderRadius: 2,
								bgcolor: '#f8fafc',
								'& .MuiSelect-select': { py: 0.75, fontSize: '0.875rem' },
							}}
						>
							<MenuItem value="todos">Todos los estados</MenuItem>
							<MenuItem value="en_operacion">En Operación</MenuItem>
							<MenuItem value="completado">Completado</MenuItem>
							<MenuItem value="sin_abrir">Sin abrir</MenuItem>
							<MenuItem value="dia_cerrado">Día Cerrado</MenuItem>
						</Select>
					</FormControl>

					{/* Export Button */}
					{onExportExcel && (
						<Button
							variant="contained"
							size="small"
							startIcon={<FileDownloadIcon />}
							onClick={onExportExcel}
							sx={{
								bgcolor: '#004680',
								color: '#ffffff',
								borderRadius: 2,
								height: 38,
								px: 2,
								textTransform: 'none',
								fontWeight: 700,
								'&:hover': { bgcolor: '#003366' },
							}}
						>
							Exportar
						</Button>
					)}
				</Box>
			</Box>
		</Paper>
	);
}
