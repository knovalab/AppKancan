import { Box, Button, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

const segundosHasta = (expiraEn: number) =>
	Math.max(0, Math.ceil((expiraEn - Date.now()) / 1000));

interface ContadorPausaProps {
	expiraEn: number;
	/** Solo en la tarjeta demo: botón para no esperar los 5 minutos. */
	onTerminarDemo?: () => void;
}

/**
 * Cuenta atrás de la pausa activa. Es la única pieza que se re-renderiza cada
 * segundo (antes: la tarjeta entera, E4).
 */
export function ContadorPausa({
	expiraEn,
	onTerminarDemo,
}: ContadorPausaProps) {
	const [segundos, setSegundos] = useState(() => segundosHasta(expiraEn));

	useEffect(() => {
		setSegundos(segundosHasta(expiraEn));
		const t = setInterval(() => setSegundos(segundosHasta(expiraEn)), 1000);
		return () => clearInterval(t);
	}, [expiraEn]);

	return (
		<Box
			sx={{
				bgcolor: '#ecfeff',
				border: '1px solid #a5f3fc',
				borderRadius: 2,
				p: 1.5,
				mb: 2,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				animation: 'pulse 2s infinite ease-in-out',
				'@keyframes pulse': {
					'0%, 100%': { opacity: 1 },
					'50%': { opacity: 0.8 },
				},
			}}
		>
			<Typography
				sx={{
					fontSize: '0.75rem',
					fontWeight: 700,
					color: '#0e7490',
					textTransform: 'uppercase',
					letterSpacing: '0.5px',
				}}
			>
				Pausas Activas
			</Typography>
			<Typography
				sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#0891b2', mt: 0.5 }}
			>
				{Math.floor(segundos / 60)}:
				{(segundos % 60).toString().padStart(2, '0')}
			</Typography>
			{onTerminarDemo && (
				<Button
					size="small"
					onClick={onTerminarDemo}
					sx={{
						mt: 1,
						fontSize: '0.7rem',
						fontWeight: 700,
						bgcolor: '#0891b2',
						color: '#fff',
						'&:hover': { bgcolor: '#0e7490' },
					}}
				>
					Terminar Demo
				</Button>
			)}
		</Box>
	);
}
