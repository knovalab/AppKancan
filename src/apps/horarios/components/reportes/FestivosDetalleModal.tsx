
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Button,
  Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CelebrationIcon from '@mui/icons-material/Celebration';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { LOG_TYPE } from '../../domain/registro';

// Utilidad para formatear minutos laborados
const formatMinutes = (min: number): string => {
  if (min <= 0) return '0h 0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
};

// Obtener festivos trabajados por empleado
export const obtenerFestivosTrabajadosEmp = (
  empId: unknown,
  records: any[],
  holidayMap: Record<string, string>,
  anio: number,
  mes: number
) => {
  const diasTrabajados = new Set<string>();
  records.forEach(r => {
    const id = Number(r.employee_id?.id || r.employee_id);
    if (id !== Number(empId)) return;
    const fechaStr = r.record_date;
    if (!fechaStr) return;
    const d = dayjs(fechaStr);
    if (d.year() === anio && d.month() === mes && holidayMap[fechaStr]) {
      diasTrabajados.add(fechaStr);
    }
  });

  return Array.from(diasTrabajados).map(fechaStr => {
    const recsDelDia = records.filter(r => 
      Number(r.employee_id?.id || r.employee_id) === Number(empId) && 
      r.record_date === fechaStr
    );
    let totalDia = 0;
    const entrada = recsDelDia.find(r => r.log_type === LOG_TYPE.inicioJornada);
    const salida = recsDelDia.find(r => r.log_type === LOG_TYPE.finJornada);
    if (entrada && salida) {
      const h1 = entrada.record_time || entrada.time;
      const h2 = salida.record_time || salida.time;
      if (h1 && h2) {
        const [a, b] = h1.split(':').map(Number);
        const [c, d] = h2.split(':').map(Number);
        if (!isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(d)) {
          totalDia = (c * 60 + d) - (a * 60 + b);
          const iniAlm = recsDelDia.find(r => r.log_type === LOG_TYPE.inicioAlmuerzo);
          const finAlm = recsDelDia.find(r => r.log_type === LOG_TYPE.finAlmuerzo);
          if (iniAlm && finAlm) {
            const ha1 = iniAlm.record_time || iniAlm.time;
            const ha2 = finAlm.record_time || finAlm.time;
            if (ha1 && ha2) {
              const [al1, al2] = ha1.split(':').map(Number);
              const [al3, al4] = ha2.split(':').map(Number);
              if (!isNaN(al1) && !isNaN(al2) && !isNaN(al3) && !isNaN(al4)) {
                const almMin = (al3 * 60 + al4) - (al1 * 60 + al2);
                if (almMin > 0) totalDia -= almMin;
              }
            }
          }
        }
      }
    }
    return {
      fecha: fechaStr,
      nombre: holidayMap[fechaStr],
      minutos: totalDia > 0 ? totalDia : 0,
      records: recsDelDia
    };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
};

// ─── Componente FestivosChip ──────────────────────────────────────────────────
interface FestivosChipProps {
  count: number;
  total: number;
  onClick?: () => void;
}

export function FestivosChip({ count, total, onClick }: FestivosChipProps) {
  const tieneTrabajados = count > 0;
  
  return (
    <Tooltip title={`Trabajados: ${count} de ${total} festivos del mes. Haz clic para ver detalle.`} arrow placement="top">
      <Chip
        icon={<CelebrationIcon sx={{ fontSize: '0.75rem !important', color: tieneTrabajados ? '#004680 !important' : '#94a3b8 !important' }} />}
        label={`${count}/${total}`}
        size="small"
        onClick={onClick}
        sx={{
          backgroundColor: tieneTrabajados ? '#eff6ff' : '#f8fafc',
          color: tieneTrabajados ? '#1e40af' : '#64748b',
          border: `1px solid ${tieneTrabajados ? '#bfdbfe' : '#e2e8f0'}`,
          fontWeight: 700,
          fontSize: '0.72rem',
          height: 22,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s',
          '&:hover': onClick && {
            backgroundColor: tieneTrabajados ? '#dbeafe' : '#f1f5f9',
            borderColor: tieneTrabajados ? '#93c5fd' : '#cbd5e1',
          },
        }}
      />
    </Tooltip>
  );
}

// ─── Componente FestivosDetalleModal ──────────────────────────────────────────
interface FestivoData {
  fecha: string;
  nombre: string;
  minutos: number;
  records: any[];
}

interface FestivosDetalleModalProps {
  open: boolean;
  onClose: () => void;
  empleadoNombre: string;
  festivos: FestivoData[];
  onVerMarcas: (fecha: string, records: any[]) => void;
}

export default function FestivosDetalleModal({
  open,
  onClose,
  empleadoNombre,
  festivos,
  onVerMarcas,
}: FestivosDetalleModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 4, overflow: 'hidden' } } }}
    >
      <DialogTitle component="div" sx={{ bgcolor: '#004680', color: '#fff', py: 2, px: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CelebrationIcon sx={{ fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Festivos Trabajados
            </Typography>
          </Box>
          <IconButton 
            onClick={onClose} 
            sx={{ color: '#fff' }} 
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Tarjeta de Resumen */}
          <Box sx={{ bgcolor: '#eaf2fb', p: 1.5, borderRadius: 3, border: '1px solid #d0e1f7' }}>
            <Typography variant="caption" color="#004680" fontWeight={800} display="block" sx={{ textTransform: 'uppercase', mb: 0.25 }}>
              EMPLEADO
            </Typography>
            <Typography variant="subtitle2" fontWeight={850} color="#0f2c4a">
              {empleadoNombre}
            </Typography>
            <Typography variant="body2" fontWeight={750} color="#004680" sx={{ mt: 0.5 }}>
              Total festivos laborados: {festivos.length}
            </Typography>
          </Box>

          {/* Listado de festivos */}
          {festivos.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2, textAlign: 'center' }}>
              No trabajó festivos nacionales en este período.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {festivos.map((f, idx) => (
                <Paper 
                  key={idx} 
                  elevation={0} 
                  sx={{ 
                    p: 1.5, 
                    borderRadius: 3, 
                    border: '1px solid #d0e1f7', 
                    bgcolor: '#fff',
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 1
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flexGrow: 1, pr: 1 }}>
                      <Typography variant="body2" fontWeight={800} color="#0f2c4a">
                        {f.nombre}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                        {dayjs(f.fecha).locale('es').format('dddd, D [de] MMMM')}
                      </Typography>
                    </Box>
                    <Chip 
                      label={formatMinutes(f.minutos)} 
                      size="small" 
                      sx={{ bgcolor: '#eaf2fb', color: '#004680', fontWeight: 800, fontSize: '0.72rem', height: 20 }} 
                    />
                  </Box>
                  <Divider sx={{ borderColor: '#eaf2fb' }} />
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onVerMarcas(f.fecha, f.records)}
                    sx={{ 
                      textTransform: 'none', 
                      fontSize: '0.72rem', 
                      fontWeight: 700, 
                      color: '#004680', 
                      justifyContent: 'flex-start',
                      p: 0,
                      minWidth: 0,
                      '&:hover': { bg: 'transparent', textDecoration: 'underline' }
                    }}
                  >
                    Ver marcas detalladas →
                  </Button>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #eaf2fb', bgcolor: '#f8fafc' }}>
        <Button 
          onClick={onClose} 
          variant="outlined" 
          fullWidth
          sx={{ 
            borderRadius: 2, 
            textTransform: 'none', 
            fontWeight: 700, 
            borderColor: '#d0e1f7', 
            color: '#0f2c4a', 
            '&:hover': { bgcolor: '#eaf2fb', borderColor: '#bfdbfe' } 
          }}
        >
          Cerrar Detalle
        </Button>
      </DialogActions>
    </Dialog>
  );
}
