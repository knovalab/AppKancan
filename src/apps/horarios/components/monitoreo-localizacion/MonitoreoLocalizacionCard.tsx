import {
	Avatar,
	Box,
	Button,
	Card,
	Chip,
	IconButton,
	Tooltip,
	Typography,
} from '@mui/material';
import {
	Building2,
	Clock,
	Crosshair,
	ExternalLink,
	MapPin,
	Maximize2,
} from 'lucide-react';
import { useState } from 'react';
import type { LocalizacionRecordItem } from '../../hooks/useMonitoreoLocalizacion';
import { formatDocumentNumber } from '../../utils/format';
import { MonitoreoLocalizacionModal } from './MonitoreoLocalizacionModal';
import { getLogTypeColor } from './MonitoreoMultiMarkerMap';

export interface MonitoreoLocalizacionCardProps {
	item: LocalizacionRecordItem;
	isSelected?: boolean;
	onFocusOnMap?: () => void;
}

function getInitials(emp?: {
	first_name?: string | null;
	last_name?: string | null;
}): string {
	const f = emp?.first_name?.trim()?.charAt(0) || '';
	const l = emp?.last_name?.trim()?.charAt(0) || '';
	return (f + l).toUpperCase() || '•';
}

export function MonitoreoLocalizacionCard({
	item,
	isSelected = false,
	onFocusOnMap,
}: MonitoreoLocalizacionCardProps) {
	const [modalOpen, setModalOpen] = useState(false);
	const { record, lat, lon, accuracy } = item;

	const emp = record.employee_id;
	const nombreCompleto =
		[emp?.first_name, emp?.middle_name, emp?.last_name, emp?.second_last_name]
			.filter(Boolean)
			.join(' ')
			.trim() || 'Empleado sin nombre';

	const initials = getInitials(emp ?? {});
	const storeObj =
		record.store_id && typeof record.store_id === 'object'
			? record.store_id
			: null;
	const storeName =
		storeObj?.name ??
		(typeof record.store_id === 'string'
			? record.store_id
			: `Tienda #${storeObj?.id ?? record.store_id ?? ''}`);

	const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
	const mapTitle = `${record.log_type} - ${nombreCompleto}`;
	const mapSubtitle = `${storeName} • ${record.record_date} ${record.record_time}`;
	const pinColor = getLogTypeColor(record.log_type);

	return (
		<>
			<Card
				elevation={0}
				onClick={() => onFocusOnMap?.()}
				sx={{
					p: 2,
					borderRadius: 2.5,
					border: '1.5px solid',
					borderColor: isSelected ? '#004680' : '#e2e8f0',
					bgcolor: isSelected ? '#f0f7ff' : '#ffffff',
					cursor: 'pointer',
					display: 'flex',
					flexDirection: 'column',
					gap: 1.5,
					transition: 'all 0.2s ease-in-out',
					boxShadow: isSelected
						? '0 0 0 1px #004680, 0 4px 14px rgba(0,70,128,0.12)'
						: '0 1px 3px rgba(0,0,0,0.03)',
					'&:hover': {
						borderColor: isSelected ? '#004680' : '#94a3b8',
						boxShadow: isSelected
							? '0 0 0 1px #004680, 0 6px 18px rgba(0,70,128,0.16)'
							: '0 4px 12px rgba(0,0,0,0.06)',
						transform: 'translateY(-1px)',
					},
				}}
			>
				{/* Top row: Avatar + Employee Info + Time Badge */}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'flex-start',
						justifyContent: 'space-between',
						gap: 1.5,
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1.25,
							minWidth: 0,
							flex: 1,
						}}
					>
						<Avatar
							sx={{
								width: 36,
								height: 36,
								bgcolor: pinColor,
								color: '#ffffff',
								fontWeight: 800,
								fontSize: '0.82rem',
								boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
								flexShrink: 0,
							}}
						>
							{initials}
						</Avatar>

						<Box sx={{ minWidth: 0, flex: 1 }}>
							<Tooltip title={nombreCompleto} arrow>
								<Typography
									variant="subtitle2"
									sx={{
										fontWeight: 700,
										color: '#0f172a',
										fontSize: '0.9rem',
										lineHeight: 1.3,
										whiteSpace: 'nowrap',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
									}}
								>
									{nombreCompleto}
								</Typography>
							</Tooltip>

							{emp?.document_number && (
								<Typography
									variant="caption"
									sx={{
										color: '#64748b',
										fontWeight: 600,
										fontSize: '0.74rem',
										display: 'block',
									}}
								>
									Doc: {formatDocumentNumber(emp.document_number)}
								</Typography>
							)}
						</Box>
					</Box>

					{/* Time badge */}
					<Box
						sx={{
							bgcolor: '#0f172a',
							color: '#ffffff',
							px: 1,
							py: 0.4,
							borderRadius: 1.5,
							display: 'flex',
							alignItems: 'center',
							gap: 0.5,
							fontFamily: 'monospace',
							fontSize: '0.78rem',
							fontWeight: 700,
							flexShrink: 0,
						}}
					>
						<Clock size={12} className="text-sky-400" />
						<span>{record.record_time?.slice(0, 8) || '--:--'}</span>
					</Box>
				</Box>

				{/* Middle row: Coordinates + Accuracy */}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 0.75,
						flexWrap: 'wrap',
					}}
				>
					<Chip
						icon={<MapPin size={11} color="#004680" />}
						label={`${lat.toFixed(5)}, ${lon.toFixed(5)}`}
						size="small"
						sx={{
							bgcolor: isSelected ? '#ffffff' : '#f0f7ff',
							color: '#004680',
							fontWeight: 700,
							fontSize: '0.74rem',
							height: 22,
							border: '1px solid #bae6fd',
							'& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
						}}
					/>

					{accuracy != null && accuracy > 0 && (
						<Chip
							label={`±${Math.round(accuracy)}m`}
							size="small"
							sx={{
								bgcolor: isSelected ? '#ffffff' : '#f1f5f9',
								color: '#475569',
								fontWeight: 600,
								fontSize: '0.72rem',
								height: 22,
								border: '1px solid #e2e8f0',
							}}
						/>
					)}
				</Box>

				{/* Bottom row: Store name + Actions */}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						pt: 1,
						borderTop: '1px solid',
						borderColor: isSelected ? '#e0f2fe' : '#f1f5f9',
						gap: 1,
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.6,
							minWidth: 0,
							maxWidth: '45%',
						}}
					>
						<Building2 size={13} className="text-slate-400 shrink-0" />
						<Typography
							variant="caption"
							sx={{
								color: '#64748b',
								fontWeight: 600,
								fontSize: '0.74rem',
								whiteSpace: 'nowrap',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
							}}
						>
							{storeName}
						</Typography>
					</Box>

					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.5,
							flexShrink: 0,
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<Button
							size="small"
							variant={isSelected ? 'contained' : 'outlined'}
							onClick={() => onFocusOnMap?.()}
							startIcon={<Crosshair size={13} />}
							sx={{
								textTransform: 'none',
								fontSize: '0.74rem',
								fontWeight: 700,
								py: 0.3,
								px: 1,
								minWidth: 'auto',
								borderRadius: 1.5,
								bgcolor: isSelected ? '#004680' : 'transparent',
								borderColor: '#004680',
								color: isSelected ? '#ffffff' : '#004680',
								'&:hover': {
									bgcolor: isSelected ? '#003366' : '#e0f2fe',
								},
							}}
						>
							{isSelected ? 'Enfocado' : 'Centrar'}
						</Button>

						<Tooltip title="Ampliar mapa individual" arrow>
							<IconButton
								size="small"
								onClick={() => setModalOpen(true)}
								sx={{
									p: 0.6,
									color: '#64748b',
									borderRadius: 1.5,
									border: '1px solid #e2e8f0',
									'&:hover': {
										color: '#004680',
										bgcolor: '#f0f7ff',
										borderColor: '#cbd5e1',
									},
								}}
							>
								<Maximize2 size={13} />
							</IconButton>
						</Tooltip>

						{/* Google Maps link */}
						<Tooltip title="Abrir en Google Maps" arrow>
							<IconButton
								component="a"
								href={googleMapsUrl}
								target="_blank"
								rel="noopener noreferrer"
								size="small"
								sx={{
									p: 0.6,
									color: '#64748b',
									borderRadius: 1.5,
									border: '1px solid #e2e8f0',
									'&:hover': {
										color: '#004680',
										bgcolor: '#f0f7ff',
										borderColor: '#cbd5e1',
									},
								}}
							>
								<ExternalLink size={13} />
							</IconButton>
						</Tooltip>
					</Box>
				</Box>
			</Card>

			<MonitoreoLocalizacionModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				lat={lat}
				lon={lon}
				accuracy={accuracy}
				title={mapTitle}
				subtitle={mapSubtitle}
				hora={record.record_time}
			/>
		</>
	);
}
