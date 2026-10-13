/**
 * Tamaño común de los botones del header (Normas, Demo, Tutorial, Actualizar).
 * Cada botón solo agrega sus colores encima de esto.
 */
export const botonHeaderSx = {
	borderRadius: 2,
	textTransform: 'none',
	fontWeight: 700,
	whiteSpace: 'nowrap',
	px: { xs: 1, sm: 2 },
	py: 0.5,
	fontSize: { xs: '0.7rem', sm: '0.875rem' },
	height: { xs: 32, sm: 40 },
	minWidth: { xs: 0, sm: 112 },
	'& .MuiButton-startIcon svg': { fontSize: { xs: 14, sm: 18 } },
} as const;
