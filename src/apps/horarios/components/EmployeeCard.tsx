import { Card, CircularProgress, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import * as yup from 'yup';
import { useHolidays } from '../../reservas/hooks/useHolidays';
import { getRecordReasonId } from '../api/directus/read';
import {
	type Normas,
	registrarAceptacionNormasEmpleado,
} from '../api/directus/rules';
import {
	ESTADO,
	EVENTO,
	EVENTOS_REPORTABLES,
	type EventoTipo,
	esEmpleadoDemo,
	LOG_TYPE,
	type LogType,
	MARCACIONES,
	MAX_CARACTERES_OBSERVACION,
	MAX_PAUSAS_ACTIVAS,
	requiereVerificacion,
} from '../domain/registro';
import { useHorariosPolicies } from '../hooks/useHorariosPolicies';
import type {
	EmpleadoAsistencia,
	Motivo,
} from '../interfaces/horarios.interface';
import EditHourModal from './EditHourModal';
import { EmployeeCardHeader } from './employee-card/EmployeeCardHeader';
import {
	EmployeeCardEventoModal,
	EmployeeCardNovedadModal,
	EmployeeCardObsModal,
	EmployeeCardOmitirAlmuerzoModal,
} from './employee-card/EmployeeCardModals';
import {
	type BotonSlot,
	EmployeeCardTimeSlots,
} from './employee-card/EmployeeCardTimeSlots';
import {
	getEditadoStatus,
	getHoraEvento,
	getObservacion,
	getRecordIdEvento,
	novedadSchema,
	useActiveBreak,
} from './employee-card/EmployeeCardUtils';
import NormasModal from './NormasModal';
import 'dayjs/locale/es';
import {
	TimeRecordVerificationModal,
	type VerificationData,
} from './TimeRecordVerificationModal';

interface EmployeeCardProps {
	empleado: EmpleadoAsistencia;
	tiposNovedad: { id: number; name?: string; nombre?: string }[];
	reasons: Motivo[];
	onRegistrarEvento: (
		idEmpleado: string,
		tipoEvento: LogType,
		horaOverride?: string,
		observacionOverride?: string,
		reasonId?: number | null,
		metadata?: {
			latitude?: number | null;
			longitude?: number | null;
			accuracy?: number | null;
			photo?: string | null;
		},
	) => Promise<void> | void;
	onEliminarEmpleado: (idEmpleado: string) => void;
	onGuardarObservacion: (
		idEmpleado: string,
		evento: LogType,
		texto: string,
	) => void;
	onAgregarNovedad: (novedad: {
		empleadoId: string;
		empleadoNombre: string;
		tipo: string;
		fechaInicio: string;
		fechaFin: string;
		observaciones: string;
		fechaRegistro: string;
	}) => Promise<boolean> | boolean;
	onReportarEvento: (
		idEmpleado: string,
		eventType: EventoTipo,
		observaciones?: string,
	) => Promise<boolean> | boolean;
	/** Normas vigentes y estado de aceptación: los resuelve la página en una sola consulta. */
	normas: Normas | null;
	yaAceptoNormas: boolean;
	onNormasAceptadas: (idEmpleado: string) => void;
	/** Consulta fresca (sin caché) usada al "Comenzar Jornada". */
	verificarAceptacionNormas: (idEmpleado: string) => Promise<boolean>;
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

function EmployeeCardContent({
	empleado,
	tiposNovedad,
	reasons,
	onRegistrarEvento,
	onEliminarEmpleado,
	onGuardarObservacion,
	onAgregarNovedad,
	onReportarEvento,
	normas: normasActivas,
	yaAceptoNormas,
	onNormasAceptadas,
	verificarAceptacionNormas,
}: EmployeeCardProps) {
	const {
		id,
		nombre,
		estadoActual,
		registros,
		pausasActivasCount = 0,
	} = empleado;
	const { tieneTemporal } = useHorariosPolicies();

	const { tiempoRestante, handleTerminarDemoPausa, handleIniciarDemoPausa } =
		useActiveBreak(id, onReportarEvento);

	const [novedadModalOpen, setNovedadModalOpen] = useState(false);
	const [formData, setFormData] = useState({
		novedad: '',
		fechaInicio: dayjs().format('YYYY-MM-DD'),
		fechaFin: dayjs().format('YYYY-MM-DD'),
		observaciones: '',
	});
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});

	const [obsModalOpen, setObsModalOpen] = useState(false);
	const [eventoActualObs, setEventoActualObs] = useState<LogType>(
		LOG_TYPE.inicioJornada,
	);
	const [observacionTexto, setObservacionTexto] = useState('');
	const [obsInicialModal, setObsInicialModal] = useState('');

	const [horaModalOpen, setHoraModalOpen] = useState(false);
	const [eventoActualHora, setEventoActualHora] = useState<LogType>(
		LOG_TYPE.inicioJornada,
	);
	const [initialReasonId, setInitialReasonId] = useState<number | null>(null);

	const [eventoModalOpen, setEventoModalOpen] = useState(false);
	const [eventoSeleccionado, setEventoSeleccionado] = useState<EventoTipo | ''>(
		'',
	);
	const [eventoObservaciones, setEventoObservaciones] = useState('');
	const [eventoError, setEventoError] = useState('');
	const [guardandoEvento, setGuardandoEvento] = useState(false);
	const [guardandoRegistro, setGuardandoRegistro] = useState<LogType | null>(
		null,
	);
	const [omitirAlmuerzoModalOpen, setOmitirAlmuerzoModalOpen] = useState(false);
	const [omitiendoAlmuerzo, setOmitiendoAlmuerzo] = useState(false);
	const [almuerzoOmitidoLocal, setAlmuerzoOmitidoLocal] = useState(false);
	const [calendarYear, setCalendarYear] = useState(() => dayjs().year());
	const { data: festivosMap = {} } = useHolidays(calendarYear);
	const [employeeNormasOpen, setEmployeeNormasOpen] = useState(false);
	const [aceptandoNormas, setAceptandoNormas] = useState(false);

	const showAceptarNormasButton =
		tieneTemporal() &&
		!esEmpleadoDemo(id) &&
		!!normasActivas &&
		!yaAceptoNormas;

	// Un botón por marcación del catálogo; está activo si es la siguiente de la jornada.
	const botones: BotonSlot[] = MARCACIONES.map((marcacion) => ({
		marcacion,
		activo: estadoActual === marcacion.habilitadaEn,
		hora: registros[marcacion.key],
	}));

	const novedadActiva = estadoActual === ESTADO.entradaPendiente;
	const finalizado = estadoActual === ESTADO.jornadaFinalizada;
	const pausasAgotadas = pausasActivasCount >= MAX_PAUSAS_ACTIVAS;
	const reporteActivo =
		estadoActual !== ESTADO.entradaPendiente &&
		!finalizado &&
		tiempoRestante === null &&
		!pausasAgotadas;

	const handleOpenNovedadModal = () => {
		setFormData({
			novedad: '',
			fechaInicio: dayjs().format('YYYY-MM-DD'),
			fechaFin: dayjs().format('YYYY-MM-DD'),
			observaciones: '',
		});
		setFormErrors({});
		setNovedadModalOpen(true);
	};
	const handleCloseNovedadModal = () => setNovedadModalOpen(false);

	const handleGuardarNovedad = async () => {
		try {
			setFormErrors({});
			await novedadSchema.validate(formData, { abortEarly: false });
			const success = await onAgregarNovedad({
				empleadoId: id,
				empleadoNombre: nombre,
				tipo: formData.novedad,
				fechaInicio: formData.fechaInicio,
				fechaFin: formData.fechaFin,
				observaciones: formData.observaciones,
				fechaRegistro: dayjs().format('DD/MM/YYYY HH:mm:ss'),
			});
			if (success) {
				onEliminarEmpleado(id);
				handleCloseNovedadModal();
			}
		} catch (err) {
			if (err instanceof yup.ValidationError) {
				const errors: Record<string, string> = {};
				err.inner.forEach((e) => {
					if (e.path) errors[e.path] = e.message;
				});
				setFormErrors(errors);
			}
		}
	};

	const handleOpenEventoModal = () => {
		setEventoSeleccionado(EVENTOS_REPORTABLES[0]);
		setEventoObservaciones('');
		setEventoError('');
		setEventoModalOpen(true);
	};
	const handleCloseEventoModal = () => {
		if (guardandoEvento) return;
		setEventoModalOpen(false);
	};
	const handleGuardarEvento = async () => {
		if (!eventoSeleccionado) {
			setEventoError('Selecciona un evento');
			return;
		}
		setGuardandoEvento(true);
		try {
			const ok = await onReportarEvento(
				id,
				eventoSeleccionado,
				eventoObservaciones,
			);
			if (ok) {
				setEventoModalOpen(false);
				if (eventoSeleccionado === EVENTO.iniciarPausaActiva) {
					handleIniciarDemoPausa();
				}
			}
		} finally {
			setGuardandoEvento(false);
		}
	};

	const handleOpenObsModal = (evento: LogType) => {
		setEventoActualObs(evento);
		const obs = getObservacion(registros, evento);
		setObservacionTexto(obs);
		setObsInicialModal(obs);
		setObsModalOpen(true);
	};
	const handleCloseObsModal = () => {
		setObsModalOpen(false);
		setObservacionTexto('');
		setObsInicialModal('');
	};
	const handleGuardarObservacion = async () => {
		await onGuardarObservacion(id, eventoActualObs, observacionTexto);
		handleCloseObsModal();
	};

	const handleOpenHoraModal = (evento: LogType) => {
		setEventoActualHora(evento);
		setInitialReasonId(null);
		setHoraModalOpen(true);
		const recordId = getRecordIdEvento(registros, evento);
		if (recordId != null) {
			getRecordReasonId(recordId)
				.then(setInitialReasonId)
				.catch(() => setInitialReasonId(null));
		}
	};

	const [verificationModalOpen, setVerificationModalOpen] = useState(false);
	const [pendingEvento, setPendingEvento] = useState<LogType | null>(null);

	// Orden al marcar:
	// 1. Empleado demo o eventos sin verificación (almuerzos) → registrar directamente sin cámara ni GPS.
	// 2. "Comenzar Jornada" → validar normas → modal de foto + GPS → registrar.
	// 3. "Terminar Jornada" → modal de foto + GPS → registrar.
	const handleRegistrarEvento = async (tipoEvento: LogType) => {
		if (esEmpleadoDemo(id)) {
			void registrarMarcacion(tipoEvento);
			return;
		}

		if (!requiereVerificacion(tipoEvento)) {
			void registrarMarcacion(tipoEvento);
			return;
		}

		setPendingEvento(tipoEvento);
		if (tipoEvento === LOG_TYPE.inicioJornada && normasActivas) {
			// Se pregunta a Directus en el momento (no a la caché ni solo con `temporal`):
			// así una aceptación borrada o hecha en otro dispositivo se refleja enseguida.
			setGuardandoRegistro(tipoEvento);
			const acepto = await verificarAceptacionNormas(id);
			setGuardandoRegistro(null);
			if (!acepto) {
				setEmployeeNormasOpen(true);
				return;
			}
		}
		setVerificationModalOpen(true);
	};

	const handleConfirmVerification = async (data: VerificationData) => {
		if (!pendingEvento) return;
		await registrarMarcacion(pendingEvento, {
			latitude: data.latitude,
			longitude: data.longitude,
			accuracy: data.accuracy,
			photo: data.photo,
		});
	};

	const registrarMarcacion = async (
		tipoEvento: LogType,
		metadata?: VerificationData,
	) => {
		setGuardandoRegistro(tipoEvento);
		try {
			await onRegistrarEvento(
				id,
				tipoEvento,
				undefined,
				undefined,
				null,
				metadata,
			);
		} finally {
			setGuardandoRegistro(null);
			setPendingEvento(null);
		}
	};

	const handleAceptarNormasEmpleado = async () => {
		if (!normasActivas) return;
		setAceptandoNormas(true);
		try {
			await registrarAceptacionNormasEmpleado(
				Number(id),
				normasActivas.version,
				normasActivas.id,
			);
			setEmployeeNormasOpen(false);
			onNormasAceptadas(id);
			if (pendingEvento) setVerificationModalOpen(true);
		} catch (e) {
			console.error('Error al registrar aceptación de normas del empleado:', e);
		} finally {
			setAceptandoNormas(false);
		}
	};

	const handleConfirmarSinAlmuerzo = async () => {
		setOmitiendoAlmuerzo(true);
		try {
			await onRegistrarEvento(id, LOG_TYPE.inicioAlmuerzo);
			await onRegistrarEvento(id, LOG_TYPE.finAlmuerzo);
			setAlmuerzoOmitidoLocal(true);
			setOmitirAlmuerzoModalOpen(false);
		} finally {
			setOmitiendoAlmuerzo(false);
		}
	};

	return (
		<>
			<Card
				className="tour-employee-card"
				sx={{
					width: '100%',
					borderRadius: 3,
					overflow: 'hidden',
					boxShadow: finalizado ? 'none' : '0 4px 12px rgba(0,0,0,0.04)',
					border: '1px solid #e2e8f0',
					bgcolor: '#ffffff',
				}}
			>
				<EmployeeCardHeader
					empleado={empleado}
					estadoActual={estadoActual}
					pausasActivasCount={pausasActivasCount}
					pausasAgotadas={pausasAgotadas}
					novedadActiva={novedadActiva}
					reporteActivo={reporteActivo}
					finalizado={finalizado}
					showAceptarNormasButton={showAceptarNormasButton}
					maxPausas={MAX_PAUSAS_ACTIVAS}
					onOpenNovedadModal={handleOpenNovedadModal}
					onOpenEventoModal={handleOpenEventoModal}
					onOpenEmployeeNormasModal={() => setEmployeeNormasOpen(true)}
				/>

				<EmployeeCardTimeSlots
					idEmpleado={id}
					tiempoRestante={tiempoRestante}
					finalizado={finalizado}
					almuerzoOmitidoLocal={almuerzoOmitidoLocal}
					guardandoRegistro={guardandoRegistro}
					botones={botones}
					getObservacion={(evento) => getObservacion(registros, evento)}
					getEditadoStatus={(evento) => getEditadoStatus(registros, evento)}
					onOpenHoraModal={handleOpenHoraModal}
					onRegistrarEvento={handleRegistrarEvento}
					onOpenObsModal={handleOpenObsModal}
					onOpenOmitirAlmuerzoModal={() => setOmitirAlmuerzoModalOpen(true)}
					onTerminarDemoPausa={handleTerminarDemoPausa}
				/>
			</Card>

			<EditHourModal
				open={horaModalOpen}
				onClose={() => setHoraModalOpen(false)}
				employeeName={nombre}
				eventName={eventoActualHora}
				initialTimeStr={getHoraEvento(registros, eventoActualHora)}
				initialObservation={getObservacion(registros, eventoActualHora)}
				reasons={reasons}
				initialReasonId={initialReasonId}
				registros={registros}
				onConfirm={async (horaFormateada, observacion, reasonId) => {
					await onRegistrarEvento(
						id,
						eventoActualHora,
						horaFormateada,
						observacion,
						reasonId,
					);
				}}
			/>

			<NormasModal
				open={employeeNormasOpen}
				normas={normasActivas}
				obligatorio={true}
				aceptando={aceptandoNormas}
				titleOverride={`Normativa de Registro de Horarios — ${nombre}`}
				onClose={() => {
					setEmployeeNormasOpen(false);
					setPendingEvento(null);
				}}
				onAceptar={handleAceptarNormasEmpleado}
			/>

			<EmployeeCardObsModal
				open={obsModalOpen}
				onClose={handleCloseObsModal}
				eventoActualObs={eventoActualObs}
				nombre={nombre}
				maxLength={MAX_CARACTERES_OBSERVACION}
				observacionTexto={observacionTexto}
				setObservacionTexto={setObservacionTexto}
				obsInicialModal={obsInicialModal}
				onGuardar={handleGuardarObservacion}
			/>

			<EmployeeCardNovedadModal
				open={novedadModalOpen}
				onClose={handleCloseNovedadModal}
				formData={formData}
				setFormData={setFormData}
				formErrors={formErrors}
				tiposNovedad={tiposNovedad}
				festivosMap={festivosMap}
				calendarYear={calendarYear}
				setCalendarYear={setCalendarYear}
				onGuardar={handleGuardarNovedad}
			/>

			<EmployeeCardEventoModal
				open={eventoModalOpen}
				onClose={handleCloseEventoModal}
				nombre={nombre}
				eventoSeleccionado={eventoSeleccionado}
				setEventoSeleccionado={setEventoSeleccionado}
				eventoError={eventoError}
				setEventoError={setEventoError}
				eventoObservaciones={eventoObservaciones}
				setEventoObservaciones={setEventoObservaciones}
				guardandoEvento={guardandoEvento}
				onGuardar={handleGuardarEvento}
			/>

			<EmployeeCardOmitirAlmuerzoModal
				open={omitirAlmuerzoModalOpen}
				onClose={() => setOmitirAlmuerzoModalOpen(false)}
				nombre={nombre}
				omitiendoAlmuerzo={omitiendoAlmuerzo}
				onConfirmar={handleConfirmarSinAlmuerzo}
			/>
			<TimeRecordVerificationModal
				open={verificationModalOpen}
				onClose={() => {
					setVerificationModalOpen(false);
					setPendingEvento(null);
				}}
				employeeName={nombre}
				eventName={pendingEvento || ''}
				onConfirm={handleConfirmVerification}
			/>
		</>
	);
}
