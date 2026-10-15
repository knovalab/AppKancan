import dayjs from 'dayjs';
import * as yup from 'yup';
import { MAX_CARACTERES_OBSERVACION } from '../../../domain/registro';

export interface NovedadFormValues {
	novedad: string;
	fechaInicio: string;
	fechaFin: string;
	observaciones: string;
}

export const novedadSchema = yup.object().shape({
	novedad: yup.string().required('El tipo de novedad es obligatorio'),
	fechaInicio: yup.string().required('La fecha de inicio es obligatoria'),
	fechaFin: yup
		.string()
		.required('La fecha de fin es obligatoria')
		.test(
			'is-after-or-equal',
			'La fecha fin debe ser igual o posterior a la de inicio',
			function (value) {
				const { fechaInicio } = this.parent;
				if (!fechaInicio || !value) return true;
				return (
					dayjs(value).isSame(dayjs(fechaInicio), 'day') ||
					dayjs(value).isAfter(dayjs(fechaInicio), 'day')
				);
			},
		),
	observaciones: yup
		.string()
		.max(
			MAX_CARACTERES_OBSERVACION,
			`Máximo ${MAX_CARACTERES_OBSERVACION} caracteres`,
		),
});

/** Errores de yup → { campo: mensaje }. */
export function erroresDeValidacion(
	err: unknown,
): Record<string, string> | null {
	if (!(err instanceof yup.ValidationError)) return null;
	const errores: Record<string, string> = {};
	for (const e of err.inner) if (e.path) errores[e.path] = e.message;
	return errores;
}
