import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import {
	Box,
	Button,
	Chip,
	Divider,
	Paper,
	Tooltip,
	Typography,
} from '@mui/material';
import type { FiltroColapso } from '../../hooks/registro/useTarjetasColapsables';

interface ConteoEstados {
	activas: number;
	pendientes: number;
	finalizadas: number;
}

interface BarraAccionesTarjetasProps {
	totalEmpleados: number;
	totalExpandidas: number;
	totalColapsadas: number;
	todasExpandidas: boolean;
	todasColapsadas: boolean;
	conteos: ConteoEstados;
	onExpandirTodas: () => void;
	onContraerTodas: () => void;
	onExpandirPorEstado: (filtro: FiltroColapso) => void;
	/** Vista limpia (perfil tienda): solo chips; sin botones en móvil ni textos auxiliares. */
	compacta?: boolean;
}

export function BarraAccionesTarjetas({
	totalEmpleados,
	totalExpandidas,
	conteos,
	todasExpandidas,
	todasColapsadas,
	onExpandirTodas,
	onContraerTodas,
	onExpandirPorEstado,
	compacta = false,
}: BarraAccionesTarjetasProps) {
	if (totalEmpleados === 0) return null;

	const ocultarEnMovil = compacta
		? { xs: 'none', sm: 'inline-flex' }
		: undefined;

	return (
		<Paper
			elevation={0}
			sx={{
				p: { xs: 1, sm: 1.25 },
				mb: 2,
				borderRadius: 2.5,
				border: '1px solid #e2e8f0',
				bgcolor: '#ffffff',
				display: 'flex',
				flexDirection: { xs: 'column', md: 'row' },
				alignItems: { xs: 'stretch', md: 'center' },
				justifyContent: 'space-between',
				gap: 1.5,
			}}
		>
			{/* Botones de acción masiva + filtros por estado */}
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					gap: 1,
				}}
			>
				{/* Botón Contraer todas */}
				<Button
					size="small"
					variant="outlined"
					onClick={onContraerTodas}
					disabled={todasColapsadas}
					startIcon={<UnfoldLessIcon fontSize="small" />}
					sx={{
						display: ocultarEnMovil,
						textTransform: 'none',
						fontWeight: 600,
						fontSize: '0.78rem',
						borderRadius: 1.75,
						borderColor: '#cbd5e1',
						color: '#475569',
						py: 0.4,
						px: 1.2,
						height: 32,
						'&:hover': {
							bgcolor: '#f1f5f9',
							borderColor: '#94a3b8',
						},
					}}
				>
					Contraer todas
				</Button>

				{/* Botón Expandir todas */}
				<Button
					size="small"
					variant="outlined"
					onClick={onExpandirTodas}
					disabled={todasExpandidas}
					startIcon={<UnfoldMoreIcon fontSize="small" />}
					sx={{
						display: ocultarEnMovil,
						textTransform: 'none',
						fontWeight: 600,
						fontSize: '0.78rem',
						borderRadius: 1.75,
						borderColor: '#cbd5e1',
						color: '#004680',
						py: 0.4,
						px: 1.2,
						height: 32,
						'&:hover': {
							bgcolor: '#f0f7ff',
							borderColor: '#004680',
						},
					}}
				>
					Expandir todas
				</Button>

				<Divider
					orientation="vertical"
					flexItem
					sx={{
						display: { xs: 'none', sm: 'block' },
						mx: 0.5,
						height: 20,
						my: 'auto',
					}}
				/>

				{/* Filtros rápidos inteligentes por estado */}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 0.75,
						flexWrap: 'wrap',
					}}
				>
					<Typography
						variant="caption"
						sx={{
							fontWeight: 600,
							color: '#64748b',
							display: compacta ? 'none' : { xs: 'none', sm: 'inline-block' },
							mr: 0.25,
						}}
					>
						Expandir:
					</Typography>

					{/* En turno */}
					<Tooltip title="Expandir tarjetas de empleados actualmente en turno (jornada iniciada / almuerzo)">
						<span>
							<Chip
								clickable={conteos.activas > 0}
								disabled={conteos.activas === 0}
								icon={
									<PlayCircleOutlineIcon sx={{ fontSize: '1rem !important' }} />
								}
								label={`En turno: ${conteos.activas}`}
								size="small"
								onClick={() => onExpandirPorEstado('activas')}
								sx={{
									fontWeight: 600,
									fontSize: '0.75rem',
									height: 28,
									borderRadius: 1.5,
									bgcolor: '#f0fdf4',
									color: '#166534',
									border: '1px solid #bbf7d0',
									'& .MuiChip-icon': { color: '#16a34a' },
									'&:hover': {
										bgcolor: '#dcfce7',
									},
								}}
							/>
						</span>
					</Tooltip>

					{/* Pendientes */}
					<Tooltip title="Expandir tarjetas de empleados pendientes de iniciar jornada">
						<span>
							<Chip
								clickable={conteos.pendientes > 0}
								disabled={conteos.pendientes === 0}
								icon={<ScheduleIcon sx={{ fontSize: '1rem !important' }} />}
								label={`Pendientes: ${conteos.pendientes}`}
								size="small"
								onClick={() => onExpandirPorEstado('pendientes')}
								sx={{
									fontWeight: 600,
									fontSize: '0.75rem',
									height: 28,
									borderRadius: 1.5,
									bgcolor: '#fffbeb',
									color: '#92400e',
									border: '1px solid #fde68a',
									'& .MuiChip-icon': { color: '#d97706' },
									'&:hover': {
										bgcolor: '#fef3c7',
									},
								}}
							/>
						</span>
					</Tooltip>

					{/* Finalizadas */}
					<Tooltip title="Expandir tarjetas de empleados que ya finalizaron su jornada">
						<span>
							<Chip
								clickable={conteos.finalizadas > 0}
								disabled={conteos.finalizadas === 0}
								icon={
									<CheckCircleOutlineIcon
										sx={{ fontSize: '1rem !important' }}
									/>
								}
								label={`Finalizados: ${conteos.finalizadas}`}
								size="small"
								onClick={() => onExpandirPorEstado('finalizadas')}
								sx={{
									fontWeight: 600,
									fontSize: '0.75rem',
									height: 28,
									borderRadius: 1.5,
									bgcolor: '#f8fafc',
									color: '#475569',
									border: '1px solid #e2e8f0',
									'& .MuiChip-icon': { color: '#64748b' },
									'&:hover': {
										bgcolor: '#f1f5f9',
									},
								}}
							/>
						</span>
					</Tooltip>
				</Box>
			</Box>

			{/* Resumen de estado de tarjetas */}
			<Box
				sx={{
					display: compacta ? 'none' : 'flex',
					alignItems: 'center',
					justifyContent: { xs: 'flex-start', md: 'flex-end' },
					gap: 1,
				}}
			>
				<Typography
					variant="caption"
					sx={{
						fontWeight: 600,
						color: '#64748b',
						fontSize: '0.75rem',
					}}
				>
					{totalExpandidas === totalEmpleados
						? `Todas expandidas (${totalEmpleados})`
						: totalExpandidas === 0
							? `Todas contraídas (${totalEmpleados})`
							: `${totalExpandidas} de ${totalEmpleados} expandidas`}
				</Typography>
			</Box>
		</Paper>
	);
}
