import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
	Box,
	Button,
	Chip,
	IconButton,
	Tooltip,
	Typography,
} from '@mui/material';
import { memo, useMemo } from 'react';
import { ETIQUETA_ESTADO, type VistaTarjeta } from '../../../domain/registro';
import { NombreEmpleado } from '../utils/NombreEmpleado';
import { ACCIONES_CABECERA, type ModalCabecera } from './accionesCabecera';

interface EmployeeCardHeaderProps {
	nombre: string;
	cargo?: string;
	vm: VistaTarjeta;
	expandida?: boolean;
	onToggleExpandir?: () => void;
	onAccion: (modal: ModalCabecera) => void;
	onAceptarNormas: () => void;
}

/** Solo pinta la vista: las reglas de disponibilidad vienen de domain/registro/disponibilidad. */
export const EmployeeCardHeader = memo(function EmployeeCardHeader({
	nombre,
	cargo,
	vm,
	expandida = true,
	onToggleExpandir,
	onAccion,
	onAceptarNormas,
}: EmployeeCardHeaderProps) {
	const { pausas } = vm;

	const ultimaMarcacion = useMemo(() => {
		return vm.marcaciones
			.slice()
			.reverse()
			.find((m) => m.hecha && m.hora);
	}, [vm.marcaciones]);

	return (
		<Box
			onClick={onToggleExpandir}
			sx={{
				bgcolor: '#004680',
				color: 'white',
				p: 2,
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				cursor: onToggleExpandir ? 'pointer' : 'default',
				userSelect: 'none',
				transition: 'background-color 0.2s ease',
				'&:hover': onToggleExpandir ? { bgcolor: '#003a6b' } : undefined,
			}}
		>
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					minWidth: 0,
					flex: 1,
					pr: 1,
				}}
			>
				<NombreEmpleado nombre={nombre} />
				{cargo && (
					<Typography
						sx={{
							fontWeight: 500,
							fontSize: '0.7rem',
							opacity: 0.85,
							textTransform: 'uppercase',
							mt: 0.3,
							letterSpacing: '0.5px',
						}}
					>
						{cargo}
					</Typography>
				)}
				{!expandida && ultimaMarcacion && (
					<Typography
						sx={{
							fontSize: '0.68rem',
							fontWeight: 600,
							color: '#bae6fd',
							mt: 0.3,
							letterSpacing: '0.3px',
						}}
					>
						{ultimaMarcacion.marcacion.etiqueta}: {ultimaMarcacion.hora}
					</Typography>
				)}
				{expandida && pausas.visibles && (
					<Typography
						sx={{
							fontSize: '0.65rem',
							fontWeight: 600,
							color: '#ffffff',
							opacity: 0.75,
							textTransform: 'uppercase',
							mt: 0.5,
							letterSpacing: '0.5px',
						}}
					>
						{pausas.agotadas
							? null
							: pausas.hechas === 0
								? 'Pausa activa pendiente'
								: `Pausa activa ${pausas.hechas} de ${pausas.max} completada`}
					</Typography>
				)}
				{vm.mostrarAceptarNormas && (
					<Button
						size="small"
						variant="contained"
						onClick={(e) => {
							e.stopPropagation();
							onAceptarNormas();
						}}
						sx={{
							mt: 0.75,
							alignSelf: 'flex-start',
							fontSize: '0.65rem',
							fontWeight: 800,
							bgcolor: '#fbbf24',
							color: '#451a03',
							textTransform: 'uppercase',
							px: 1.25,
							py: 0.25,
							borderRadius: 1.5,
							boxShadow: 'none',
							letterSpacing: '0.4px',
							'&:hover': { bgcolor: '#f59e0b', boxShadow: 'none' },
						}}
					>
						⚠ Aceptar Normas
					</Button>
				)}
			</Box>
			<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
				{ACCIONES_CABECERA.map((accion) => {
					const disponible = accion.disponible(vm);
					return (
						<Tooltip key={accion.id} title={accion.tooltip(vm)}>
							<span className={accion.tourClass}>
								<IconButton
									size="medium"
									disabled={!disponible}
									onClick={(e) => {
										e.stopPropagation();
										onAccion(accion.modal);
									}}
									sx={{
										color: disponible ? accion.color : 'rgba(255,255,255,0.3)',
										'&:hover': {
											bgcolor: disponible
												? 'rgba(255, 255, 255, 0.12)'
												: 'transparent',
										},
										'&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
									}}
								>
									{accion.icono}
								</IconButton>
							</span>
						</Tooltip>
					);
				})}
				<Chip
					label={ETIQUETA_ESTADO[vm.estado]}
					size="small"
					sx={{
						bgcolor: 'rgba(255,255,255,0.2)',
						color: '#fff',
						fontWeight: 'bold',
						fontSize: '0.65rem',
						height: 24,
					}}
				/>
				{onToggleExpandir && (
					<Tooltip title={expandida ? 'Contraer tarjeta' : 'Expandir tarjeta'}>
						<IconButton
							size="small"
							onClick={(e) => {
								e.stopPropagation();
								onToggleExpandir();
							}}
							aria-label={expandida ? 'Contraer tarjeta' : 'Expandir tarjeta'}
							sx={{
								color: '#ffffff',
								p: 0.5,
								bgcolor: 'rgba(255, 255, 255, 0.15)',
								transition: 'transform 0.25s ease, background-color 0.2s ease',
								transform: expandida ? 'rotate(180deg)' : 'rotate(0deg)',
								'&:hover': {
									bgcolor: 'rgba(255, 255, 255, 0.3)',
								},
							}}
						>
							<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
						</IconButton>
					</Tooltip>
				)}
			</Box>
		</Box>
	);
});
