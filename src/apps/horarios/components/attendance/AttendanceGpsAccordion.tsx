import { ChevronDown, ChevronUp, ExternalLink, MapPin } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

const LeafletMap = lazy(() =>
	import('./LeafletMap').then((m) => ({ default: m.LeafletMap })),
);

export interface AttendanceGpsAccordionProps {
	lat: number;
	lon: number;
	accuracy?: number | null;
	title?: string;
	hora?: string | null;
	defaultExpanded?: boolean;
	compact?: boolean;
}

export function AttendanceGpsAccordion({
	lat,
	lon,
	accuracy,
	title,
	hora,
	defaultExpanded = false,
	compact = false,
}: AttendanceGpsAccordionProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	return (
		<div
			className={`rounded-2xl border transition-all duration-200 ${
				expanded
					? 'bg-[#f0f7ff] border-[#b9d7fb] shadow-sm'
					: 'bg-[#f8fbff] border-[#d8e8fc] hover:border-[#b9d7fb]'
			} ${compact ? 'p-2' : 'p-3'}`}
		>
			<div className="flex items-center justify-between gap-2">
				{/* Info Coordenadas */}
				<div className="flex items-center gap-2 min-w-0">
					<div
						className={`rounded-lg bg-blue-100 text-[#004680] flex items-center justify-center shrink-0 ${
							compact ? 'w-6 h-6' : 'w-7 h-7'
						}`}
					>
						<MapPin size={compact ? 13 : 15} />
					</div>
					<div className="min-w-0">
						<p
							className={`font-bold text-[#0f2c4a] truncate ${
								compact ? 'text-[11px]' : 'text-xs'
							}`}
						>
							{lat.toFixed(5)}, {lon.toFixed(5)}
						</p>
						{accuracy != null && (
							<p
								className={`text-slate-500 truncate ${
									compact ? 'text-[10px]' : 'text-[11px]'
								}`}
							>
								Precisión: ±{Math.round(accuracy)}m
							</p>
						)}
					</div>
				</div>

				{/* Acciones */}
				<div className="flex items-center gap-1.5 shrink-0">
					{/* Botón Acordeón Mapa */}
					<button
						type="button"
						onClick={() => setExpanded((prev) => !prev)}
						className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#004680] text-white hover:bg-[#003866] transition-colors shadow-xs cursor-pointer"
						title={expanded ? 'Ocultar mapa' : 'Ver mapa en vivo con Leaflet'}
					>
						<span>{expanded ? 'Ocultar' : 'Ver mapa'}</span>
						{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
					</button>

					{/* Botón externo Google Maps */}
					<a
						href={`https://www.google.com/maps?q=${lat},${lon}`}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-[#004680] hover:bg-blue-100/60 transition-colors"
						title="Abrir en Google Maps"
					>
						<ExternalLink size={13} />
					</a>
				</div>
			</div>

			{/* Contenedor expandible del mapa interactivo con Leaflet */}
			{expanded && (
				<div className="mt-3 pt-3 border-t border-[#d8e8fc]/80 animate-in fade-in duration-200">
					<Suspense
						fallback={
							<div
								style={{ height: compact ? 180 : 210, borderRadius: 12 }}
								className="bg-slate-100 animate-pulse"
							/>
						}
					>
						<LeafletMap
							lat={lat}
							lon={lon}
							accuracy={accuracy}
							title={title}
							hora={hora}
							height={compact ? 180 : 210}
						/>
					</Suspense>
				</div>
			)}
		</div>
	);
}
