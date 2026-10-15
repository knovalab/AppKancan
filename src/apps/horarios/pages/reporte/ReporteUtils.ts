import dayjs from 'dayjs';

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

// Movida a utils/horasTrabajadas (la usan utils/ y páginas); se reexporta aquí.
export { calcularMinutosSemanales } from '../../utils/horasTrabajadas';

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

