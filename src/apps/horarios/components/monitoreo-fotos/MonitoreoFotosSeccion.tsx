import { Box, Chip, Paper, Typography } from '@mui/material';
import { Camera } from 'lucide-react';
import type { TimeRecordDto } from '../../interfaces/api/timeRecords';
import { MonitoreoFotoCard } from './MonitoreoFotoCard';

export interface MonitoreoFotosSeccionProps {
	logType: string;
	records: TimeRecordDto[];
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

export function MonitoreoFotosSeccion({
	logType,
	records,
}: MonitoreoFotosSeccionProps) {
	// Strictly do not render section or title if there are no records
	if (!records || records.length === 0) {
		return null;
	}

	const style = getLogTypeStyle(logType);

	return (
		<Paper
			elevation={0}
			sx={{
				p: 2.5,
				borderRadius: 3,
				border: '1px solid #e2e8f0',
				bgcolor: '#fafcff',
				display: 'flex',
				flexDirection: 'column',
				gap: 2,
			}}
		>
			{/* Section Header */}
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
						<Camera size={18} />
					</Box>
					<Typography
						variant="h6"
						sx={{
							fontWeight: 800,
							color: '#0f172a',
							fontSize: '1.05rem',
						}}
					>
						{logType}
					</Typography>
				</Box>

				<Chip
					label={`${records.length} ${records.length === 1 ? 'foto' : 'fotos'}`}
					size="small"
					sx={{
						bgcolor: style.bgcolor,
						color: style.color,
						fontWeight: 700,
						border: `1px solid ${style.borderColor}`,
					}}
				/>
			</Box>

			{/* Responsive Photo Cards Grid */}
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: {
						xs: '1fr',
						sm: 'repeat(2, 1fr)',
						md: 'repeat(3, 1fr)',
						lg: 'repeat(4, 1fr)',
						xl: 'repeat(5, 1fr)',
					},
					gap: 2.5,
				}}
			>
				{records.map((r) => (
					<MonitoreoFotoCard key={r.id} record={r} />
				))}
			</Box>
		</Paper>
	);
}
