import {
	AccessTime as AccessTimeIcon,
	Assignment as AssignmentIcon,
	Close as CloseIcon,
	Comment as CommentIcon,
	LocationOn as LocationOnIcon,
	OpenInNew as OpenInNewIcon,
	PhotoCamera as PhotoCameraIcon,
	ZoomIn as ZoomInIcon,
} from '@mui/icons-material';
import {
	Avatar,
	Box,
	Button,
	Chip,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton as MuiIconButton,
	Typography,
} from '@mui/material';
import React, { useState } from 'react';
import useHorariosPolicies from '@/apps/horarios/hooks/useHorariosPolicies';
import {
	getDirectusPreviewUrl,
	getDirectusThumbnailUrl,
} from '@/apps/horarios/utils/directusAssets';
import { REGISTRO_META } from '../HistorialHorasModal';
import { formatearHoras } from '../ModalDetalleTiendaUtils';

interface HistorialTimelineViewProps {
	diaSeleccionado: any | null;
	onCloseDia: () => void;
	onCloseMain: () => void;
	onDayClick?: (date: string, employeeName: string) => void;
	empleadoNombre: string;
	esReporte?: boolean;
}

export const HistorialTimelineView: React.FC<HistorialTimelineViewProps> =
	React.memo(
		({
			diaSeleccionado,
			onCloseDia,
			onCloseMain,
			onDayClick,
			empleadoNombre,
			esReporte = true,
		}) => {
			const { esAdmin } = useHorariosPolicies();
			const esUsuarioAdmin = esAdmin();

			const [previewPhoto, setPreviewPhoto] = useState<{
				url: string;
				titulo: string;
				hora: string;
			} | null>(null);

			return (
				<>
					<Dialog
						open={!!diaSeleccionado}
						onClose={onCloseDia}
						maxWidth="xs"
						fullWidth
						slotProps={{
							paper: { sx: { borderRadius: 4, overflow: 'hidden' } },
						}}
					>
						<DialogTitle
							component="div"
							sx={{ bgcolor: '#0f2c4a', color: '#fff', py: 2, px: 2.5 }}
						>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
								}}
							>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									<AccessTimeIcon sx={{ fontSize: 20 }} />
									<Typography variant="subtitle1" fontWeight={700}>
										Detalle de Asistencia
									</Typography>
								</Box>
								<MuiIconButton
									onClick={onCloseDia}
									sx={{ color: '#fff' }}
									size="small"
								>
									<CloseIcon fontSize="small" />
								</MuiIconButton>
							</Box>
						</DialogTitle>

						<DialogContent sx={{ p: 2.5, bgcolor: '#fff' }}>
							{diaSeleccionado && (
								<Box
									sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
								>
									<Box
										sx={{
											bgcolor: '#f1f5f9',
											p: 1.5,
											borderRadius: 3,
											border: '1px solid #e2e8f0',
										}}
									>
										<Typography
											variant="caption"
											color="text.secondary"
											fontWeight={700}
											display="block"
											sx={{ textTransform: 'uppercase', mb: 0.25 }}
										>
											JORNADA DIARIA
										</Typography>
										<Typography
											variant="subtitle2"
											fontWeight={850}
											color="#0f2c4a"
											sx={{ textTransform: 'capitalize' }}
										>
											{diaSeleccionado.fecha
												.locale('es')
												.format('dddd, D [de] MMMM')}
										</Typography>
										<Typography
											variant="body2"
											fontWeight={800}
											color="#004680"
											sx={{ mt: 0.5 }}
										>
											Tiempo Total: {formatearHoras(diaSeleccionado.minutos)}
										</Typography>
									</Box>

									<Box sx={{ display: 'flex', flexDirection: 'column', pl: 1 }}>
										{(() => {
											const marcasOrdenadas = [...diaSeleccionado.records].sort(
												(a, b) => {
													const h1 = a.record_time || a.time || '00:00';
													const h2 = b.record_time || b.time || '00:00';
													return h1.localeCompare(h2);
												},
											);

											if (marcasOrdenadas.length === 0) {
												return (
													<Typography
														variant="body2"
														color="text.secondary"
														sx={{ fontStyle: 'italic', py: 2 }}
													>
														No se encontraron marcas de asistencia.
													</Typography>
												);
											}

											return marcasOrdenadas.map((r, idx) => {
												const meta = REGISTRO_META[r.log_type] || {
													icon: <AssignmentIcon sx={{ fontSize: 18 }} />,
													color: '#64748b',
													bg: '#f1f5f9',
												};
												const esUltimo = idx === marcasOrdenadas.length - 1;
												const horaStr = r.record_time || r.time || '--:--';
												const comentario = r.observations;
												const lat = r.latitude ?? r.location?.coordinates?.[1];
												const lon = r.longitude ?? r.location?.coordinates?.[0];
												const tieneCoords =
													esUsuarioAdmin && lat != null && lon != null;

												return (
													<Box
														key={idx}
														sx={{
															display: 'flex',
															gap: 2,
															position: 'relative',
														}}
													>
														<Box
															sx={{
																display: 'flex',
																flexDirection: 'column',
																alignItems: 'center',
															}}
														>
															<Avatar
																sx={{
																	width: 32,
																	height: 32,
																	bgcolor: meta.bg,
																	color: meta.color,
																	border: `1px solid ${meta.color}33`,
																	zIndex: 2,
																}}
															>
																{meta.icon}
															</Avatar>
															{!esUltimo && (
																<Box
																	sx={{
																		width: 2,
																		bgcolor: '#e2e8f0',
																		flexGrow: 1,
																		my: 0.5,
																		zIndex: 1,
																	}}
																/>
															)}
														</Box>

														<Box
															sx={{
																flexGrow: 1,
																minWidth: 0,
																pb: esUltimo ? 0 : 3,
															}}
														>
															<Box
																sx={{
																	display: 'flex',
																	justifyContent: 'space-between',
																	alignItems: 'center',
																	flexWrap: 'wrap',
																	gap: 1,
																}}
															>
																<Typography
																	variant="body2"
																	fontWeight={800}
																	color="#0f2c4a"
																>
																	{r.log_type}
																</Typography>
																<Chip
																	label={horaStr.substring(0, 5)}
																	size="small"
																	sx={{
																		bgcolor: '#f1f5f9',
																		fontWeight: 800,
																		fontSize: '0.72rem',
																		height: 20,
																	}}
																/>
															</Box>

															{/* Miniatura de fotografía transformada en Directus */}
															{r.photo && (
																<Box
																	sx={{
																		display: 'flex',
																		alignItems: 'center',
																		gap: 1.5,
																		mt: 1,
																	}}
																>
																	<Box
																		onClick={() =>
																			setPreviewPhoto({
																				url: getDirectusPreviewUrl(r.photo, {
																					width: 500,
																					height: 500,
																					quality: 85,
																					blur: esReporte ? 0 : 10,
																				}),
																				titulo: r.log_type,
																				hora: horaStr,
																			})
																		}
																		sx={{
																			width: 52,
																			height: 52,
																			borderRadius: 2,
																			overflow: 'hidden',
																			border: '2px solid #e2e8f0',
																			cursor: 'pointer',
																			position: 'relative',
																			bgcolor: '#f8fafc',
																			flexShrink: 0,
																			'&:hover .zoom-icon': { opacity: 1 },
																			'&:hover': { borderColor: '#004680' },
																		}}
																	>
																		<Box
																			component="img"
																			src={getDirectusThumbnailUrl(r.photo, {
																				width: 96,
																				height: 96,
																				quality: 75,
																				blur: esReporte ? 0 : 12,
																			})}
																			alt="Foto de marcación"
																			sx={{
																				width: '100%',
																				height: '100%',
																				objectFit: 'cover',
																			}}
																		/>
																		<Box
																			className="zoom-icon"
																			sx={{
																				position: 'absolute',
																				inset: 0,
																				bgcolor: 'rgba(15, 44, 74, 0.4)',
																				display: 'flex',
																				alignItems: 'center',
																				justifyContent: 'center',
																				opacity: 0,
																				transition: 'opacity 0.2s',
																				color: '#fff',
																			}}
																		>
																			<ZoomInIcon sx={{ fontSize: 18 }} />
																		</Box>
																	</Box>
																	<Box>
																		<Chip
																			icon={
																				<PhotoCameraIcon
																					sx={{ fontSize: '13px !important' }}
																				/>
																			}
																			label="Foto facial"
																			size="small"
																			sx={{
																				height: 20,
																				fontSize: '0.68rem',
																				fontWeight: 700,
																				bgcolor: '#ecfdf5',
																				color: '#059669',
																				border: '1px solid #a7f3d0',
																			}}
																		/>
																		<Typography
																			variant="caption"
																			sx={{
																				color: '#94a3b8',
																				display: 'block',
																				fontSize: '0.68rem',
																				mt: 0.25,
																			}}
																		>
																			Clic para ampliar
																		</Typography>
																	</Box>
																</Box>
															)}

															{/* Coordenadas GPS (Estricto solo administradores) */}
															{tieneCoords && (
																<Box
																	sx={{
																		display: 'flex',
																		alignItems: 'center',
																		justifyContent: 'space-between',
																		gap: 1,
																		mt: 1,
																		p: 1,
																		bgcolor: '#f0f7ff',
																		borderRadius: 2,
																		border: '1px solid #d0e3fa',
																	}}
																>
																	<Box
																		sx={{
																			display: 'flex',
																			alignItems: 'center',
																			gap: 0.75,
																			minWidth: 0,
																		}}
																	>
																		<LocationOnIcon
																			sx={{
																				fontSize: 16,
																				color: '#004680',
																				flexShrink: 0,
																			}}
																		/>
																		<Box sx={{ minWidth: 0 }}>
																			<Typography
																				variant="caption"
																				sx={{
																					fontWeight: 700,
																					color: '#0f2c4a',
																					display: 'block',
																					fontSize: '0.72rem',
																				}}
																			>
																				{Number(lat).toFixed(5)},{' '}
																				{Number(lon).toFixed(5)}
																			</Typography>
																			{r.accuracy != null && (
																				<Typography
																					variant="caption"
																					sx={{
																						color: '#64748b',
																						fontSize: '0.65rem',
																					}}
																				>
																					Precisión: ±{Math.round(r.accuracy)}m
																				</Typography>
																			)}
																		</Box>
																	</Box>
																	<Button
																		href={`https://www.google.com/maps?q=${lat},${lon}`}
																		target="_blank"
																		rel="noopener noreferrer"
																		size="small"
																		endIcon={
																			<OpenInNewIcon
																				sx={{ fontSize: '12px !important' }}
																			/>
																		}
																		sx={{
																			fontSize: '0.7rem',
																			textTransform: 'none',
																			fontWeight: 700,
																			py: 0.25,
																			px: 1,
																			minWidth: 'auto',
																			bgcolor: '#004680',
																			color: '#fff',
																			borderRadius: 1.5,
																			'&:hover': { bgcolor: '#003366' },
																		}}
																	>
																		Mapa
																	</Button>
																</Box>
															)}

															{comentario?.trim() && (
																<Box
																	sx={{
																		display: 'flex',
																		alignItems: 'flex-start',
																		gap: 0.75,
																		mt: 0.75,
																		p: 1,
																		bgcolor: '#f8fafc',
																		borderRadius: 2,
																		border: '1px solid #f1f5f9',
																		maxWidth: '100%',
																	}}
																>
																	<CommentIcon
																		sx={{
																			fontSize: 12,
																			color: '#94a3b8',
																			mt: 0.25,
																			flexShrink: 0,
																		}}
																	/>
																	<Typography
																		variant="caption"
																		color="text.secondary"
																		sx={{
																			fontSize: '0.72rem',
																			lineHeight: 1.35,
																			wordBreak: 'break-word',
																			overflowWrap: 'anywhere',
																		}}
																	>
																		{comentario}
																	</Typography>
																</Box>
															)}
														</Box>
													</Box>
												);
											});
										})()}
									</Box>
								</Box>
							)}
						</DialogContent>

						<DialogActions
							sx={{ p: 2, borderTop: '1px solid #e2e8f0', gap: 1.5 }}
						>
							<Button
								onClick={onCloseDia}
								variant="outlined"
								fullWidth={!onDayClick}
								sx={{
									borderRadius: 2,
									textTransform: 'none',
									fontWeight: 700,
									borderColor: '#e2e8f0',
									color: '#0f2c4a',
									'&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
								}}
							>
								Volver al Historial
							</Button>
							{onDayClick && (
								<Button
									onClick={() => {
										if (onDayClick && diaSeleccionado) {
											onDayClick(
												diaSeleccionado.fecha.format('YYYY-MM-DD'),
												empleadoNombre,
											);
										}
										onCloseDia();
										onCloseMain();
									}}
									variant="contained"
									color="primary"
									disableElevation
									sx={{
										borderRadius: 2,
										textTransform: 'none',
										fontWeight: 700,
										bgcolor: '#004680',
										'&:hover': { bgcolor: '#003366' },
									}}
								>
									Ir a este día en tienda
								</Button>
							)}
						</DialogActions>
					</Dialog>

					{/* Lightbox / Modal ampliado de la foto */}
					<Dialog
						open={!!previewPhoto}
						onClose={() => setPreviewPhoto(null)}
						maxWidth="xs"
						fullWidth
						slotProps={{
							paper: { sx: { borderRadius: 4, overflow: 'hidden' } },
						}}
					>
						<DialogTitle
							component="div"
							sx={{ bgcolor: '#0f2c4a', color: '#fff', py: 1.5, px: 2 }}
						>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
								}}
							>
								<Box>
									<Typography variant="subtitle2" fontWeight={800}>
										{previewPhoto?.titulo}
									</Typography>
									<Typography
										variant="caption"
										sx={{ color: 'rgba(255,255,255,0.8)' }}
									>
										{empleadoNombre} • {previewPhoto?.hora.slice(0, 5)}
									</Typography>
								</Box>
								<MuiIconButton
									onClick={() => setPreviewPhoto(null)}
									sx={{ color: '#fff' }}
									size="small"
								>
									<CloseIcon fontSize="small" />
								</MuiIconButton>
							</Box>
						</DialogTitle>
						<DialogContent
							sx={{
								p: 2,
								bgcolor: '#0f172a',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							{previewPhoto && (
								<Box
									component="img"
									src={previewPhoto.url}
									alt={previewPhoto.titulo}
									sx={{
										maxWidth: '100%',
										maxHeight: 380,
										borderRadius: 2,
										objectFit: 'contain',
									}}
								/>
							)}
						</DialogContent>
					</Dialog>
				</>
			);
		},
	);
