import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { Box, Card, CardContent, Typography } from '@mui/material';
import type React from 'react';
import type { TiendasKPIStats } from '../../utils/registroTienda';

interface KpiCardProps {
	icon: React.ReactNode;
	iconBgColor: string;
	iconColor: string;
	label: string;
	value: React.ReactNode;
}

function KpiCard({ icon, iconBgColor, iconColor, label, value }: KpiCardProps) {
	return (
		<Card
			elevation={0}
			sx={{
				bgcolor: '#f8fafc',
				border: '1px solid #e2e8f0',
				borderRadius: 2.5,
			}}
		>
			<CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
					<Box
						sx={{
							p: 1,
							borderRadius: 2,
							bgcolor: iconBgColor,
							color: iconColor,
							display: 'flex',
						}}
					>
						{icon}
					</Box>
					<Box>
						<Typography
							variant="caption"
							sx={{ color: '#64748b', fontWeight: 600 }}
						>
							{label}
						</Typography>
						<Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
							{value}
						</Typography>
					</Box>
				</Box>
			</CardContent>
		</Card>
	);
}

export interface ReporteTiendasKpisProps {
	stats: TiendasKPIStats;
}

export function ReporteTiendasKpis({ stats }: ReporteTiendasKpisProps) {
	return (
		<Box
			sx={{
				display: 'grid',
				gridTemplateColumns: {
					xs: '1fr',
					sm: 'repeat(2, 1fr)',
					md: 'repeat(4, 1fr)',
				},
				gap: 2,
			}}
		>
			<KpiCard
				icon={<StorefrontIcon fontSize="small" />}
				iconBgColor="#e0f2fe"
				iconColor="#0284c7"
				label="DÍAS / REGISTROS"
				value={stats.totalDays}
			/>

			<KpiCard
				icon={<AccessTimeIcon fontSize="small" />}
				iconBgColor="#dcfce7"
				iconColor="#16a34a"
				label="HORAS OPERATIVAS TOTALES"
				value={`${stats.totalOperativeHours} hrs`}
			/>

			<KpiCard
				icon={<AccessTimeIcon fontSize="small" />}
				iconBgColor="#fef3c7"
				iconColor="#d97706"
				label="PROMEDIO HORAS / DÍA"
				value={`${stats.avgHoursPerDay} hrs`}
			/>

			<KpiCard
				icon={<CheckCircleOutlineIcon fontSize="small" />}
				iconBgColor="#f1f5f9"
				iconColor="#475569"
				label="JORNADAS COMPLETADAS"
				value={`${stats.completedDays} / ${stats.totalDays}`}
			/>
		</Box>
	);
}
