import { Chip, IconButton as MuiIconButton } from '@mui/material';
import { Camera, Clock, FileText, X, ZoomIn } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type {
	HistorialEventoDetalle,
	ObservacionEvento,
} from '../interfaces/horarios.interface';
import {
	getDirectusPreviewUrl,
	getDirectusThumbnailUrl,
} from '../utils/directusAssets';
import { AttendanceGpsAccordion } from './attendance/AttendanceGpsAccordion';
import { AttendancePhotoLightbox } from './attendance/AttendancePhotoLightbox';
import { getEventoMeta, getIniciales } from './attendance/attendanceMeta';

export interface DailyAttendanceModalProps {
	open: boolean;
	onClose: () => void;
	empleado: string;
	fecha: string;
	eventos?: HistorialEventoDetalle[];
	observaciones?: ObservacionEvento[];
	totalHoras?: string;
	tiendaNombre?: string;
	esAdmin?: boolean;
	esReporte?: boolean;
}

export function DailyAttendanceModal({
	open,
	onClose,
	empleado,
	fecha,
	eventos,
	observaciones = [],
	totalHoras,
	tiendaNombre,
	esAdmin = false,
	esReporte = false,
}: DailyAttendanceModalProps) {
	const [photoPreview, setPhotoPreview] = useState<{
		url: string;
		titulo: string;
		hora: string | null;
	} | null>(null);

	// Normalizar lista de eventos de la jornada
	const listaEventos: HistorialEventoDetalle[] = (
		eventos && eventos.length > 0
			? eventos
			: observaciones.map(
					(obs): HistorialEventoDetalle => ({
						evento: obs.evento,
						hora: obs.hora,
						observacion: obs.observacion,
					}),
				)
	).filter((e) => e.hora || e.observacion?.trim() || e.photo);

	const ordenadas = [...listaEventos].sort(
		(a, b) => getEventoMeta(a.evento).orden - getEventoMeta(b.evento).orden,
	);

	return createPortal(
		<>
			<AnimatePresence>
				{open && (
					<>
						<motion.div
							key="backdrop"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.18 }}
							className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
							onClick={onClose}
						/>
						<motion.div
							key="modal"
							role="dialog"
							aria-modal="true"
							initial={{ opacity: 0, scale: 0.97, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.97, y: 8 }}
							transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
							className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none p-4"
						>
							<div className="pointer-events-auto w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white flex flex-col max-h-[90vh]">
								{/* Header */}
								<div className="bg-[#004680] text-white px-5 py-4 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold border border-white/20">
											{getIniciales(empleado)}
										</div>
										<div>
											<h2 className="text-base font-bold leading-tight capitalize text-white">
												{empleado}
											</h2>
											<div className="flex items-center gap-2 mt-0.5">
												<span className="text-xs text-white/80 font-medium">
													{fecha}
												</span>
												{tiendaNombre && (
													<>
														<span className="text-white/40 text-xs">•</span>
														<span className="text-xs text-white/90 font-medium">
															{tiendaNombre}
														</span>
													</>
												)}
											</div>
										</div>
									</div>

									<div className="flex items-center gap-2">
										{esAdmin && (
											<Chip
												label="Admin"
												size="small"
												sx={{
													height: 22,
													fontSize: '0.7rem',
													fontWeight: 700,
													bgcolor: 'rgba(255, 255, 255, 0.15)',
													color: '#fff',
													border: '1px solid rgba(255, 255, 255, 0.25)',
												}}
											/>
										)}
										<MuiIconButton
											onClick={onClose}
											size="small"
											aria-label="Cerrar modal"
											sx={{
												color: 'rgba(255, 255, 255, 0.8)',
												'&:hover': {
													color: '#fff',
													bgcolor: 'rgba(255, 255, 255, 0.15)',
												},
											}}
										>
											<X size={18} />
										</MuiIconButton>
									</div>
								</div>

								{/* Resumen Superior */}
								<div className="bg-[#f0f7ff] px-5 py-2.5 border-b border-slate-100 flex items-center justify-between">
									<div className="flex items-center gap-1.5 text-xs text-[#0f2c4a] font-semibold">
										<Clock size={14} className="text-[#004680]" />
										<span>Jornada Diaria</span>
									</div>
									{totalHoras && totalHoras !== '--' && (
										<div className="flex items-center gap-1.5 bg-[#004680] text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
											<span>Total: {totalHoras}</span>
										</div>
									)}
								</div>

								{/* Línea de tiempo de eventos */}
								<div className="p-5 overflow-y-auto space-y-4 max-h-[calc(90vh-140px)]">
									{ordenadas.length === 0 ? (
										<div className="py-8 text-center text-slate-400">
											<FileText size={32} className="mx-auto mb-2 opacity-50" />
											<p className="text-sm font-medium">
												No hay marcaciones registradas para este día
											</p>
										</div>
									) : (
										ordenadas.map((item, idx) => {
											const meta = getEventoMeta(item.evento);
											const Icono = meta.icon;
											const esUltimo = idx === ordenadas.length - 1;
											const lat =
												item.latitude ?? item.location?.coordinates?.[1];
											const lon =
												item.longitude ?? item.location?.coordinates?.[0];
											const tieneCoords = esAdmin && lat != null && lon != null;
											const itemKey = `${item.evento}-${item.hora || idx}`;

											return (
												<div key={itemKey} className="flex gap-3">
													{/* Columna timeline: ícono + conector */}
													<div className="flex flex-col items-center">
														<div
															className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 shadow-sm"
															style={{
																backgroundColor: meta.bg,
																color: meta.color,
															}}
														>
															<Icono size={16} strokeWidth={2.2} />
														</div>
														{!esUltimo && (
															<div className="w-px flex-1 bg-slate-200 my-1" />
														)}
													</div>

													{/* Contenido del evento */}
													<div
														className={`flex-1 min-w-0 ${
															esUltimo ? '' : 'pb-4'
														}`}
													>
														<div className="flex items-center justify-between gap-2">
															<span className="text-sm font-bold text-[#0f2c4a] truncate">
																{item.evento}
															</span>
															{item.hora && (
																<span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
																	<Clock size={11} />
																	{item.hora.slice(0, 5)}
																</span>
															)}
														</div>

														{/* Foto de verificación con thumbnail transformado en Directus */}
														{item.photo && (
															<div className="mt-2.5 flex items-center gap-3">
																<button
																	type="button"
																	onClick={() =>
																		setPhotoPreview({
																			url: getDirectusPreviewUrl(item.photo, {
																				width: 500,
																				height: 500,
																				quality: 85,
																				blur: esReporte ? 0 : 10,
																			}),
																			titulo: item.evento,
																			hora: item.hora,
																		})
																	}
																	className="group relative w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 hover:border-[#004680] shadow-sm cursor-pointer transition-all duration-200 shrink-0 bg-slate-100 p-0 text-left"
																	title="Ver fotografía del registro"
																>
																	<img
																		src={getDirectusThumbnailUrl(item.photo, {
																			width: 96,
																			height: 96,
																			quality: 75,
																			blur: esReporte ? 0 : 12,
																		})}
																		alt={`Foto ${item.evento}`}
																		className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
																		loading="lazy"
																	/>
																	<div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
																		<ZoomIn size={16} />
																	</div>
																</button>
																<div className="text-xs">
																	<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mb-1">
																		<Camera size={11} />
																		Foto capturada
																	</span>
																	<p className="text-slate-400 text-[11px]">
																		Haz clic para agrandar
																	</p>
																</div>
															</div>
														)}

														{/* Geolocalización GPS con Leaflet interactivo (Solo administradores) */}
														{tieneCoords && (
															<div className="mt-2.5">
																<AttendanceGpsAccordion
																	lat={lat}
																	lon={lon}
																	accuracy={item.accuracy}
																	title={item.evento}
																	hora={item.hora}
																	compact={true}
																	defaultExpanded={false}
																/>
															</div>
														)}

														{/* Observación o nota de texto */}
														{item.observacion?.trim() ? (
															<div className="mt-2 p-2 rounded-lg bg-amber-50/60 border border-amber-100 text-xs text-slate-700 leading-relaxed break-words">
																<span className="font-semibold text-amber-800 block text-[11px] mb-0.5">
																	Nota:
																</span>
																{item.observacion}
															</div>
														) : null}
													</div>
												</div>
											);
										})
									)}
								</div>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			{/* Modal Lightbox reutilizable para foto ampliada */}
			<AttendancePhotoLightbox
				open={!!photoPreview}
				onClose={() => setPhotoPreview(null)}
				photoUrl={photoPreview?.url ?? null}
				title={photoPreview?.titulo}
				subtitle={`${empleado} • ${photoPreview?.hora?.slice(0, 5) || ''}`}
			/>
		</>,
		document.body,
	);
}
