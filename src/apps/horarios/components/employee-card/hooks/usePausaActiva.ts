import { useCallback, useEffect, useRef, useState } from 'react';
import { DURACION_PAUSA_ACTIVA_MS } from '../../../domain/registro';
import type { Resultado } from '../../../interfaces/comunes';

/** Si falla el reporte de fin de pausa, se reintenta pasado este tiempo. */
const REINTENTO_FIN_MS = 30 * 1000;

interface AlmacenPausa {
	leer(): number | null;
	guardar(expiraEn: number): void;
	borrar(): void;
}

// Temporizador del empleado demo: en memoria (window), nunca en localStorage.
const demoWindow = window as Window & { __demoActiveBreakExpires?: string };

function crearAlmacen(empleadoId: string, demo: boolean): AlmacenPausa {
	const clave = `activeBreakExpires_${empleadoId}`;
	const leerTexto = () =>
		demo ? demoWindow.__demoActiveBreakExpires : localStorage.getItem(clave);
	return {
		leer() {
			const texto = leerTexto();
			if (!texto) return null;
			const valor = Number.parseInt(texto, 10);
			return Number.isFinite(valor) ? valor : null;
		},
		guardar(expiraEn) {
			if (demo) demoWindow.__demoActiveBreakExpires = String(expiraEn);
			else localStorage.setItem(clave, String(expiraEn));
		},
		borrar() {
			if (demo) delete demoWindow.__demoActiveBreakExpires;
			else localStorage.removeItem(clave);
		},
	};
}

export function usePausaActiva(
	empleadoId: string,
	demo: boolean,
	reportarFin: () => Promise<Resultado>,
) {
	const [expiraEn, setExpiraEn] = useState<number | null>(null);
	const reportarRef = useRef(reportarFin);
	reportarRef.current = reportarFin;
	const finalizando = useRef(false);
	const reintento = useRef<ReturnType<typeof setTimeout>>();

	// Estable por empleado: se recrea solo si cambia el id o el modo demo.
	const almacenRef = useRef(crearAlmacen(empleadoId, demo));
	useEffect(() => {
		almacenRef.current = crearAlmacen(empleadoId, demo);
	}, [empleadoId, demo]);

	const finalizar = useCallback(async () => {
		if (finalizando.current) return;
		finalizando.current = true;
		setExpiraEn(null);
		try {
			const resultado = await reportarRef.current();
			if (resultado.ok) {
				almacenRef.current.borrar();
			} else {
				clearTimeout(reintento.current);
				reintento.current = setTimeout(
					() => void revisarRef.current(),
					REINTENTO_FIN_MS,
				);
			}
		} finally {
			finalizando.current = false;
		}
	}, []);

	/** Lee el almacén: retoma una pausa en curso o cierra una ya vencida. */
	const revisar = useCallback(async () => {
		const expira = almacenRef.current.leer();
		if (expira == null) {
			setExpiraEn(null);
			return;
		}
		if (expira > Date.now()) setExpiraEn(expira);
		else await finalizar();
	}, [finalizar]);
	const revisarRef = useRef(revisar);
	revisarRef.current = revisar;

	// Al montar y cuando otra pestaña cambia la pausa de este empleado.
	useEffect(() => {
		void revisar();
		const alCambiar = () => void revisar();
		window.addEventListener('storage', alCambiar);
		return () => {
			window.removeEventListener('storage', alCambiar);
			clearTimeout(reintento.current);
		};
	}, [revisar]);

	// Cierre automático al vencer.
	useEffect(() => {
		if (expiraEn == null) return;
		const t = setTimeout(
			() => void finalizar(),
			Math.max(0, expiraEn - Date.now()),
		);
		return () => clearTimeout(t);
	}, [expiraEn, finalizar]);

	const iniciar = useCallback(() => {
		const expira = Date.now() + DURACION_PAUSA_ACTIVA_MS;
		almacenRef.current.guardar(expira);
		setExpiraEn(expira);
	}, []);

	return {
		pausaEnCurso: expiraEn !== null,
		expiraEn,
		iniciar,
		/** Cierra la pausa ya (botón "Terminar Demo"). */
		terminarAhora: finalizar,
	};
}
