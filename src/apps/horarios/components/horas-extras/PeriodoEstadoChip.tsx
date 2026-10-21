import { Chip } from '@mui/material';
import {
	type EstadoPeriodo,
	ETIQUETA_ESTADO_PERIODO,
} from '../../domain/horasExtras';

const COLORES: Record<
	EstadoPeriodo,
	{ bg: string; fg: string; borde: string }
> = {
	preliquidado: { bg: '#fef3c7', fg: '#92400e', borde: '#fde68a' },
	liquidado: { bg: '#ecfdf5', fg: '#065f46', borde: '#a7f3d0' },
};

export function PeriodoEstadoChip({ estado }: { estado: EstadoPeriodo }) {
	// Filas sin estado (p. ej. creadas antes de la v2) se pintan como preliquidado.
	const c = COLORES[estado] ?? COLORES.preliquidado;
	return (
		<Chip
			label={ETIQUETA_ESTADO_PERIODO[estado] ?? 'Sin estado'}
			size="small"
			sx={{
				bgcolor: c.bg,
				color: c.fg,
				fontWeight: 600,
				border: `1px solid ${c.borde}`,
			}}
		/>
	);
}
