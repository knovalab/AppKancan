import { Box, Chip, Paper, Typography } from '@mui/material';
import { MapPin, Users } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import type { LocalizacionRecordItem } from '../../hooks/useMonitoreoLocalizacion';
import { MonitoreoLocalizacionCard } from './MonitoreoLocalizacionCard';

const MonitoreoMultiMarkerMap = lazy(() =>
	import('./MonitoreoMultiMarkerMap').then((m) => ({
		default: m.MonitoreoMultiMarkerMap,
	})),
);

export interface MonitoreoLocalizacionSeccionProps {
	logType: string;
	items: LocalizacionRecordItem[];
}

function getLogTypeStyle(logType: string) {
	const lower = logType.toLowerCase();
	if (
		lower.includes('comenzar') ||
		lower.includes('inicio jornada') ||
		lower.includes('entrada')
	) {
		return {
			color: '#15803d',
			bgcolor: '#f0fdf4',
			borderColor: '#bbf7d0',
		};
	}
	if (lower.includes('iniciar almuerzo')) {
		return {
			color: '#b45309',
			bgcolor: '#fffbeb',
			borderColor: '#fde68a',
		};
	}
	if (lower.includes('finalizar almuerzo') || lower.includes('fin almuerzo')) {
		return {
			color: '#c2410c',
			bgcolor: '#fff7ed',
			borderColor: '#fed7aa',
		};
	}
	if (
		lower.includes('terminar') ||
		lower.includes('fin jornada') ||
		lower.includes('salida')
	) {
		return {
			color: '#b91c1c',
			bgcolor: '#fef2f2',
			borderColor: '#fecaca',
		};
	}
	return {
		color: '#004680',
		bgcolor: '#f0f7ff',
		borderColor: '#bae6fd',
	};
}

export function MonitoreoLocalizacionSeccion({
	logType,
	items,
}: MonitoreoLocalizacionSeccionProps) {
	const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);

	// Strictly do not render section or title if there are no records
	if (!items || items.length === 0) {
		return null;
	}

	const style = getLogTypeStyle(logType);

	return (
		<Paper
			elevation={0}
			sx={{
				p: { xs: 2, sm: 2.5 },
				borderRadius: 3,
				border: '1px solid #e2e8f0',
				bgcolor: '#fafcff',
				display: 'flex',
				flexDirection: 'column',
				gap: 2.5,
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					gap: 1.5,
					pb: 1.5,
					borderBottom: '1px solid #e2e8f0',
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
					<Box
						sx={{
							p: 0.75,
							borderRadius: 2,
							bgcolor: style.bgcolor,
							color: style.color,
							display: 'flex',
							border: `1px solid ${style.borderColor}`,
						}}
					>
						<MapPin size={18} />
					</Box>
					<Typography
						variant="h6"
						sx={{
							fontWeight: 800,
							color: '#0f172a',
							fontSize: { xs: '0.98rem', sm: '1.08rem' },
						}}
					>
						{logType}
					</Typography>
				</Box>

				<Chip
					label={`${items.length} ${items.length === 1 ? 'ubicación registrada' : 'ubicaciones registradas'}`}
					size="small"
					sx={{
						bgcolor: style.bgcolor,
						color: style.color,
						fontWeight: 700,
						border: `1px solid ${style.borderColor}`,
						flexShrink: 0,
					}}
				/>
			</Box>

			<Suspense
				fallback={
					<Box
						sx={{
							width: '100%',
							height: { xs: 280, sm: 360 },
							borderRadius: 2.5,
							bgcolor: '#f1f5f9',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: '#94a3b8',
							fontSize: '0.85rem',
						}}
					>
						Cargando mapa general...
					</Box>
				}
			>
				<MonitoreoMultiMarkerMap
					items={items}
					logType={logType}
					height={360}
					selectedRecordId={selectedRecordId}
					onMarkerClick={(item) => setSelectedRecordId(item.record.id)}
				/>
			</Suspense>

			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<Users size={16} className="text-slate-500" />
					<Typography
						variant="subtitle2"
						sx={{
							fontWeight: 700,
							color: '#1e293b',
							fontSize: '0.88rem',
						}}
					>
						Colaboradores registrados ({items.length})
					</Typography>
				</Box>
				<Typography
					variant="caption"
					sx={{ color: '#64748b', fontSize: '0.74rem' }}
				>
					Haz clic en &quot;Centrar&quot; o sobre una tarjeta para enfocar la
					posición del colaborador en el mapa.
				</Typography>
			</Box>

			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: {
						xs: '1fr',
						sm: 'repeat(2, 1fr)',
						lg: 'repeat(3, 1fr)',
						xl: 'repeat(4, 1fr)',
					},
					gap: 2,
				}}
			>
				{items.map((it) => (
					<MonitoreoLocalizacionCard
						key={it.record.id}
						item={it}
						isSelected={selectedRecordId === it.record.id}
						onFocusOnMap={() => setSelectedRecordId(it.record.id)}
					/>
				))}
			</Box>
		</Paper>
	);
}
