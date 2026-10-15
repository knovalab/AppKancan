import {
	Box,
	Button,
	Chip,
	IconButton,
	Tooltip,
	Typography,
} from '@mui/material';
import { memo } from 'react';
import { ETIQUETA_ESTADO, type VistaTarjeta } from '../../../domain/registro';
import { NombreEmpleado } from '../utils/NombreEmpleado';
import { ACCIONES_CABECERA, type ModalCabecera } from './accionesCabecera';

interface EmployeeCardHeaderProps {
	nombre: string;
	cargo?: string;
	vm: VistaTarjeta;
	onAccion: (modal: ModalCabecera) => void;
	onAceptarNormas: () => void;
}

/** Solo pinta la vista: las reglas de disponibilidad vienen de domain/registro/disponibilidad. */
export const EmployeeCardHeader = memo(function EmployeeCardHeader({
	nombre,
	cargo,
	vm,
	onAccion,
	onAceptarNormas,
}: EmployeeCardHeaderProps) {
	const { pausas } = vm;
	return (
		<Box
			sx={{
				bgcolor: '#004680',
				color: 'white',
				p: 2,
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
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
				{pausas.visibles && (
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
						onClick={onAceptarNormas}
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
									onClick={() => onAccion(accion.modal)}
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
			</Box>
		</Box>
	);
});
