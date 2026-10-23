import { Box, Button } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import type { LocalizacionRecordItem } from '../../hooks/useMonitoreoLocalizacion';
import { formatDocumentNumber } from '../../utils/format';

export interface MonitoreoMultiMarkerMapProps {
	items: LocalizacionRecordItem[];
	logType: string;
	height?: number | string;
	selectedRecordId?: number | null;
	onMarkerClick?: (item: LocalizacionRecordItem) => void;
}

export function getLogTypeColor(logType: string): string {
	const lower = logType.toLowerCase();
	if (
		lower.includes('comenzar') ||
		lower.includes('inicio jornada') ||
		lower.includes('entrada')
	) {
		return '#16a34a'; // Green
	}
	if (lower.includes('iniciar almuerzo')) {
		return '#d97706'; // Amber
	}
	if (lower.includes('finalizar almuerzo') || lower.includes('fin almuerzo')) {
		return '#ea580c'; // Orange
	}
	if (
		lower.includes('terminar') ||
		lower.includes('fin jornada') ||
		lower.includes('salida')
	) {
		return '#dc2626'; // Red
	}
	return '#004680'; // Primary Blue
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function getInitials(emp?: {
	first_name?: string | null;
	last_name?: string | null;
}): string {
	const f = emp?.first_name?.trim()?.charAt(0) || '';
	const l = emp?.last_name?.trim()?.charAt(0) || '';
	return (f + l).toUpperCase() || '•';
}

function createCustomPin(initials: string, color: string): L.DivIcon {
	return L.divIcon({
		className: 'multi-marker-pin',
		html: `
			<div style="
				position: relative;
				width: 32px;
				height: 38px;
				display: flex;
				flex-direction: column;
				align-items: center;
				cursor: pointer;
			">
				<div style="
					width: 30px;
					height: 30px;
					background-color: ${color};
					border: 2px solid #ffffff;
					border-radius: 50% 50% 50% 0;
					transform: rotate(-45deg);
					display: flex;
					align-items: center;
					justify-content: center;
					box-shadow: 0 3px 8px rgba(0,0,0,0.35);
				">
					<span style="
						transform: rotate(45deg);
						color: #ffffff;
						font-family: ui-sans-serif, system-ui, sans-serif;
						font-size: 11px;
						font-weight: 800;
						letter-spacing: -0.5px;
						user-select: none;
					">
						${initials}
					</span>
				</div>
				<div style="
					width: 8px;
					height: 4px;
					background-color: rgba(0,0,0,0.25);
					border-radius: 50%;
					margin-top: 1px;
					filter: blur(1px);
				"></div>
			</div>
		`,
		iconSize: [32, 38],
		iconAnchor: [16, 36],
		popupAnchor: [0, -34],
	});
}

export function MonitoreoMultiMarkerMap({
	items,
	logType,
	height = 360,
	selectedRecordId,
	onMarkerClick,
}: MonitoreoMultiMarkerMapProps) {
	const mapContainerRef = useRef<HTMLDivElement | null>(null);
	const mapInstanceRef = useRef<L.Map | null>(null);
	const markersMapRef = useRef<Map<number, L.Marker>>(new Map());

	const pinColor = getLogTypeColor(logType);

	const fitAllMarkers = useCallback(() => {
		const map = mapInstanceRef.current;
		if (!map || items.length === 0) return;

		if (items.length === 1) {
			map.setView([items[0].lat, items[0].lon], 16);
		} else {
			const bounds = L.latLngBounds(items.map((it) => [it.lat, it.lon]));
			map.fitBounds(bounds, { padding: [45, 45], maxZoom: 17 });
		}
	}, [items]);

	// Initialize and update Leaflet map and markers
	useEffect(() => {
		if (!mapContainerRef.current || items.length === 0) return;

		// Clean up existing instance before recreating
		if (mapInstanceRef.current) {
			mapInstanceRef.current.remove();
			mapInstanceRef.current = null;
			markersMapRef.current.clear();
		}

		// Initial center: first item or Colombia center fallback
		const initialCenter: [number, number] = [items[0].lat, items[0].lon];

		const map = L.map(mapContainerRef.current, {
			center: initialCenter,
			zoom: 15,
			zoomControl: true,
			attributionControl: true,
			preferCanvas: true,
		});

		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
		}).addTo(map);

		const newMarkers = new Map<number, L.Marker>();

		// Plot each item on the map
		for (const item of items) {
			const emp = item.record.employee_id;
			const nombreCompleto =
				[
					emp?.first_name,
					emp?.middle_name,
					emp?.last_name,
					emp?.second_last_name,
				]
					.filter(Boolean)
					.join(' ')
					.trim() || 'Empleado';

			const initials = getInitials(emp ?? {});
			const docFormatted = emp?.document_number
				? formatDocumentNumber(emp.document_number)
				: null;
			const hora = item.record.record_time?.slice(0, 8) || '--:--';
			const googleMapsUrl = `https://www.google.com/maps?q=${item.lat},${item.lon}`;

			const icon = createCustomPin(initials, pinColor);
			const marker = L.marker([item.lat, item.lon], { icon }).addTo(map);

			const popupContent = `
				<div style="font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; min-width: 200px; padding: 4px 2px;">
					<div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px; line-height: 1.3;">
						${escapeHtml(nombreCompleto)}
					</div>
					${
						docFormatted
							? `<div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">Doc: ${escapeHtml(docFormatted)}</div>`
							: ''
					}
					<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
						<span style="background: #f1f5f9; color: #334155; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-family: monospace;">
							🕒 ${escapeHtml(hora)}
						</span>
						${
							item.accuracy != null && item.accuracy > 0
								? `<span style="background: ${item.accuracy > 100 ? '#fef3c7' : '#e0f2fe'}; color: ${item.accuracy > 100 ? '#92400e' : '#004680'}; font-size: 10px; font-weight: 600; padding: 2px 5px; border-radius: 4px;">
									±${Math.round(item.accuracy)}m${item.accuracy > 100 ? ' (Margen alto)' : ''}
								</span>`
								: ''
						}
					</div>
					<div style="font-size: 10px; color: #94a3b8; font-family: monospace; margin-bottom: 8px;">
						${item.lat.toFixed(5)}, ${item.lon.toFixed(5)}
					</div>
					<a href="${googleMapsUrl}"
					   target="_blank"
					   rel="noopener noreferrer"
					   style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #004680; text-decoration: none;">
						Ver en Google Maps ↗
					</a>
				</div>
			`;

			marker.bindPopup(popupContent, {
				minWidth: 200,
				maxWidth: 280,
				closeButton: true,
			});

			marker.on('click', () => {
				if (onMarkerClick) {
					onMarkerClick(item);
				}
			});

			// Add accuracy circle with visual cap at 250m
			// If error is high (> 100m), display in dashed amber to indicate approximate radius
			if (item.accuracy != null && item.accuracy > 0) {
				const isHighError = item.accuracy > 100;
				const visualRadius = Math.min(item.accuracy, 250);
				L.circle([item.lat, item.lon], {
					radius: visualRadius,
					color: isHighError ? '#f59e0b' : pinColor,
					weight: 1.2,
					dashArray: isHighError ? '4, 4' : undefined,
					fillColor: isHighError ? '#f59e0b' : pinColor,
					fillOpacity: isHighError ? 0.07 : 0.08,
				}).addTo(map);
			}

			newMarkers.set(item.record.id, marker);
		}

		markersMapRef.current = newMarkers;
		mapInstanceRef.current = map;

		// Fit bounds across all pins
		if (items.length === 1) {
			map.setView([items[0].lat, items[0].lon], 16);
		} else if (items.length > 1) {
			const bounds = L.latLngBounds(items.map((it) => [it.lat, it.lon]));
			map.fitBounds(bounds, { padding: [45, 45], maxZoom: 17 });
		}

		// Responsive resize handling (e.g. accordion open/close, screen orientation change)
		const resizeObserver = new ResizeObserver(() => {
			map.invalidateSize();
		});
		if (mapContainerRef.current) {
			resizeObserver.observe(mapContainerRef.current);
		}

		// Initial invalidation after mount animation
		const timer = setTimeout(() => {
			map.invalidateSize();
		}, 200);

		return () => {
			clearTimeout(timer);
			resizeObserver.disconnect();
			if (mapInstanceRef.current) {
				mapInstanceRef.current.remove();
				mapInstanceRef.current = null;
			}
			markersMapRef.current.clear();
		};
	}, [items, pinColor, onMarkerClick]);

	// React to programmatic selection of an employee
	useEffect(() => {
		if (selectedRecordId == null || !mapInstanceRef.current) return;
		const marker = markersMapRef.current.get(selectedRecordId);
		if (marker) {
			const latLng = marker.getLatLng();
			mapInstanceRef.current.flyTo(latLng, 17, {
				animate: true,
				duration: 0.8,
			});
			marker.openPopup();
		}
	}, [selectedRecordId]);

	return (
		<Box
			sx={{
				position: 'relative',
				width: '100%',
				height: typeof height === 'number' ? `${height}px` : height,
				borderRadius: 2.5,
				overflow: 'hidden',
				border: '1px solid #cbd5e1',
				bgcolor: '#f8fafc',
				isolation: 'isolate',
				zIndex: 0,
			}}
		>
			<Box
				ref={mapContainerRef}
				sx={{
					width: '100%',
					height: '100%',
				}}
			/>

			{/* Top-Right: Fit All Button */}
			{items.length > 1 && (
				<Button
					size="small"
					variant="contained"
					onClick={fitAllMarkers}
					startIcon={<Maximize2 size={13} />}
					sx={{
						position: 'absolute',
						top: 10,
						right: 10,
						zIndex: 400,
						bgcolor: 'rgba(255, 255, 255, 0.95)',
						color: '#004680',
						fontWeight: 700,
						fontSize: '0.75rem',
						backdropFilter: 'blur(4px)',
						boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
						border: '1px solid #cbd5e1',
						textTransform: 'none',
						px: 1.25,
						py: 0.5,
						'&:hover': {
							bgcolor: '#ffffff',
							borderColor: '#004680',
						},
					}}
				>
					Ver todos ({items.length})
				</Button>
			)}

			{/* Bottom-Left: Mini Legend Badge */}
			<Box
				sx={{
					position: 'absolute',
					bottom: 10,
					left: 10,
					zIndex: 400,
					bgcolor: 'rgba(15, 23, 42, 0.85)',
					color: '#ffffff',
					px: 1.25,
					py: 0.5,
					borderRadius: 2,
					backdropFilter: 'blur(4px)',
					fontSize: '0.75rem',
					fontWeight: 600,
					display: 'flex',
					alignItems: 'center',
					gap: 1,
					pointerEvents: 'none',
					boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
				}}
			>
				<Box
					sx={{
						width: 8,
						height: 8,
						borderRadius: '50%',
						bgcolor: pinColor,
					}}
				/>
				<span>
					{items.length}{' '}
					{items.length === 1
						? 'colaborador en el mapa'
						: 'colaboradores en el mapa'}
				</span>
			</Box>
		</Box>
	);
}
