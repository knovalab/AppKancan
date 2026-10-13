import dayjs from 'dayjs';
import { LOG_TYPE } from '../../domain/registro';

export const calcularMinutosDia = (records: any[], empleadoId: string | number): number => {
  const empRecords = records.filter(r => Number(r.employee_id?.id || r.employee_id) === Number(empleadoId));
  const entrada = empRecords.find(r => r.log_type === LOG_TYPE.inicioJornada);
  const salida = empRecords.find(r => r.log_type === LOG_TYPE.finJornada);
  if (!entrada || !salida) return 0;
  const inicio = dayjs(`2000-01-01 ${entrada.record_time.substring(0,5)}`);
  const fin = dayjs(`2000-01-01 ${salida.record_time.substring(0,5)}`);
  return fin.diff(inicio, 'minute');
};

export const formatearHoras = (minutosTotal: number): string => {
  if (minutosTotal <= 0) return '0h';
  const h = Math.floor(minutosTotal / 60);
  const m = minutosTotal % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};
