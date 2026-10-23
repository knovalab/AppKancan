import { Tooltip, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

/** Nombre en una línea; si se trunca, muestra el completo en un tooltip. */
export function NombreEmpleado({ nombre }: { nombre: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	const [truncado, setTruncado] = useState(false);

	// `nombre` es la dependencia a propósito: al cambiar el texto hay que volver a medir.
	// biome-ignore lint/correctness/useExhaustiveDependencies: se mide tras cada cambio de nombre
	useEffect(() => {
		const el = ref.current;
		if (el) setTruncado(el.scrollWidth > el.clientWidth);
	}, [nombre]);

	const texto = (
		<Typography
			ref={ref}
			noWrap
			sx={{
				fontWeight: 700,
				fontSize: '1rem',
				textTransform: 'capitalize',
				lineHeight: 1.2,
			}}
		>
			{nombre}
		</Typography>
	);

	return truncado ? (
		<Tooltip
			title={nombre}
			arrow
			placement="top"
			enterTouchDelay={0}
			slotProps={{
				tooltip: {
					sx: {
						bgcolor: '#EAF2FB',
						color: '#0f2c4a',
						fontSize: '0.8rem',
						fontWeight: 600,
						letterSpacing: '0.2px',
						textTransform: 'capitalize',
						px: 1.5,
						py: 0.875,
						borderRadius: 2,
						border: '1px solid #d6e6f7',
						boxShadow: '0 8px 24px rgba(0, 70, 128, 0.18)',
					},
				},
				arrow: {
					sx: {
						color: '#EAF2FB',
						'&::before': { border: '1px solid #d6e6f7' },
					},
				},
			}}
		>
			{texto}
		</Tooltip>
	) : (
		texto
	);
}
