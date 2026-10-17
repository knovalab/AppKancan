import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
	Box,
	Button,
	FormControl,
	MenuItem,
	Paper,
	Select,
} from '@mui/material';
import type { Dayjs } from 'dayjs';
import type { StatusFilterOption } from '../../hooks/useMonitoreoOperacionTiendas';
import DateRangeFilter from '../reportes/DateRangeFilter';

export interface MonitoreoOperacionFiltrosProps {
	fechaInicio: Dayjs | null;
	fechaFin: Dayjs | null;
	onFechaChange: (inicio: Dayjs | null, fin: Dayjs | null) => void;
	statusFilter: StatusFilterOption;
	onStatusFilterChange: (val: StatusFilterOption) => void;
	onExportExcel?: () => void;
}

export function MonitoreoOperacionFiltros({
	fechaInicio,
	fechaFin,
	onFechaChange,
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

				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: 1.5,
					}}
				>
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
