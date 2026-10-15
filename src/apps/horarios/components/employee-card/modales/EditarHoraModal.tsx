import { useEffect, useState } from 'react';
import { keyPorLogType, type LogType } from '../../../domain/registro';
import type { Resultado } from '../../../interfaces/comunes';
import type {
	Motivo,
	RegistrosAsistencia,
} from '../../../interfaces/horarios.interface';
import EditHourModal from '../../EditHourModal';

interface EditarHoraModalProps {
	open: boolean;
	onClose: () => void;
	nombre: string;
	marcacion: LogType;
	registros: RegistrosAsistencia;
	motivos: Motivo[];
	/** Motivo ya guardado de esta marcación (se precarga en el selector). */
	cargarMotivo: () => Promise<number | null>;
	onGuardar: (input: {
		hora: string;
		observacion: string;
		motivoId: number | null;
	}) => Promise<Resultado>;
}

/** Adaptador de la tarjeta sobre EditHourModal (compartido con Monitoreo y Planilla). */
export function EditarHoraModal({
	open,
	onClose,
	nombre,
	marcacion,
	registros,
	motivos,
	cargarMotivo,
	onGuardar,
}: EditarHoraModalProps) {
	const [motivoInicial, setMotivoInicial] = useState<number | null>(null);

	// Se monta con `key` en cada apertura: el motivo se pide una vez por apertura.
	// biome-ignore lint/correctness/useExhaustiveDependencies: solo al montar
	useEffect(() => {
		let vigente = true;
		cargarMotivo()
			.then((id) => vigente && setMotivoInicial(id))
			.catch(() => vigente && setMotivoInicial(null));
		return () => {
			vigente = false;
		};
	}, []);

	const key = keyPorLogType(marcacion);

	return (
		<EditHourModal
			open={open}
			onClose={onClose}
			employeeName={nombre}
			eventName={marcacion}
			initialTimeStr={key ? registros[key] : null}
			initialObservation={(key && registros.observaciones[key]) || ''}
			reasons={motivos}
			initialReasonId={motivoInicial}
			registros={registros}
			onConfirm={async (hora, observacion, motivoId) => {
				// EditHourModal se queda abierto si onConfirm lanza.
				const resultado = await onGuardar({ hora, observacion, motivoId });
				if (!resultado.ok) throw new Error(resultado.error);
			}}
		/>
	);
}
