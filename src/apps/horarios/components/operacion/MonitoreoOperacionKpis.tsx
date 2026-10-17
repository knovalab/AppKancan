import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { Box, Card, CardContent, Typography } from '@mui/material';
import type React from 'react';
import type { OperacionKpis } from '../../hooks/useMonitoreoOperacionTiendas';

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
				bgcolor: '#ffffff',
				border: '1px solid #e2e8f0',
				borderRadius: 2.5,
				boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
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
							sx={{ color: '#64748b', fontWeight: 600, letterSpacing: '0.3px' }}
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

export interface MonitoreoOperacionKpisProps {
	kpis: OperacionKpis;
}

export function MonitoreoOperacionKpis({ kpis }: MonitoreoOperacionKpisProps) {
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
				label="REGISTROS EVALUADOS"
				value={kpis.totalRegistros}
			/>

			<KpiCard
				icon={<HourglassEmptyIcon fontSize="small" />}
				iconBgColor="#fef3c7"
				iconColor="#d97706"
				label="EN OPERACIÓN"
				value={kpis.enOperacion}
			/>

			<KpiCard
				icon={<CheckCircleOutlineIcon fontSize="small" />}
				iconBgColor="#dcfce7"
				iconColor="#16a34a"
				label="JORNADAS COMPLETADAS"
				value={kpis.completados}
			/>

			<KpiCard
				icon={<EventBusyIcon fontSize="small" />}
				iconBgColor={kpis.sinAbrir > 0 ? '#fee2e2' : '#f1f5f9'}
				iconColor={kpis.sinAbrir > 0 ? '#dc2626' : '#64748b'}
				label="SIN ABRIR"
				value={kpis.sinAbrir}
			/>
		</Box>
	);
}
