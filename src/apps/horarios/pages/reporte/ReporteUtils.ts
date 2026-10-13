import dayjs from 'dayjs';
import { LOG_TYPE } from '../../domain/registro';

export const AVATAR_COLORS = [
  '#0284c7', '#7c3aed', '#16a34a', '#ea580c', '#db2777',
  '#0891b2', '#4f46e5', '#ca8a04', '#dc2626', '#059669',
  '#2563eb', '#9333ea',
];

export const getAvatarColor = (texto: string) => {
  const str = String(texto || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const DIAS_DE_LA_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export function getSemanasDelMes(
  anio: number,
  mes: number,
  diaInicio: number = 1,
  diaFin: number = 0
) {
  const startOfMonth = dayjs().year(anio).month(mes).startOf('month');
  const endOfMonth = startOfMonth.endOf('month');

  let diff = startOfMonth.day() - diaInicio;
  if (diff < 0) diff += 7;
  let currentStart = startOfMonth.subtract(diff, 'day');

  let daysSpan = diaFin - diaInicio;
  if (diaInicio === diaFin) {
    daysSpan = 6;
  } else if (daysSpan < 0) {
    daysSpan += 7;
  }

  const semanas = [];
  while (currentStart.isBefore(endOfMonth) || currentStart.isSame(endOfMonth, 'day')) {
    const currentEnd = currentStart.add(daysSpan, 'day');
    semanas.push({
      start: currentStart.format('YYYY-MM-DD'),
      end: currentEnd.format('YYYY-MM-DD'),
      label: `${currentStart.format('DD-MM-YYYY')} - ${currentEnd.format('DD-MM-YYYY')}`
    });
    currentStart = currentStart.add(7, 'day');
  }
  return semanas;
}

export const calcularMinutosSemanales = (empId: any, startStr: string, endStr: string, records: any[]): number => {
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
                    let totalDia = (c * 60 + d) - (a * 60 + b);
                    if (totalDia < 0) totalDia = 0;

                    if (iniAlmuerzo && finAlmuerzo) {
                        const ha1 = iniAlmuerzo.record_time || iniAlmuerzo.time;
                        const ha2 = finAlmuerzo.record_time || finAlmuerzo.time;
                        if (ha1 && ha2) {
                            const [al1, al2] = ha1.split(':').map(Number);
                            const [al3, al4] = ha2.split(':').map(Number);
                            if (!isNaN(al1) && !isNaN(al2) && !isNaN(al3) && !isNaN(al4)) {
                                const almuerzoMinutos = (al3 * 60 + al4) - (al1 * 60 + al2);
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

export const formatMinutes = (totalMin: number): string => {
    if (totalMin <= 0) return '0h 0m';
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hours}h ${mins}m`;
};

export const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

