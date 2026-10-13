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
import { EmployeeCardTimeSlots } from './employee-card/EmployeeCardTimeSlots';
import {
	EVENTOS_PAUSA,
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
	VerificationData,
} from './TimeRecordVerificationModal';

interface EmployeeCardProps {
	empleado: EmpleadoAsistencia;
	tiposNovedad: { id: number; name?: string; nombre?: string }[];
	reasons: Motivo[];
	onRegistrarEvento: (
		idEmpleado: string,
		tipoEvento: string,
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
		evento: string,
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
	}) => Promise<boolean> | boolean | any;
	onReportarEvento: (
		idEmpleado: string,
		eventType: string,
		observaciones?: string,
	) => Promise<boolean> | boolean | any;
	/** Normas vigentes y estado de aceptación: los resuelve la página en una sola consulta. */
	normas: Normas | null;
	yaAceptoNormas: boolean;
	onNormasAceptadas: (idEmpleado: string) => void;
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
	const [eventoActualObs, setEventoActualObs] = useState('');
	const [observacionTexto, setObservacionTexto] = useState('');
	const [obsInicialModal, setObsInicialModal] = useState('');

	const [horaModalOpen, setHoraModalOpen] = useState(false);
	const [eventoActualHora, setEventoActualHora] = useState('');
	const [initialReasonId, setInitialReasonId] = useState<number | null>(null);

	const [eventoModalOpen, setEventoModalOpen] = useState(false);
	const [eventoSeleccionado, setEventoSeleccionado] = useState('');
	const [eventoObservaciones, setEventoObservaciones] = useState('');
	const [eventoError, setEventoError] = useState('');
	const [guardandoEvento, setGuardandoEvento] = useState(false);
	const [guardandoRegistro, setGuardandoRegistro] = useState<string | null>(
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
		String(id) !== '99999' &&
		!!normasActivas &&
		!yaAceptoNormas;

	const botones = [
		{
			etiqueta: 'Comenzar Jornada',
			activo: estadoActual === 'entrada_pendiente',
			hora: registros.inicioJornada,
		},
		{
			etiqueta: 'Iniciar Almuerzo',
			activo: estadoActual === 'jornada_iniciada',
			hora: registros.inicioAlmuerzo,
		},
		{
			etiqueta: 'Finalizar Almuerzo',
			activo: estadoActual === 'en_almuerzo',
			hora: registros.finAlmuerzo,
		},
		{
			etiqueta: 'Terminar Jornada',
			activo: estadoActual === 'regreso_almuerzo',
			hora: registros.finJornada,
		},
	];

	const MAX_PAUSAS = 2;
	const novedadActiva = estadoActual === 'entrada_pendiente';
	const finalizado = estadoActual === 'jornada_finalizada';
	const pausasAgotadas = pausasActivasCount >= MAX_PAUSAS;
	const reporteActivo =
		estadoActual !== 'entrada_pendiente' &&
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
		} catch (err: any) {
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
		setEventoSeleccionado(EVENTOS_PAUSA[0]);
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
				if (eventoSeleccionado === 'Iniciar Pausa Activa') {
					handleIniciarDemoPausa();
				}
			}
		} finally {
			setGuardandoEvento(false);
		}
	};

	const handleOpenObsModal = (evento: string) => {
		setEventoActualObs(evento);
		const obs = getObservacion(registros, evento);
		setObservacionTexto(obs);
		setObsInicialModal(obs);
		setObsModalOpen(true);
	};
	const handleCloseObsModal = () => {
		setObsModalOpen(false);
		setObservacionTexto('');
		setEventoActualObs('');
		setObsInicialModal('');
	};
	const handleGuardarObservacion = async () => {
		await onGuardarObservacion(id, eventoActualObs, observacionTexto);
		handleCloseObsModal();
	};

	const handleOpenHoraModal = (evento: string) => {
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
	const [pendingEvento, setPendingEvento] = useState<string | null>(null);

	const handleRegistrarEvento = (tipoEvento: string) => {
		setPendingEvento(tipoEvento);
		setVerificationModalOpen(true);
	};

	const handleConfirmVerification = async (data: VerificationData) => {
		if (!pendingEvento) return;
		const tipoEvento = pendingEvento;
		setGuardandoRegistro(tipoEvento);
		try {
			// yaAceptoNormas ya viene de la consulta de la página: no se vuelve a preguntar.
			await onRegistrarEvento(id, tipoEvento, undefined, undefined, null, {
				latitude: data.latitude,
				longitude: data.longitude,
				accuracy: data.accuracy,
				photo: data.photo,
			});
			if (
				tipoEvento === 'Comenzar Jornada' &&
				normasActivas &&
				String(id) !== '99999' &&
				!yaAceptoNormas
			) {
				setTimeout(() => {
					setEmployeeNormasOpen(true);
				}, 2000);
			}
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
		} catch (e) {
			console.error('Error al registrar aceptación de normas del empleado:', e);
		} finally {
			setAceptandoNormas(false);
		}
	};

	const handleConfirmarSinAlmuerzo = async () => {
		setOmitiendoAlmuerzo(true);
		try {
			await onRegistrarEvento(id, 'Iniciar Almuerzo');
			await onRegistrarEvento(id, 'Finalizar Almuerzo');
			setAlmuerzoOmitidoLocal(true);
			setOmitirAlmuerzoModalOpen(false);
		} finally {
			setOmitiendoAlmuerzo(false);
		}
	};

	const maxLength = 300;

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
					maxPausas={MAX_PAUSAS}
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
				onClose={() => setEmployeeNormasOpen(false)}
				onAceptar={handleAceptarNormasEmpleado}
			/>

			<EmployeeCardObsModal
				open={obsModalOpen}
				onClose={handleCloseObsModal}
				eventoActualObs={eventoActualObs}
				nombre={nombre}
				maxLength={maxLength}
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
