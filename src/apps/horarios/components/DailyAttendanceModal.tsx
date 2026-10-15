import {
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton as MuiIconButton,
} from '@mui/material';
import {
	Camera,
	Clock,
	Coffee,
	ExternalLink,
	FileText,
	LogOut,
	MapPin,
	Play,
	UtensilsCrossed,
	X,
	ZoomIn,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LOG_TYPE } from '../domain/registro';
import type {
	HistorialEventoDetalle,
	ObservacionEvento,
} from '../interfaces/horarios.interface';
import {
	getDirectusPreviewUrl,
	getDirectusThumbnailUrl,
} from '../utils/directusAssets';

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

const EVENTO_META: Record<
	string,
	{ orden: number; icon: typeof Play; color: string; bg: string }
> = {
	[LOG_TYPE.inicioJornada]: {
		orden: 0,
		icon: Play,
		color: '#16a34a',
		bg: '#dcfce7',
	},
	[LOG_TYPE.inicioAlmuerzo]: {
		orden: 1,
		icon: Coffee,
		color: '#ea580c',
		bg: '#ffedd5',
	},
	[LOG_TYPE.finAlmuerzo]: {
		orden: 2,
		icon: UtensilsCrossed,
		color: '#ca8a04',
		bg: '#fef9c3',
	},
	[LOG_TYPE.finJornada]: {
		orden: 3,
		icon: LogOut,
		color: '#004680',
		bg: '#eaf2fb',
	},
};

const inicial = (nombre: string) => (nombre.trim()[0] || '?').toUpperCase();

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
		(a, b) =>
			(EVENTO_META[a.evento]?.orden ?? 99) -
			(EVENTO_META[b.evento]?.orden ?? 99),
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
								<div className="flex items-center justify-between px-5 py-3.5 bg-[#004680] shrink-0">
									<div className="flex items-center gap-2">
										<FileText size={18} className="text-white/80" />
										<h2 className="text-sm font-semibold tracking-wide text-white uppercase">
											Jornada Diaria de Asistencia
										</h2>
									</div>
									<button
										type="button"
										onClick={onClose}
										aria-label="Cerrar"
										className="flex items-center justify-center w-7 h-7 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors duration-150 cursor-pointer"
									>
										<X size={16} strokeWidth={2} />
									</button>
								</div>

								{/* Info del empleado y resumen del día */}
								<div className="px-5 py-3 bg-[#f6f9fd] border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
									<div className="flex items-center gap-3 min-w-0">
										<div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#004680] text-white text-sm font-bold shrink-0">
											{inicial(empleado)}
										</div>
										<div className="min-w-0 flex-1">
											<p className="text-sm font-bold text-[#0f2c4a] truncate capitalize">
												{empleado}
											</p>
											<p className="text-xs text-slate-500 font-medium">
												{fecha} {tiendaNombre ? `• ${tiendaNombre}` : ''}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										{totalHoras && totalHoras !== '--' && (
											<span className="inline-flex items-center text-xs font-bold text-[#004680] bg-white border border-[#d6e6f7] px-2.5 py-1 rounded-lg shadow-2xs">
												{totalHoras}
											</span>
										)}
										{esAdmin && (
											<span className="inline-flex items-center text-[10px] font-semibold tracking-wider text-[#004680] bg-[#eaf2fb] border border-[#d6e6f7] px-2 py-0.5 rounded-full uppercase">
												Admin
											</span>
										)}
									</div>
								</div>

								{/* Timeline cronológico de todos los eventos del día */}
								<div className="px-5 py-4 overflow-y-auto space-y-4">
									{ordenadas.length === 0 ? (
										<p className="text-sm text-slate-400 text-center py-6">
											No hay registros de asistencia para este día.
										</p>
									) : (
										ordenadas.map((item, idx) => {
											const meta = EVENTO_META[item.evento] ?? {
												icon: FileText,
												color: '#64748b',
												bg: '#f1f5f9',
												orden: 99,
											};
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

														{/* Foto de verificación con thumbnail transformado desde el origen */}
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

														{/* Geolocalización GPS (Solo visible para administradores) */}
														{tieneCoords && (
															<div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
																<div className="flex items-center gap-2 min-w-0">
																	<div className="w-6 h-6 rounded-md bg-blue-100/70 text-[#004680] flex items-center justify-center shrink-0">
																		<MapPin size={13} />
																	</div>
																	<div className="min-w-0 text-xs">
																		<span className="font-semibold text-slate-700 block truncate">
																			{lat?.toFixed(5)}, {lon?.toFixed(5)}
																		</span>
																		{item.accuracy != null && (
																			<span className="text-[11px] text-slate-400">
																				Precisión: ±{Math.round(item.accuracy)}m
																			</span>
																		)}
																	</div>
																</div>
																<a
																	href={`https://www.google.com/maps?q=${lat},${lon}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#004680] hover:text-white bg-[#eaf2fb] hover:bg-[#004680] rounded-lg transition-colors duration-150 shrink-0"
																>
																	Mapa
																	<ExternalLink size={11} />
																</a>
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

			{/* Modal Dialog accesible para la foto ampliada */}
			<Dialog
				open={!!photoPreview}
				onClose={() => setPhotoPreview(null)}
				maxWidth="xs"
				fullWidth
				slotProps={{
					paper: {
						sx: {
							borderRadius: 4,
							overflow: 'hidden',
						},
					},
				}}
			>
				<DialogTitle
					component="div"
					sx={{
						bgcolor: '#004680',
						color: '#fff',
						py: 1.5,
						px: 2,
					}}
				>
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-sm font-bold capitalize text-white">
								{photoPreview?.titulo}
							</h3>
							<p className="text-xs text-white/80">
								{empleado} • {photoPreview?.hora?.slice(0, 5) || ''}
							</p>
						</div>
						<MuiIconButton
							onClick={() => setPhotoPreview(null)}
							sx={{ color: '#fff' }}
							size="small"
						>
							<X size={18} />
						</MuiIconButton>
					</div>
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
					{photoPreview && (
						<img
							src={photoPreview.url}
							alt={photoPreview.titulo}
							className="max-h-[380px] w-auto rounded-xl object-contain shadow-md"
						/>
					)}
				</DialogContent>
			</Dialog>
		</>,
		document.body,
	);
}
