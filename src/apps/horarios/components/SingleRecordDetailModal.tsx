import {
	Button,
	Chip,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton as MuiIconButton,
} from '@mui/material';
import {
	Building2,
	Camera,
	CheckCircle2,
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
import { useState } from 'react';
import { LOG_TYPE } from '../domain/registro';
import type { HistorialEventoDetalle } from '../interfaces/horarios.interface';
import { getDirectusPreviewUrl } from '../utils/directusAssets';
import { formatDocumentNumber } from '../utils/format';

export interface SingleRecordDetailModalProps {
	open: boolean;
	onClose: () => void;
	empleado: string;
	fecha: string;
	evento: HistorialEventoDetalle | null;
	esAdmin?: boolean;
	tiendaNombre?: string;
	documento?: string | null;
	esReporte?: boolean;
}

const EVENTO_META: Record<
	string,
	{ icon: typeof Play; color: string; bg: string }
> = {
	[LOG_TYPE.inicioJornada]: {
		icon: Play,
		color: '#16a34a',
		bg: '#dcfce7',
	},
	[LOG_TYPE.inicioAlmuerzo]: {
		icon: Coffee,
		color: '#ea580c',
		bg: '#ffedd5',
	},
	[LOG_TYPE.finAlmuerzo]: {
		icon: UtensilsCrossed,
		color: '#ca8a04',
		bg: '#fef9c3',
	},
	[LOG_TYPE.finJornada]: {
		icon: LogOut,
		color: '#004680',
		bg: '#eaf2fb',
	},
};

const inicial = (nombre: string) => (nombre.trim()[0] || '?').toUpperCase();

export function SingleRecordDetailModal({
	open,
	onClose,
	empleado,
	fecha,
	evento,
	esAdmin = false,
	tiendaNombre,
	documento,
	esReporte = false,
}: SingleRecordDetailModalProps) {
	const [zoomOpen, setZoomOpen] = useState(false);

	if (!evento) return null;

	const meta = EVENTO_META[evento.evento] ?? {
		icon: Play,
		color: '#64748b',
		bg: '#f1f5f9',
	};
	const Icono = meta.icon;

	const lat =
		evento.latitude ??
		(evento.location?.coordinates ? evento.location.coordinates[1] : null);
	const lon =
		evento.longitude ??
		(evento.location?.coordinates ? evento.location.coordinates[0] : null);
	const tieneCoords = esAdmin && lat != null && lon != null;

	return (
		<>
			<Dialog
				open={open}
				onClose={onClose}
				maxWidth="xs"
				fullWidth
				slotProps={{
					paper: {
						sx: {
							borderRadius: 3.5,
							overflow: 'hidden',
							boxShadow: '0 20px 40px -15px rgba(0,0,0,0.2)',
						},
					},
				}}
			>
				{/* Header del Evento */}
				<DialogTitle
					component="div"
					sx={{
						bgcolor: '#004680',
						color: '#fff',
						py: 2,
						px: 2.5,
					}}
				>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2.5">
							<div
								className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm"
								style={{ backgroundColor: meta.bg, color: meta.color }}
							>
								<Icono size={16} strokeWidth={2.5} />
							</div>
							<div>
								<h2 className="text-sm font-bold tracking-wide text-white capitalize leading-tight">
									{evento.evento}
								</h2>
								{evento.hora && (
									<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/80">
										<Clock size={11} />
										{evento.hora.slice(0, 5)}
									</span>
								)}
							</div>
						</div>
						<MuiIconButton
							onClick={onClose}
							aria-label="Cerrar"
							size="small"
							sx={{
								color: 'rgba(255,255,255,0.8)',
								'&:hover': {
									color: '#fff',
									bgcolor: 'rgba(255,255,255,0.15)',
								},
							}}
						>
							<X size={17} />
						</MuiIconButton>
					</div>
				</DialogTitle>

				{/* Empleado y Fecha */}
				<div className="px-5 py-3 bg-[#f6f9fd] border-b border-slate-100 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2.5 min-w-0">
						<div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#004680] text-white text-xs font-bold shrink-0">
							{inicial(empleado)}
						</div>
						<div className="min-w-0">
							<p className="text-xs font-bold text-[#0f2c4a] truncate capitalize">
								{empleado}
							</p>
							<div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
								<span>{fecha}</span>
								{documento && (
									<>
										<span>•</span>
										<span>Doc: {formatDocumentNumber(documento)}</span>
									</>
								)}
							</div>
						</div>
					</div>
					{esAdmin && (
						<Chip
							label="Admin"
							size="small"
							sx={{
								height: 20,
								fontSize: '0.65rem',
								fontWeight: 700,
								bgcolor: '#eaf2fb',
								color: '#004680',
								border: '1px solid #d6e6f7',
							}}
						/>
					)}
				</div>

				<DialogContent sx={{ p: 2.5, bgcolor: '#fff' }}>
					<div className="space-y-3.5">
						{/* Resumen del registro */}
						<div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
							<div className="flex items-center gap-2 text-slate-700 font-semibold min-w-0">
								<CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
								<span className="truncate">Marcación registrada</span>
							</div>
							{tiendaNombre && (
								<div className="flex items-center gap-1.5 text-slate-500 font-medium shrink-0">
									<Building2 size={13} className="text-slate-400" />
									<span className="truncate max-w-[150px]">{tiendaNombre}</span>
								</div>
							)}
						</div>

						{/* Fotografía de la marcación */}
						{evento.photo ? (
							<div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
								<div className="flex items-center justify-between mb-2">
									<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
										<Camera size={12} />
										Foto facial de verificación
									</span>
									<span className="text-[11px] text-slate-400">
										Clic para zoom
									</span>
								</div>
								<button
									type="button"
									onClick={() => setZoomOpen(true)}
									className="group relative w-full h-48 rounded-xl overflow-hidden border border-slate-200 hover:border-[#004680] cursor-pointer transition-all duration-200 bg-slate-200/60 block p-0"
									title="Ver foto ampliada"
								>
									<img
										src={getDirectusPreviewUrl(evento.photo, {
											width: 480,
											height: 480,
											quality: 85,
											blur: esReporte ? 0 : 12,
										})}
										alt={`Verificación ${evento.evento}`}
										className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
										loading="lazy"
									/>
									<div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold">
										<ZoomIn size={18} />
										<span>Ampliar imagen</span>
									</div>
								</button>
							</div>
						) : null}

						{/* Geolocalización GPS (Solo visible para administradores) */}
						{tieneCoords && (
							<div className="p-3 rounded-2xl bg-[#f0f7ff] border border-[#d0e3fa]">
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<div className="w-7 h-7 rounded-lg bg-blue-100 text-[#004680] flex items-center justify-center shrink-0">
											<MapPin size={15} />
										</div>
										<div className="min-w-0">
											<p className="text-xs font-bold text-[#0f2c4a] truncate">
												{lat?.toFixed(5)}, {lon?.toFixed(5)}
											</p>
											{evento.accuracy != null && (
												<p className="text-[11px] text-slate-500">
													Margen de precisión: ±{Math.round(evento.accuracy)}m
												</p>
											)}
										</div>
									</div>
									<Button
										href={`https://www.google.com/maps?q=${lat},${lon}`}
										target="_blank"
										rel="noopener noreferrer"
										size="small"
										endIcon={<ExternalLink size={12} />}
										sx={{
											fontSize: '0.72rem',
											textTransform: 'none',
											fontWeight: 700,
											bgcolor: '#004680',
											color: '#fff',
											borderRadius: 2,
											px: 1.5,
											py: 0.5,
											'&:hover': { bgcolor: '#003366' },
										}}
									>
										Abrir mapa
									</Button>
								</div>
							</div>
						)}

						{/* Observación o nota de texto */}
						{evento.observacion?.trim() ? (
							<div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80">
								<span className="text-[11px] font-bold text-amber-900 block mb-1 uppercase tracking-wider">
									Observación / Nota:
								</span>
								<p className="text-xs text-slate-700 leading-relaxed break-words">
									{evento.observacion}
								</p>
							</div>
						) : (
							<div className="p-3 rounded-2xl bg-slate-50/60 border border-slate-200/60 text-slate-500 flex items-center gap-2 text-xs">
								<FileText size={14} className="text-slate-400 shrink-0" />
								<span>Sin observaciones adicionales para esta marcación.</span>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			{/* Modal Lightbox de la foto a pantalla completa */}
			{evento.photo && (
				<Dialog
					open={zoomOpen}
					onClose={() => setZoomOpen(false)}
					maxWidth="sm"
					fullWidth
					slotProps={{
						paper: {
							sx: {
								borderRadius: 3.5,
								overflow: 'hidden',
								bgcolor: '#0f172a',
							},
						},
					}}
				>
					<div className="flex items-center justify-between px-4 py-3 bg-[#004680] text-white">
						<div>
							<h3 className="text-sm font-bold capitalize">{evento.evento}</h3>
							<p className="text-xs text-white/80">
								{empleado} • {evento.hora?.slice(0, 5) || ''}
							</p>
						</div>
						<MuiIconButton
							onClick={() => setZoomOpen(false)}
							sx={{ color: '#fff' }}
							size="small"
						>
							<X size={18} />
						</MuiIconButton>
					</div>
					<div className="p-3 flex items-center justify-center min-h-[300px]">
						<img
							src={getDirectusPreviewUrl(evento.photo, {
								width: 600,
								height: 600,
								quality: 90,
								blur: esReporte ? 0 : 10,
							})}
							alt={evento.evento}
							className="max-h-[70vh] w-auto rounded-xl object-contain shadow-2xl"
						/>
					</div>
				</Dialog>
			)}
		</>
	);
}
