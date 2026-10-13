import { type ReactElement, useState, useEffect, useRef } from 'react';
import { Typography, Tooltip } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DiningIcon from '@mui/icons-material/Dining';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import dayjs from 'dayjs';
import * as yup from 'yup';
import {
  DURACION_PAUSA_ACTIVA_MS,
  esEmpleadoDemo,
  EVENTO,
  type EventoTipo,
  keyPorLogType,
  type LogType,
  MAX_CARACTERES_OBSERVACION,
  type MarcacionKey,
} from '../../domain/registro';
import type { RegistrosAsistencia } from '../../interfaces/horarios.interface';
import { formatTo12Hour } from '../../utils/format';

/** Icono del botón de cada marcación. */
const ICONO_MARCACION: Record<MarcacionKey, ReactElement> = {
  inicioJornada: <PlayArrowIcon fontSize="small" />,
  inicioAlmuerzo: <RestaurantIcon fontSize="small" />,
  finAlmuerzo: <DiningIcon fontSize="small" />,
  finJornada: <ExitToAppIcon fontSize="small" />,
};

export const getIcon = (logType: LogType): ReactElement | null => {
  const key = keyPorLogType(logType);
  return key ? ICONO_MARCACION[key] : null;
};

// Reexportado para no romper los imports existentes; la implementación vive en utils/format.
export { formatTo12Hour };

export function NombreEmpleado({ nombre }: { nombre: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncado, setTruncado] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setTruncado(el.scrollWidth > el.clientWidth);
  }, [nombre]);

  const texto = (
    <Typography
      ref={ref}
      noWrap
      sx={{ fontWeight: 700, fontSize: '1rem', textTransform: 'capitalize', lineHeight: 1.2 }}
    >
      {nombre}
    </Typography>
  );

  return truncado ? (
    <Tooltip
      title={nombre}
      arrow
      placement="top"
      enterTouchDelay={0}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: '#EAF2FB',
            color: '#0f2c4a',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.2px',
            textTransform: 'capitalize',
            px: 1.5,
            py: 0.875,
            borderRadius: 2,
            border: '1px solid #d6e6f7',
            boxShadow: '0 8px 24px rgba(0, 70, 128, 0.18)',
          },
        },
        arrow: { sx: { color: '#EAF2FB', '&::before': { border: '1px solid #d6e6f7' } } },
      }}
    >
      {texto}
    </Tooltip>
  ) : (
    texto
  );
}

export const novedadSchema = yup.object().shape({
  novedad: yup.string().required('El tipo de novedad es obligatorio'),
  fechaInicio: yup.string().required('La fecha de inicio es obligatoria'),
  fechaFin: yup.string().required('La fecha de fin es obligatoria')
    .test('is-after-or-equal', 'La fecha fin debe ser igual o posterior a la de inicio', function (value) {
      const { fechaInicio } = this.parent;
      if (!fechaInicio || !value) return true;
      return dayjs(value).isSame(dayjs(fechaInicio), 'day') || dayjs(value).isAfter(dayjs(fechaInicio), 'day');
    }),
  observaciones: yup.string().max(MAX_CARACTERES_OBSERVACION, `Máximo ${MAX_CARACTERES_OBSERVACION} caracteres`)
});

// Lecturas de RegistrosAsistencia por log_type (antes, un switch por función).

export const getObservacion = (registros: RegistrosAsistencia | undefined, logType: LogType): string => {
  const key = keyPorLogType(logType);
  return (key && registros?.observaciones[key]) || '';
};

export const getHoraEvento = (registros: RegistrosAsistencia | undefined, logType: LogType): string | null => {
  const key = keyPorLogType(logType);
  return key && registros ? registros[key] : null;
};

export const getEditadoStatus = (registros: RegistrosAsistencia | undefined, logType: LogType): boolean => {
  const key = keyPorLogType(logType);
  return !!(key && registros?.horasOriginales[key]);
};

export const getRecordIdEvento = (registros: RegistrosAsistencia | undefined, logType: LogType): number | undefined => {
  const key = keyPorLogType(logType);
  return key ? registros?.ids[key] : undefined;
};

// Temporizador de la pausa del empleado demo: en memoria, no en localStorage.
const demoWindow = window as Window & { __demoActiveBreakExpires?: string };

export function useActiveBreak(id: string, onReportarEvento: (idEmpleado: string, eventType: EventoTipo) => void) {
  const [tiempoRestante, setTiempoRestante] = useState<number | null>(null);

  useEffect(() => {
    const checkActiveBreak = () => {
      let expirationStr;
      if (esEmpleadoDemo(id)) {
        expirationStr = demoWindow.__demoActiveBreakExpires;
      } else {
        expirationStr = localStorage.getItem(`activeBreakExpires_${id}`);
      }

      if (expirationStr) {
        const expirationTime = parseInt(expirationStr, 10);
        const now = Date.now();
        const diff = Math.ceil((expirationTime - now) / 1000);
        if (diff > 0) {
          setTiempoRestante(diff);
        } else {
          if (esEmpleadoDemo(id)) delete demoWindow.__demoActiveBreakExpires;
          else localStorage.removeItem(`activeBreakExpires_${id}`);
          setTiempoRestante(null);
          onReportarEvento(id, EVENTO.terminarPausaActiva);
        }
      }
    };

    checkActiveBreak();
    window.addEventListener('storage', checkActiveBreak);
    return () => window.removeEventListener('storage', checkActiveBreak);
  }, [id, onReportarEvento]);

  useEffect(() => {
    if (tiempoRestante === null) return;

    if (tiempoRestante <= 0) {
      if (esEmpleadoDemo(id)) delete demoWindow.__demoActiveBreakExpires;
      else localStorage.removeItem(`activeBreakExpires_${id}`);
      setTiempoRestante(null);
      onReportarEvento(id, EVENTO.terminarPausaActiva);
      return;
    }

    const interval = setInterval(() => {
      let expirationStr;
      if (esEmpleadoDemo(id)) {
        expirationStr = demoWindow.__demoActiveBreakExpires;
      } else {
        expirationStr = localStorage.getItem(`activeBreakExpires_${id}`);
      }

      if (expirationStr) {
        const expirationTime = parseInt(expirationStr, 10);
        const now = Date.now();
        const diff = Math.ceil((expirationTime - now) / 1000);
        if (diff > 0) {
          setTiempoRestante(diff);
        } else {
          clearInterval(interval);
          if (esEmpleadoDemo(id)) delete demoWindow.__demoActiveBreakExpires;
          else localStorage.removeItem(`activeBreakExpires_${id}`);
          setTiempoRestante(null);
          onReportarEvento(id, EVENTO.terminarPausaActiva);
        }
      } else {
        clearInterval(interval);
        setTiempoRestante(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tiempoRestante, id, onReportarEvento]);

  const handleTerminarDemoPausa = () => {
    if (esEmpleadoDemo(id)) {
      delete demoWindow.__demoActiveBreakExpires;
    } else {
      localStorage.removeItem(`activeBreakExpires_${id}`);
    }
    setTiempoRestante(null);
    onReportarEvento(id, EVENTO.terminarPausaActiva);
  };

  const handleIniciarDemoPausa = () => {
    const expirationTime = Date.now() + DURACION_PAUSA_ACTIVA_MS;
    if (esEmpleadoDemo(id)) {
      demoWindow.__demoActiveBreakExpires = String(expirationTime);
    } else {
      localStorage.setItem(`activeBreakExpires_${id}`, String(expirationTime));
    }
    setTiempoRestante(DURACION_PAUSA_ACTIVA_MS / 1000);
  };

  return {
    tiempoRestante,
    setTiempoRestante,
    handleTerminarDemoPausa,
    handleIniciarDemoPausa,
  };
}
