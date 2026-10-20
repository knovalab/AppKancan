import { Chip } from '@mui/material';
import {
	type EstadoHoraExtra,
	ETIQUETA_ESTADO_HORA_EXTRA,
} from '../../domain/horasExtras';

const COLORES: Record<
	EstadoHoraExtra,
	{ bg: string; fg: string; borde: string }
> = {
	sugerida: { bg: '#eff6ff', fg: '#1e40af', borde: '#bfdbfe' },
	pendiente: { bg: '#fef3c7', fg: '#92400e', borde: '#fde68a' },
	aprobada: { bg: '#ecfdf5', fg: '#065f46', borde: '#a7f3d0' },
	descartada_comercial: { bg: '#fef2f2', fg: '#991b1b', borde: '#fecaca' },
	descartada_lider: { bg: '#f1f5f9', fg: '#475569', borde: '#e2e8f0' },
};

export function HoraExtraEstadoChip({ estado }: { estado: EstadoHoraExtra }) {
	const c = COLORES[estado] ?? COLORES.descartada_lider;
	return (
		<Chip
			label={ETIQUETA_ESTADO_HORA_EXTRA[estado] ?? estado}
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
