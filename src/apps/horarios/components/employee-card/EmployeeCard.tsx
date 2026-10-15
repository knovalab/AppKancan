import { Card, CircularProgress, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import {
	calcularVistaTarjeta,
	EVENTO,
	type EventoTipo,
	LOG_TYPE,
	type LogType,
} from '../../domain/registro';
import type { Resultado } from '../../interfaces/comunes';
import type { AccionesTarjeta } from '../../interfaces/registro';
import NormasModal from '../NormasModal';
import { TimeRecordVerificationModal } from '../verification/TimeRecordVerificationModal';
import type { ModalCabecera } from './header/accionesCabecera';
import { EmployeeCardHeader } from './header/EmployeeCardHeader';
import { useFlujoMarcacion } from './hooks/useFlujoMarcacion';
import { usePausaActiva } from './hooks/usePausaActiva';
import { EditarHoraModal } from './modales/EditarHoraModal';
import { EventoModal } from './modales/EventoModal';
import { NovedadModal } from './modales/NovedadModal';
import { ObservacionModal } from './modales/ObservacionModal';
import { OmitirAlmuerzoModal } from './modales/OmitirAlmuerzoModal';
import { TimeSlots } from './slots/TimeSlots';
import type { NovedadFormValues } from './utils/novedadSchema';
import type { Normas } from '../../interfaces/normas';
import type { EmpleadoAsistencia } from '../../domain/registro/modelo';
import type { TipoNovedad } from '../../interfaces/novedades';
import type { Motivo } from '../../interfaces/registro';

interface EmployeeCardProps {
	empleado: EmpleadoAsistencia;
	catalogos: { tiposNovedad: TipoNovedad[]; motivos: Motivo[] };
	normas: {
		vigentes: Normas | null;
		aceptadas: boolean;
		/** La política del usuario permite aceptar normas desde la tarjeta (`temporal`). */
		puedeAceptar: boolean;
	};
	/** Real (`useAccionesTarjeta`) o demo (`useAccionesDemo`): la tarjeta no distingue. */
	acciones: AccionesTarjeta;
	/** Tarjeta del tour: sin normas, sin cámara y temporizador en memoria. */
	demo?: boolean;
}

/** Modal abierto de la tarjeta (uno a la vez). Los pasos del flujo (normas, foto) van aparte. */
type ModalTarjeta =
	| { tipo: 'observacion'; marcacion: LogType }
	| { tipo: 'hora'; marcacion: LogType }
	| { tipo: 'sinAlmuerzo' }
	| { tipo: ModalCabecera };

interface ModalAbierto {
	datos: ModalTarjeta;
	abierto: boolean;
	/** Cambia en cada apertura: remonta el modal con su estado limpio. */
	n: number;
}

// El return temprano va en un componente aparte: dentro de EmployeeCardContent
// rompería las Rules of Hooks al pasar `empleado` de vacío a cargado.
export default function EmployeeCard(props: EmployeeCardProps) {
	if (!props.empleado) {
		return (
			<Card sx={{ width: '100%', borderRadius: 3, p: 4, textAlign: 'center' }}>
				<CircularProgress size={40} />
				<Typography sx={{ mt: 2 }}>Cargando empleado...</Typography>
			</Card>
		);
	}
	return <EmployeeCardContent {...props} />;
}

/**
 * Compositor: vista (domain) + flujo de marcación + pausa + modal activo.
 * No contiene reglas de negocio ni llama a Directus.
 */
function EmployeeCardContent({
	empleado,
	catalogos,
	normas,
	acciones,
	demo = false,
}: EmployeeCardProps) {
	const { id, nombre, registros } = empleado;

	const [modal, setModal] = useState<ModalAbierto | null>(null);
	const [almuerzoOmitido, setAlmuerzoOmitido] = useState(false);

	const reportarFinPausa = useCallback(
		() =>
			acciones.reportarEvento({
				empleadoId: id,
				tipo: EVENTO.terminarPausaActiva,
			}),
		[acciones, id],
	);
	const pausa = usePausaActiva(id, demo, reportarFinPausa);

	const flujo = useFlujoMarcacion(id, acciones, {
		esDemo: demo,
		hayNormas: !!normas.vigentes,
	});

	const normasPorAceptar =
		normas.puedeAceptar && !demo && !!normas.vigentes && !normas.aceptadas;
	const vm = useMemo(
		() =>
			calcularVistaTarjeta(empleado, {
				pausaEnCurso: pausa.pausaEnCurso,
				almuerzoOmitido,
				normasPorAceptar,
			}),
		[empleado, pausa.pausaEnCurso, almuerzoOmitido, normasPorAceptar],
	);

	const abrir = useCallback((datos: ModalTarjeta) => {
		setModal((m) => ({ datos, abierto: true, n: (m?.n ?? 0) + 1 }));
	}, []);
	const cerrar = useCallback(() => {
		setModal((m) => (m ? { ...m, abierto: false } : m));
	}, []);

	const abrirObservacion = useCallback(
		(marcacion: LogType) => abrir({ tipo: 'observacion', marcacion }),
		[abrir],
	);
	const abrirHora = useCallback(
		(marcacion: LogType) => abrir({ tipo: 'hora', marcacion }),
		[abrir],
	);
	const abrirSinAlmuerzo = useCallback(
		() => abrir({ tipo: 'sinAlmuerzo' }),
		[abrir],
	);
	const abrirCabecera = useCallback(
		(tipo: ModalCabecera) => abrir({ tipo }),
		[abrir],
	);

	const guardarNovedad = (valores: NovedadFormValues) =>
		acciones.agregarNovedad({
			empleadoId: id,
			empleadoNombre: nombre,
			tipo: valores.novedad,
			fechaInicio: valores.fechaInicio,
			fechaFin: valores.fechaFin,
			observaciones: valores.observaciones,
			fechaRegistro: dayjs().format('DD/MM/YYYY HH:mm:ss'),
		});

	const guardarEvento = async (input: {
		tipo: EventoTipo;
		observacion: string;
	}): Promise<Resultado> => {
		const resultado = await acciones.reportarEvento({
			empleadoId: id,
			tipo: input.tipo,
			observacion: input.observacion,
		});
		if (resultado.ok && input.tipo === EVENTO.iniciarPausaActiva)
			pausa.iniciar();
		return resultado;
	};

	// "Sin almuerzo": las dos marcaciones seguidas; si falla la 1.ª no se intenta la 2.ª.
	const confirmarSinAlmuerzo = async (): Promise<Resultado> => {
		for (const marcacion of [LOG_TYPE.inicioAlmuerzo, LOG_TYPE.finAlmuerzo]) {
			const resultado = await acciones.registrar({ empleadoId: id, marcacion });
			if (!resultado.ok) return resultado;
		}
		setAlmuerzoOmitido(true);
		return { ok: true };
	};

	const datos = modal?.datos;

	return (
		<>
			<Card
				className="tour-employee-card"
				sx={{
					width: '100%',
					borderRadius: 3,
					overflow: 'hidden',
					boxShadow: vm.finalizado ? 'none' : '0 4px 12px rgba(0,0,0,0.04)',
					border: '1px solid #e2e8f0',
					bgcolor: '#ffffff',
				}}
			>
				<EmployeeCardHeader
					nombre={nombre}
					cargo={empleado.cargo}
					vm={vm}
					onAccion={abrirCabecera}
					onAceptarNormas={flujo.abrirNormas}
				/>
				<TimeSlots
					vm={vm}
					guardando={flujo.guardando}
					pausaExpiraEn={pausa.expiraEn}
					onTerminarDemoPausa={demo ? pausa.terminarAhora : undefined}
					onRegistrar={flujo.iniciar}
					onEditarHora={abrirHora}
					onObservar={abrirObservacion}
					onSinAlmuerzo={abrirSinAlmuerzo}
				/>
			</Card>

			{/* Modales de la tarjeta: uno a la vez; `key` los remonta limpios en cada apertura. */}
			{datos?.tipo === 'observacion' && (
				<ObservacionModal
					key={modal?.n}
					open={!!modal?.abierto}
					onClose={cerrar}
					marcacion={datos.marcacion}
					nombre={nombre}
					inicial={
						vm.marcaciones.find((m) => m.marcacion.logType === datos.marcacion)
							?.observacion ?? ''
					}
					onGuardar={(texto) =>
						acciones.observar({
							empleadoId: id,
							marcacion: datos.marcacion,
							texto,
						})
					}
				/>
			)}
			{datos?.tipo === 'hora' && (
				<EditarHoraModal
					key={modal?.n}
					open={!!modal?.abierto}
					onClose={cerrar}
					nombre={nombre}
					marcacion={datos.marcacion}
					registros={registros}
					motivos={catalogos.motivos}
					cargarMotivo={() =>
						acciones.motivoDeMarcacion({
							empleadoId: id,
							marcacion: datos.marcacion,
						})
					}
					onGuardar={({ hora, observacion, motivoId }) =>
						acciones.editarHora({
							empleadoId: id,
							marcacion: datos.marcacion,
							hora,
							observacion,
							motivoId,
						})
					}
				/>
			)}
			{datos?.tipo === 'novedad' && (
				<NovedadModal
					key={modal?.n}
					open={!!modal?.abierto}
					onClose={cerrar}
					tiposNovedad={catalogos.tiposNovedad}
					onGuardar={guardarNovedad}
				/>
			)}
			{datos?.tipo === 'evento' && (
				<EventoModal
					key={modal?.n}
					open={!!modal?.abierto}
					onClose={cerrar}
					nombre={nombre}
					onGuardar={guardarEvento}
				/>
			)}
			{datos?.tipo === 'sinAlmuerzo' && (
				<OmitirAlmuerzoModal
					key={modal?.n}
					open={!!modal?.abierto}
					onClose={cerrar}
					nombre={nombre}
					onConfirmar={confirmarSinAlmuerzo}
				/>
			)}

			{/* Pasos previos a marcar (domain/registro/pasos.ts). */}
			<NormasModal
				open={flujo.paso === 'normas'}
				normas={normas.vigentes}
				obligatorio={true}
				aceptando={flujo.aceptandoNormas}
				titleOverride={`Normativa de Registro de Horarios — ${nombre}`}
				onClose={flujo.cancelar}
				onAceptar={flujo.aceptarNormas}
			/>
			<TimeRecordVerificationModal
				open={flujo.paso === 'verificacion'}
				onClose={flujo.cerrarVerificacion}
				employeeName={nombre}
				eventName={flujo.marcacion ?? ''}
				onConfirm={flujo.confirmarVerificacion}
			/>
		</>
	);
}
