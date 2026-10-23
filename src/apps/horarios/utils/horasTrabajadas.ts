/**
 * Cálculo de minutos trabajados a partir de las marcaciones (`com_time_records`).
 * Antes vivían en ModalDetalleTiendaUtils y ReporteUtils; se movieron aquí para que
 * utils/exportarSemanal no dependa de componentes ni páginas. Copiadas sin cambios.
 */
import { LOG_TYPE } from '../domain/registro';

export const calcularMinutosDia = (
	records: any[],
	empId: string | number,
): number => {
	const r = records.filter(
		(r) => Number(r.employee_id?.id || r.employee_id) === Number(empId),
	);
	if (r.length === 0) return 0;
	const entrada = r.find((r) => r.log_type === LOG_TYPE.inicioJornada);
	const salida = r.find((r) => r.log_type === LOG_TYPE.finJornada);
	if (!entrada || !salida) return 0;
	const h1 = entrada.record_time || entrada.time;
	const h2 = salida.record_time || salida.time;
	if (!h1 || !h2) return 0;
	const [a, b] = h1.split(':').map(Number);
	const [c, d] = h2.split(':').map(Number);
	if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) return 0;

	let totalJornada = c * 60 + d - (a * 60 + b);
	if (totalJornada < 0) totalJornada = 0;

	// Restar el tiempo de almuerzo si ambos registros existen
	const iniAlmuerzo = r.find((r) => r.log_type === LOG_TYPE.inicioAlmuerzo);
	const finAlmuerzo = r.find((r) => r.log_type === LOG_TYPE.finAlmuerzo);
	if (iniAlmuerzo && finAlmuerzo) {
		const ha1 = iniAlmuerzo.record_time || iniAlmuerzo.time;
		const ha2 = finAlmuerzo.record_time || finAlmuerzo.time;
		if (ha1 && ha2) {
			const [al1, al2] = ha1.split(':').map(Number);
			const [al3, al4] = ha2.split(':').map(Number);
			if (!isNaN(al1) && !isNaN(al2) && !isNaN(al3) && !isNaN(al4)) {
				const almuerzoMinutos = al3 * 60 + al4 - (al1 * 60 + al2);
				if (almuerzoMinutos > 0) {
					totalJornada -= almuerzoMinutos;
				}
			}
		}
	}

	return totalJornada < 0 ? 0 : totalJornada;
};

export const calcularMinutosSemanales = (
	empId: any,
	startStr: string,
	endStr: string,
	records: any[],
): number => {
	if (!empId || !records || records.length === 0) return 0;
	const numericEmpId = Number(empId);

	const byDay: Record<string, any[]> = {};
	let count = 0;

	for (let i = 0; i < records.length; i++) {
		const r = records[i];
		const id = Number(r.employee_id?.id || r.employee_id);
		if (id !== numericEmpId) continue;
		const dateStr = r.record_date;
		if (!dateStr || dateStr < startStr || dateStr > endStr) continue;

		(byDay[dateStr] ||= []).push(r);
		count++;
	}

	if (count === 0) return 0;

	let totalMinutes = 0;
	for (const date in byDay) {
		const recs = byDay[date];
		let entrada: any = null;
		let salida: any = null;
		let iniAlmuerzo: any = null;
		let finAlmuerzo: any = null;

		for (let j = 0; j < recs.length; j++) {
			const type = recs[j].log_type;
			if (type === LOG_TYPE.inicioJornada) entrada = recs[j];
			else if (type === LOG_TYPE.finJornada) salida = recs[j];
			else if (type === LOG_TYPE.inicioAlmuerzo) iniAlmuerzo = recs[j];
			else if (type === LOG_TYPE.finAlmuerzo) finAlmuerzo = recs[j];
		}

		if (entrada && salida) {
			const h1 = entrada.record_time || entrada.time;
			const h2 = salida.record_time || salida.time;
			if (h1 && h2) {
				const [a, b] = h1.split(':').map(Number);
				const [c, d] = h2.split(':').map(Number);
				if (!isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(d)) {
					let totalDia = c * 60 + d - (a * 60 + b);
					if (totalDia < 0) totalDia = 0;

					if (iniAlmuerzo && finAlmuerzo) {
						const ha1 = iniAlmuerzo.record_time || iniAlmuerzo.time;
						const ha2 = finAlmuerzo.record_time || finAlmuerzo.time;
						if (ha1 && ha2) {
							const [al1, al2] = ha1.split(':').map(Number);
							const [al3, al4] = ha2.split(':').map(Number);
							if (!isNaN(al1) && !isNaN(al2) && !isNaN(al3) && !isNaN(al4)) {
								const almuerzoMinutos = al3 * 60 + al4 - (al1 * 60 + al2);
								if (almuerzoMinutos > 0) {
									totalDia -= almuerzoMinutos;
								}
							}
						}
					}
					if (totalDia > 0) {
						totalMinutes += totalDia;
					}
				}
			}
		}
	}
	return totalMinutes;
};
