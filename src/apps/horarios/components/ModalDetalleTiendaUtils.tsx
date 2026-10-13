import {
    LocalHospital as LocalHospitalIcon,
    BeachAccess as BeachAccessIcon,
    EventAvailable as EventAvailableIcon,
    ReportProblem as ReportProblemIcon,
    FlightTakeoff as FlightTakeoffIcon,
    WarningAmber as WarningAmberIcon,
    FamilyRestroom as FamilyRestroomIcon,
    School as SchoolIcon,
    Gavel as GavelIcon,
    Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { LOG_TYPE } from '../domain/registro';

export type EstadoDia = 'completo' | 'parcial' | 'sin_registro' | 'tienda_cerrada';

export interface EmpleadoFila {
    id: string;
    nombre: string;
    documento: string;
    cargo: string;
    inicioJornada: string | null;
    inicioAlmuerzo: string | null;
    finAlmuerzo: string | null;
    finJornada: string | null;
    estado: string;
    tieneNovedad: boolean;
    novedadTipo?: string;
    novedadObservacion?: string;
    novedadId?: string;
    horasDia: string;
    horasSemana: string;
}

export const getNovedadIcon = (tipo: string): JSX.Element => {
    const map: { [key: string]: JSX.Element } = {
        incapacidad: <LocalHospitalIcon sx={{ color: '#d32f2f' }} />,
        vacaciones: <BeachAccessIcon sx={{ color: '#1976d2' }} />,
        permiso: <EventAvailableIcon sx={{ color: '#2e7d32' }} />,
        ausencia: <ReportProblemIcon sx={{ color: '#d32f2f' }} />,
        retiro: <FlightTakeoffIcon sx={{ color: '#757575' }} />,
        calamidad: <WarningAmberIcon sx={{ color: '#ed6c02' }} />,
        'dia de la familia': <FamilyRestroomIcon sx={{ color: '#9c27b0' }} />,
        capacitación: <SchoolIcon sx={{ color: '#0288d1' }} />,
        suspensión: <GavelIcon sx={{ color: '#424242' }} />,
        descanso: <AssignmentIcon sx={{ color: '#00897b' }} />,
    };
    const key = Object.keys(map).find(k => tipo.toLowerCase().includes(k));
    return key ? map[key] : <AssignmentIcon sx={{ color: '#004680' }} />;
};

export const calcularMinutosDia = (records: any[], empId: string | number): number => {
    const r = records.filter(r => Number(r.employee_id?.id || r.employee_id) === Number(empId));
    if (r.length === 0) return 0;
    const entrada = r.find(r => r.log_type === LOG_TYPE.inicioJornada);
    const salida = r.find(r => r.log_type === LOG_TYPE.finJornada);
    if (!entrada || !salida) return 0;
    const h1 = entrada.record_time || entrada.time;
    const h2 = salida.record_time || salida.time;
    if (!h1 || !h2) return 0;
    const [a, b] = h1.split(':').map(Number);
    const [c, d] = h2.split(':').map(Number);
    if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) return 0;
    
    let totalJornada = (c * 60 + d) - (a * 60 + b);
    if (totalJornada < 0) totalJornada = 0;

    // Restar el tiempo de almuerzo si ambos registros existen
    const iniAlmuerzo = r.find(r => r.log_type === LOG_TYPE.inicioAlmuerzo);
    const finAlmuerzo = r.find(r => r.log_type === LOG_TYPE.finAlmuerzo);
    if (iniAlmuerzo && finAlmuerzo) {
        const ha1 = iniAlmuerzo.record_time || iniAlmuerzo.time;
        const ha2 = finAlmuerzo.record_time || finAlmuerzo.time;
        if (ha1 && ha2) {
            const [al1, al2] = ha1.split(':').map(Number);
            const [al3, al4] = ha2.split(':').map(Number);
            if (!isNaN(al1) && !isNaN(al2) && !isNaN(al3) && !isNaN(al4)) {
                const almuerzoMinutos = (al3 * 60 + al4) - (al1 * 60 + al2);
                if (almuerzoMinutos > 0) {
                    totalJornada -= almuerzoMinutos;
                }
            }
        }
    }

    return totalJornada < 0 ? 0 : totalJornada;
};

export const formatearHoras = (min: number): string =>
    min === 0 ? '0h 0m' : `${Math.floor(min / 60)}h ${min % 60}m`;

export const calcularHorasSemana = (empId: string | number, records: any[]): string => {
    const empRecords = records.filter(r => Number(r.employee_id?.id || r.employee_id) === Number(empId));
    if (empRecords.length === 0) return '0h 0m';
    const byDay: Record<string, any[]> = {};
    empRecords.forEach(r => { (byDay[r.record_date] ||= []).push(r); });
    let total = 0;
    for (const date in byDay) {
        const recs = byDay[date];
        const entrada = recs.find(r => r.log_type === LOG_TYPE.inicioJornada);
        const salida = recs.find(r => r.log_type === LOG_TYPE.finJornada);
        if (entrada && salida) {
            const h1 = entrada.record_time || entrada.time;
            const h2 = salida.record_time || salida.time;
            if (h1 && h2) {
                const [a, b] = h1.split(':').map(Number);
                const [c, d] = h2.split(':').map(Number);
                if (!isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(d)) {
                    let totalDia = (c * 60 + d) - (a * 60 + b);
                    if (totalDia < 0) totalDia = 0;

                    // Restar almuerzo diario
                    const iniAlmuerzo = recs.find(r => r.log_type === LOG_TYPE.inicioAlmuerzo);
                    const finAlmuerzo = recs.find(r => r.log_type === LOG_TYPE.finAlmuerzo);
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
                        total += totalDia;
                    }
                }
            }
        }
    }
    return formatearHoras(total);
};
