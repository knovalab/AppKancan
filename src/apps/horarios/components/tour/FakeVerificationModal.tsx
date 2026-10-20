import { Box, Button, Chip, IconButton, Typography } from '@mui/material';
import { Camera, Check, MapPin, X } from 'lucide-react';
import type React from 'react';
import { fakeFieldStyle } from './GenericTourModal';

export const verificationModalTargets = [
	'#tour-verificacion-gps',
	'#tour-verificacion-camara',
	'#tour-verificacion-acciones',
];

interface FakeVerificationModalProps {
	open: boolean;
	activeField: string | null;
}

export const FakeVerificationModal: React.FC<FakeVerificationModalProps> = ({
	open,
	activeField,
}) => {
	if (!open) return null;

	const isGpsActive = activeField === '#tour-verificacion-gps';
	const isCamaraActive = activeField === '#tour-verificacion-camara';
	const isAccionesActive = activeField === '#tour-verificacion-acciones';

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9000,
				backgroundColor: 'rgba(0, 0, 0, 0.55)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
				pointerEvents: 'auto',
			}}
		>
			<div
				style={{
					backgroundColor: '#ffffff',
					borderRadius: 16,
					maxWidth: 420,
					width: '92%',
					boxShadow:
						'0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{/* Cabecera del modal */}
				<Box
					sx={{
						px: 3,
						py: 2,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						borderBottom: '1px solid #f1f5f9',
					}}
				>
					<Box>
						<Typography
							variant="caption"
							sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}
						>
							Verificación de Asistencia
						</Typography>
						<Typography
							variant="h6"
							sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}
						>
							Comenzar Jornada
						</Typography>
						<Typography
							variant="body2"
							sx={{ color: '#475569', fontWeight: 500, fontSize: '0.82rem' }}
						>
							Andrea Soto
						</Typography>
					</Box>
					<IconButton size="small" sx={{ color: '#94a3b8' }} disabled>
						<X size={20} />
					</IconButton>
				</Box>

				{/* Contenido interactivo simulado */}
				<Box
					sx={{
						p: 2.5,
						display: 'flex',
						flexDirection: 'column',
						gap: 2,
					}}
				>
					{/* 1. Banner GPS Simulado */}
					<div
						id="tour-verificacion-gps"
						style={fakeFieldStyle(isGpsActive, {
							padding: '12px 14px',
							borderRadius: 10,
							backgroundColor: '#f0fdf4',
							border: isGpsActive ? '3px solid #008CFF' : '1px solid #bbf7d0',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: 12,
						})}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
							<MapPin size={20} color="#16a34a" />
							<Box>
								<Typography
									variant="caption"
									sx={{
										fontWeight: 700,
										display: 'block',
										color: '#15803d',
										fontSize: '0.78rem',
									}}
								>
									Ubicación GPS confirmada
								</Typography>
								<Typography
									variant="caption"
									sx={{ color: '#166534', fontSize: '0.7rem' }}
								>
									Precisión: ±5 m · Dentro del perímetro de tienda
								</Typography>
							</Box>
						</Box>
						<Chip
							label="En rango"
							size="small"
							sx={{
								bgcolor: '#dcfce7',
								color: '#166534',
								fontWeight: 700,
								fontSize: '0.68rem',
								height: 22,
							}}
						/>
					</div>

					{/* 2. Visor Facial de Cámara Simulado */}
					<div
						id="tour-verificacion-camara"
						style={fakeFieldStyle(isCamaraActive, {
							position: 'relative',
							width: '100%',
							maxWidth: 340,
							margin: '0 auto',
							aspectRatio: '4/5',
							borderRadius: 14,
							overflow: 'hidden',
							backgroundColor: '#090d16',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							border: isCamaraActive
								? '3px solid #008CFF'
								: '1px solid #1e293b',
							boxShadow: isCamaraActive
								? '0 0 0 3px rgba(0, 140, 255, 0.25), 0 4px 12px rgba(0, 140, 255, 0.15)'
								: '0 10px 25px -5px rgba(0,0,0,0.3)',
						})}
					>
						{/* Fondo simulando cámara selfie */}
						<Box
							sx={{
								position: 'absolute',
								inset: 0,
								background:
									'radial-gradient(circle at center, #1e293b 0%, #090d16 85%)',
								opacity: 0.9,
							}}
						/>

						{/* Badge de detección superior */}
						<Box
							sx={{
								position: 'absolute',
								top: 14,
								zIndex: 2,
							}}
						>
							<Chip
								icon={<Check size={14} color="#16a34a" />}
								label="Rostro centrado"
								size="small"
								sx={{
									bgcolor: 'rgba(240, 253, 244, 0.92)',
									color: '#15803d',
									fontWeight: 700,
									fontSize: '0.72rem',
									backdropFilter: 'blur(4px)',
									boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
								}}
							/>
						</Box>

						{/* Óvalo de guía biométrica */}
						<Box
							sx={{
								position: 'relative',
								width: '62%',
								aspectRatio: '3/4',
								borderRadius: '50%',
								border: '2.5px solid #38bdf8',
								boxShadow:
									'0 0 20px rgba(56, 189, 248, 0.35), inset 0 0 15px rgba(56, 189, 248, 0.2)',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 1,
								zIndex: 2,
							}}
						>
							{/* Silueta / icono de rostro simulado */}
							<Box
								sx={{
									width: 52,
									height: 52,
									borderRadius: '50%',
									bgcolor: 'rgba(56, 189, 248, 0.15)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: '#38bdf8',
								}}
							>
								<Camera size={26} />
							</Box>
						</Box>

						{/* Indicador de auto-captura inferior */}
						<Box
							sx={{
								position: 'absolute',
								bottom: 14,
								zIndex: 2,
								textAlign: 'center',
							}}
						>
							<Typography
								variant="caption"
								sx={{
									color: '#bae6fd',
									fontWeight: 600,
									fontSize: '0.7rem',
									textShadow: '0 1px 3px rgba(0,0,0,0.8)',
									display: 'block',
								}}
							>
								⚡ Auto-captura inteligente activa
							</Typography>
						</Box>
					</div>

					{/* 3. Botones de Acción Simulados */}
					<div
						id="tour-verificacion-acciones"
						style={fakeFieldStyle(isAccionesActive, {
							border: isAccionesActive
								? '3px solid #008CFF'
								: '1px solid transparent',
							borderRadius: 10,
							padding: isAccionesActive ? 4 : 0,
						})}
					>
						<Button
							fullWidth
							variant="contained"
							startIcon={<Check size={18} />}
							disabled
							sx={{
								bgcolor: '#004680 !important',
								color: '#ffffff !important',
								py: 1.1,
								borderRadius: 2,
								fontWeight: 700,
								fontSize: '0.85rem',
								textTransform: 'none',
								boxShadow: 'none',
								opacity: 1,
							}}
						>
							Confirmar Asistencia
						</Button>
					</div>
				</Box>
			</div>
		</div>
	);
};

