import { Box, Button, Card, Tooltip, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Clock, Flag, Maximize2, User } from 'lucide-react';
import { useState } from 'react';
import { updateTimeRecord } from '../../api/directus/create';
import type { TimeRecordDto } from '../../interfaces/api/timeRecords';
import { getDirectusPreviewUrl } from '../../utils/directusAssets';
import { formatDocumentNumber } from '../../utils/format';
import { AttendancePhotoLightbox } from '../attendance/AttendancePhotoLightbox';
import { MarcarRevisionDialog } from './MarcarRevisionDialog';

export interface MonitoreoFotoCardProps {
	record: TimeRecordDto;
}

export function MonitoreoFotoCard({ record }: MonitoreoFotoCardProps) {
	const [lightboxOpen, setLightboxOpen] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const enRevision = record.is_under_review === true;

	const queryClient = useQueryClient();
	const revision = useMutation({
		mutationFn: (razon: string) =>
			updateTimeRecord(record.id, {
				is_under_review: true,
				review_reason: razon,
			}),
		onSuccess: () => {
			setDialogOpen(false);
			// Fotos y localización leen las mismas marcaciones
			queryClient.invalidateQueries({
				queryKey: ['monitoreoFotosTimeRecords'],
			});
			queryClient.invalidateQueries({
				queryKey: ['monitoreoLocalizacionTimeRecords'],
			});
		},
	});

	const emp = record.employee_id;
	const nombreCompleto =
		[emp?.first_name, emp?.middle_name, emp?.last_name, emp?.second_last_name]
			.filter(Boolean)
			.join(' ')
			.trim() || 'Empleado sin nombre';

	const storeObj =
		record.store_id && typeof record.store_id === 'object'
			? record.store_id
			: null;
	const storeName =
		storeObj?.name ??
		(typeof record.store_id === 'string'
			? record.store_id
			: `Tienda #${storeObj?.id ?? record.store_id ?? ''}`);

	// Unblurred high-clarity photo preview
	const photoUrl = record.photo
		? getDirectusPreviewUrl(record.photo, {
				width: 600,
				height: 600,
				quality: 90,
				fit: 'cover',
				blur: 0,
			})
		: null;

	return (
		<>
			<Card
				elevation={0}
				sx={{
					borderRadius: 3,
					border: '1px solid',
					borderColor: enRevision ? '#f59e0b' : '#e2e8f0',
					bgcolor: '#ffffff',
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					transition: 'all 0.2s ease-in-out',
					boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
					'&:hover': {
						borderColor: '#004680',
						boxShadow: '0 6px 18px rgba(0,70,128,0.1)',
						transform: 'translateY(-2px)',
					},
				}}
			>
				{/* Photo Container: large display, sharp unblurred photo */}
				<Box
					onClick={() => setLightboxOpen(true)}
					sx={{
						position: 'relative',
						width: '100%',
						height: 250,
						bgcolor: '#0f172a',
						cursor: 'pointer',
						overflow: 'hidden',
						'&:hover .zoom-overlay': { opacity: 1 },
					}}
					title="Clic para ampliar foto"
				>
					{photoUrl ? (
						<Box
							component="img"
							src={photoUrl}
							alt={`Foto ${record.log_type} - ${nombreCompleto}`}
							loading="lazy"
							decoding="async"
							sx={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
								display: 'block',
								transition: 'transform 0.3s ease',
								'&:hover': { transform: 'scale(1.03)' },
							}}
						/>
					) : (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								height: '100%',
								color: '#94a3b8',
								flexDirection: 'column',
								gap: 1,
							}}
						>
							<User size={36} />
							<Typography variant="caption">Sin imagen</Typography>
						</Box>
					)}

					{/* Single click zoom overlay */}
					<Box
						className="zoom-overlay"
						sx={{
							position: 'absolute',
							inset: 0,
							bgcolor: 'rgba(15, 23, 42, 0.45)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: '#ffffff',
							gap: 1,
							opacity: 0,
							transition: 'opacity 0.2s',
							fontWeight: 600,
							fontSize: '0.85rem',
						}}
					>
						<Maximize2 size={18} />
						<span>Ampliar foto</span>
					</Box>

					{enRevision && (
						<Tooltip title={record.review_reason || 'Sin razón'} arrow>
							<Box
								onClick={(e) => e.stopPropagation()}
								sx={{
									position: 'absolute',
									top: 10,
									left: 10,
									bgcolor: '#f59e0b',
									color: '#ffffff',
									px: 1,
									py: 0.4,
									borderRadius: 2,
									display: 'flex',
									alignItems: 'center',
									gap: 0.5,
									fontSize: '0.75rem',
									fontWeight: 700,
									boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
								}}
							>
								<Flag size={12} />
								<span>En revisión</span>
							</Box>
						</Tooltip>
					)}

					{/* Time badge on top-right of the photo */}
					<Box
						sx={{
							position: 'absolute',
							top: 10,
							right: 10,
							bgcolor: 'rgba(15, 23, 42, 0.85)',
							backdropFilter: 'blur(4px)',
							color: '#ffffff',
							px: 1.25,
							py: 0.5,
							borderRadius: 2,
							display: 'flex',
							alignItems: 'center',
							gap: 0.75,
							fontFamily: 'monospace',
							fontSize: '0.8rem',
							fontWeight: 700,
							boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
						}}
					>
						<Clock size={13} className="text-sky-400" />
						<span>{record.record_time?.slice(0, 8) || '--:--'}</span>
					</Box>
				</Box>

				{/* Card Body: all details directly readable without double-clicking */}
				<Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
					{/* Employee Name */}
					<Tooltip title={nombreCompleto} arrow>
						<Typography
							variant="subtitle2"
							sx={{
								fontWeight: 700,
								color: '#0f172a',
								fontSize: '0.92rem',
								lineHeight: 1.3,
								whiteSpace: 'nowrap',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
							}}
						>
							{nombreCompleto}
						</Typography>
					</Tooltip>

					{/* Document Number */}
					{emp?.document_number && (
						<Typography
							variant="caption"
							sx={{ color: '#64748b', fontWeight: 600 }}
						>
							Doc: {formatDocumentNumber(emp.document_number)}
						</Typography>
					)}

					{/* Store and Date */}
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							pt: 0.75,
							borderTop: '1px solid #f1f5f9',
							color: '#475569',
							fontSize: '0.78rem',
						}}
					>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 0.75,
								minWidth: 0,
								maxWidth: '60%',
							}}
						>
							<Building2 size={14} className="text-slate-400 shrink-0" />
							<Typography
								variant="caption"
								sx={{
									color: '#475569',
									fontWeight: 600,
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
								}}
							>
								{storeName}
							</Typography>
						</Box>

						<Typography
							variant="caption"
							sx={{ color: '#94a3b8', fontWeight: 500 }}
						>
							{record.record_date}
						</Typography>
					</Box>

					{!enRevision && (
						<Button
							size="small"
							onClick={() => setDialogOpen(true)}
							startIcon={<Flag size={14} />}
							sx={{
								textTransform: 'none',
								fontWeight: 700,
								fontSize: '0.78rem',
								color: '#b45309',
							}}
						>
							Marcar para revisión
						</Button>
					)}
				</Box>
			</Card>

			<MarcarRevisionDialog
				open={dialogOpen}
				empleado={nombreCompleto}
				guardando={revision.isPending}
				error={revision.isError}
				onClose={() => setDialogOpen(false)}
				onConfirmar={(razon) => revision.mutate(razon)}
			/>

			{/* Lightbox for full screen inspection on single click */}
			<AttendancePhotoLightbox
				open={lightboxOpen}
				onClose={() => setLightboxOpen(false)}
				photoUrl={photoUrl}
				title={`${record.log_type} - ${nombreCompleto}`}
				subtitle={`${storeName} • ${record.record_date} ${record.record_time}`}
			/>
		</>
	);
}
