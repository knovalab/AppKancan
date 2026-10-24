import TuneIcon from '@mui/icons-material/Tune';
import {
	Box,
	Button,
	Collapse,
	Skeleton,
	Typography,
	useMediaQuery,
	useTheme,
} from '@mui/material';
import { type ReactNode, useState } from 'react';
import { formatoMinutos } from '../../../domain/horasExtras';

/*
 * Bloques de los reportes de gerencia, pensados primero para teléfono (§3.3 del plan):
 * una columna, números grandes y sin scroll horizontal.
 */

export const AZUL = '#004680';
export const GRIS = '#64748b';
export const BORDE = '1px solid #e2e8f0';
/** Zona táctil mínima (selectores, pestañas, botones). */
export const TACTIL = 44;

/** Teléfono (`xs`) y tablet vertical (`sm`): tarjetas en vez de tablas. */
export function useCompacto() {
	return useMediaQuery(useTheme().breakpoints.down('md'));
}

/** Horas redondeadas para KPIs y tarjetas (`82 h`); menos de una hora, exacto. */
export const horasCortas = (minutos: number) =>
	minutos < 60
		? formatoMinutos(minutos)
		: `${Math.round(minutos / 60).toLocaleString('es-CO')} h`;

export const pct = (n: number) => `${Math.round(n * 100)} %`;

/** Variación con signo y color (rojo = más horas). `null`: antes no hubo horas. */
export function Variacion({ valor }: { valor: number | null }) {
	if (valor == null)
		return (
			<Typography component="span" variant="body2" sx={{ color: GRIS }}>
				--
			</Typography>
		);
	const n = Math.round(valor * 100);
	const color = n > 0 ? '#dc2626' : n < 0 ? '#16a34a' : GRIS;
	return (
		<Typography
			component="span"
			variant="body2"
			sx={{ color, fontWeight: 700, whiteSpace: 'nowrap' }}
		>
			{n > 0 ? '+' : ''}
			{n} %
		</Typography>
	);
}

export function Kpi({
	titulo,
	valor,
	nota,
	principal = false,
	extra,
}: {
	titulo: string;
	/** Ya formateado (p. ej. `horasCortas(minutos)`). */
	valor: string;
	nota?: string;
	principal?: boolean;
	extra?: ReactNode;
}) {
	return (
		<Box
			sx={{
				p: 2,
				borderRadius: 2,
				border: BORDE,
				bgcolor: principal ? '#f0f7ff' : '#f8fafc',
				// El principal ocupa la fila completa en teléfono.
				gridColumn: principal ? { xs: '1 / -1', md: 'auto' } : 'auto',
				minWidth: 0,
			}}
		>
			<Typography variant="body2" sx={{ color: GRIS }}>
				{titulo}
			</Typography>
			<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
				<Typography
					sx={{
						fontWeight: 700,
						color: AZUL,
						fontSize: principal ? { xs: 32, sm: 28 } : 22,
						lineHeight: 1.2,
					}}
				>
					{valor}
				</Typography>
				{extra}
			</Box>
			{nota && (
				<Typography variant="caption" sx={{ color: '#94a3b8' }}>
					{nota}
				</Typography>
			)}
		</Box>
	);
}

/** Rejilla de KPIs: 2 por fila en teléfono, 3 en tablet vertical, 4 en adelante. */
export function Kpis({ children }: { children: ReactNode }) {
	return (
		<Box
			sx={{
				display: 'grid',
				gridTemplateColumns: {
					xs: 'repeat(2, minmax(0, 1fr))',
					sm: 'repeat(3, minmax(0, 1fr))',
					md: 'repeat(4, minmax(0, 1fr))',
				},
				gap: 1.5,
				mb: 3,
			}}
		>
			{children}
		</Box>
	);
}

/**
 * Filtros: en línea desde `sm`; en teléfono, una línea con lo que se está viendo
 * que despliega los selectores a todo el ancho.
 */
export function Filtros({
	resumen,
	children,
}: {
	resumen: string;
	children: ReactNode;
}) {
	const telefono = useMediaQuery(useTheme().breakpoints.down('sm'));
	const [abierto, setAbierto] = useState(false);
	if (!telefono)
		return (
			<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
				{children}
			</Box>
		);
	return (
		<Box sx={{ mb: 2 }}>
			<Button
				fullWidth
				variant="outlined"
				endIcon={<TuneIcon />}
				onClick={() => setAbierto((a) => !a)}
				aria-expanded={abierto}
				sx={{
					minHeight: TACTIL,
					justifyContent: 'space-between',
					textTransform: 'none',
				}}
			>
				{resumen}
			</Button>
			<Collapse in={abierto}>
				<Box sx={{ display: 'grid', gap: 1.5, pt: 1.5 }}>{children}</Box>
			</Collapse>
		</Box>
	);
}

/** Un bloque con la pregunta que responde como título. */
export function Bloque({
	titulo,
	children,
}: {
	titulo: string;
	children: ReactNode;
}) {
	return (
		<Box component="section" sx={{ mb: 3 }} aria-label={titulo}>
			<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
				{titulo}
			</Typography>
			{children}
		</Box>
	);
}

/** Tarjeta de lista (periodo, tienda): máximo 3 datos + una línea secundaria. */
export function Tarjeta({
	children,
	onClick,
	seleccionada = false,
	etiqueta,
}: {
	children: ReactNode;
	onClick?: () => void;
	seleccionada?: boolean;
	etiqueta?: string;
}) {
	return (
		<Box
			component={onClick ? 'button' : 'div'}
			type={onClick ? 'button' : undefined}
			onClick={onClick}
			aria-label={etiqueta}
			aria-pressed={onClick ? seleccionada : undefined}
			sx={{
				display: 'block',
				width: '100%',
				textAlign: 'left',
				font: 'inherit',
				color: 'inherit',
				p: 1.5,
				minHeight: TACTIL,
				borderRadius: 2,
				border: seleccionada ? `2px solid ${AZUL}` : BORDE,
				bgcolor: '#fff',
				cursor: onClick ? 'pointer' : 'default',
			}}
		>
			{children}
		</Box>
	);
}

/** Lista de tarjetas: 1 columna en teléfono, 2 en tablet vertical. */
export function Tarjetas({ children }: { children: ReactNode }) {
	return (
		<Box
			sx={{
				display: 'grid',
				gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
				gap: 1,
			}}
		>
			{children}
		</Box>
	);
}

/** Esqueletos con la forma del reporte, para que la página no salte al cargar. */
export function Cargando() {
	return (
		<Box role="status" aria-live="polite" aria-label="Cargando reporte">
			<Kpis>
				<Skeleton
					variant="rounded"
					height={92}
					sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
				/>
				<Skeleton variant="rounded" height={92} />
				<Skeleton variant="rounded" height={92} />
			</Kpis>
			<Skeleton variant="rounded" height={200} />
		</Box>
	);
}
