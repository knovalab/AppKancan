import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export interface LeafletMapProps {
	lat: number;
	lon: number;
	accuracy?: number | null;
	title?: string;
	hora?: string | null;
	height?: number | string;
	zoom?: number;
}

export function LeafletMap({
	lat,
	lon,
	accuracy,
	title,
	hora,
	height = 200,
	zoom = 16,
}: LeafletMapProps) {
	const mapContainerRef = useRef<HTMLDivElement | null>(null);
	const mapInstanceRef = useRef<L.Map | null>(null);

	useEffect(() => {
		if (!mapContainerRef.current) return;

		// Evitar duplicar instancias si ya existe
		if (mapInstanceRef.current) {
			mapInstanceRef.current.remove();
			mapInstanceRef.current = null;
		}

		const map = L.map(mapContainerRef.current, {
			center: [lat, lon],
			zoom,
			zoomControl: true,
			attributionControl: true,
			preferCanvas: true,
		});

		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
		}).addTo(map);

		// Icono personalizado SVG libre de dependencias de rutas de assets
		const customIcon = L.divIcon({
			className: 'custom-attendance-pin',
			html: `
				<div style="
					width: 30px;
					height: 30px;
					background: #004680;
					border: 2px solid #ffffff;
					border-radius: 50% 50% 50% 0;
					transform: rotate(-45deg);
					display: flex;
					align-items: center;
					justify-content: center;
					box-shadow: 0 4px 10px rgba(0,0,0,0.3);
				">
					<div style="
						width: 10px;
						height: 10px;
						background: #ffffff;
						border-radius: 50%;
					"></div>
				</div>
			`,
			iconSize: [30, 30],
			iconAnchor: [15, 30],
			popupAnchor: [0, -30],
		});

		const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);

		if (title || hora) {
			const popupContent = `
				<div style="font-family: inherit; font-size: 12px; line-height: 1.4; padding: 2px;">
					${title ? `<strong style="color: #0f2c4a; display: block;">${title}</strong>` : ''}
					${hora ? `<span style="color: #64748b;">Hora: ${hora.slice(0, 5)}</span><br/>` : ''}
					<span style="color: #94a3b8; font-size: 11px;">${lat.toFixed(5)}, ${lon.toFixed(5)}</span>
				</div>
			`;
			marker.bindPopup(popupContent).openPopup();
		}

		// Círculo de precisión si existe (con límite visual máximo de 250m para proteger el rendimiento)
		// Si el margen de error es alto (> 100m), se muestra en color ámbar punteado indicando aproximación
		if (accuracy != null && accuracy > 0) {
			const isHighError = accuracy > 100;
			const visualRadius = Math.min(accuracy, 250);
			L.circle([lat, lon], {
				radius: visualRadius,
				color: isHighError ? '#f59e0b' : '#004680',
				weight: 1.5,
				dashArray: isHighError ? '4, 4' : undefined,
				fillColor: isHighError ? '#f59e0b' : '#0284c7',
				fillOpacity: isHighError ? 0.1 : 0.12,
			}).addTo(map);
		}

		mapInstanceRef.current = map;

		// Reajustar tamaño tras render inicial por posibles transiciones de acordeón
		const timer = setTimeout(() => {
			map.invalidateSize();
		}, 200);

		return () => {
			clearTimeout(timer);
			if (mapInstanceRef.current) {
				mapInstanceRef.current.remove();
				mapInstanceRef.current = null;
			}
		};
	}, [lat, lon, accuracy, title, hora, zoom]);

	return (
		<div
			ref={mapContainerRef}
			style={{
				width: '100%',
				height: typeof height === 'number' ? `${height}px` : height,
				borderRadius: '12px',
				overflow: 'hidden',
				position: 'relative',
				isolation: 'isolate',
				zIndex: 0,
			}}
			className="border border-slate-200 shadow-inner"
		/>
	);
}
