import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Avatar, Chip, CircularProgress, Divider, Collapse, IconButton,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import BadgeIcon from '@mui/icons-material/Badge';
import StorefrontIcon from '@mui/icons-material/Storefront';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  getEmployeeTimeRecords, getEmployeeNovedades, getEmployeeEventReports,
} from '../../api/directus/read';
import { eliminarNovedad } from '../../api/directus/create';
import { getIconForTipo, getChipColor } from '../../utils/novedadVisual';
import { useHorariosPolicies } from '../../hooks/useHorariosPolicies';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import { formatDocumentNumber } from '../../utils/format';
import { LOG_TYPE } from '../../domain/registro';
import { horariosKeys } from '../../hooks/registro/keys';
import type { EmpleadoAdmin } from '../../interfaces/empleados';

const AZUL = '#004680';
const AVATAR_COLORS = ['#0284c7', '#7c3aed', '#16a34a', '#ea580c', '#db2777', '#0891b2', '#4f46e5', '#ca8a04', '#dc2626', '#059669', '#2563eb', '#9333ea'];
const colorAvatar = (t: string) => {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = t.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '—');

function SeccionColapsable({
  titulo, count, vacio, hayDatos, defaultOpen = false, children,
}: {
  titulo: string;
  count: number;
  vacio: string;
  hayDatos: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ border: '1px solid #eef2f6', borderRadius: 2, overflow: 'hidden' }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, cursor: 'pointer', userSelect: 'none', bgcolor: '#f8fafc', '&:hover': { bgcolor: '#f1f5f9' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.5px', color: '#6b7280' }}>{titulo}</Typography>
          <Chip label={count} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#eaf2fb', color: AZUL }} />
        </Box>
        <KeyboardArrowDownIcon sx={{ fontSize: 20, color: '#94a3b8', transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, py: 1 }}>
          {hayDatos ? children : <Typography sx={{ fontSize: '0.82rem', color: '#94a3b8' }}>{vacio}</Typography>}
        </Box>
      </Collapse>
    </Box>
  );
}

interface Props {
  open: boolean;
  empleado: EmpleadoAdmin | null;
  tiendaNombre: string;
  onClose: () => void;
  onEditar: () => void;
}

interface JornadaDia {
  fecha: string;
  entrada: string | null;
  salida: string | null;
  horas: string;
}

const calcularHoras = (recs: any[]): string => {
  const buscar = (tipo: string) => recs.find((r) => r.log_type === tipo)?.record_time ?? null;
  const ini = buscar(LOG_TYPE.inicioJornada);
  const fin = buscar(LOG_TYPE.finJornada);
  if (!ini || !fin) return '—';
  const base = '2000-01-01';
  let min = dayjs(`${base} ${fin}`).diff(dayjs(`${base} ${ini}`), 'minute');
  const ia = buscar(LOG_TYPE.inicioAlmuerzo);
  const fa = buscar(LOG_TYPE.finAlmuerzo);
  if (ia && fa) {
    const diffAlmuerzo = dayjs(`${base} ${fa}`).diff(dayjs(`${base} ${ia}`), 'minute');
    if (diffAlmuerzo > 0) {
      min -= diffAlmuerzo;
    }
  }
  return min > 0 ? `${(min / 60).toFixed(1)} h` : '—';
};

export default function DialogPerfilEmpleado({ open, empleado, tiendaNombre, onClose, onEditar }: Props) {
  const empId = empleado?.id ?? 0;
  const inicioMes = dayjs().startOf('month').format('YYYY-MM-DD');
  const hoy = dayjs().format('YYYY-MM-DD');
  const habilitado = open && empId > 0;

  const { esAdmin } = useHorariosPolicies();
  const isAdminUser = esAdmin();
  const queryClient = useQueryClient();
  const { showSnackbar } = useGlobalSnackbar();

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const eliminarMutation = useMutation({
    mutationFn: eliminarNovedad,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfilNovedades', empId] });
      queryClient.invalidateQueries({ queryKey: horariosKeys.novedades.todos });
      queryClient.invalidateQueries({ queryKey: horariosKeys.empleados.todos });
      showSnackbar('Novedad eliminada con éxito', 'success');
    },
    onError: (err: any) => {
      showSnackbar(err?.message || 'Error al eliminar la novedad', 'error');
    },
  });

  const handleConfirmDelete = async () => {
    if (confirmDeleteId != null) {
      await eliminarMutation.mutateAsync(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const { data: timeRecords = [], isLoading: loadingTR } = useQuery<any[]>({
    queryKey: ['perfilTimeRecords', empId, inicioMes, hoy],
    queryFn: () => getEmployeeTimeRecords(empId, inicioMes, hoy),
    enabled: habilitado,
    staleTime: 60 * 1000,
  });
  const { data: novedades = [], isLoading: loadingNov } = useQuery<any[]>({
    queryKey: ['perfilNovedades', empId],
    queryFn: () => getEmployeeNovedades(empId, 5),
    enabled: habilitado,
    staleTime: 60 * 1000,
  });
  const { data: eventos = [], isLoading: loadingEv } = useQuery<any[]>({
    queryKey: ['perfilEventos', empId, inicioMes, hoy],
    queryFn: () => getEmployeeEventReports(empId, inicioMes, hoy),
    enabled: habilitado,
    staleTime: 60 * 1000,
  });

  const cargando = loadingTR || loadingNov || loadingEv;

  const jornadas: JornadaDia[] = (() => {
    const grupos: Record<string, any[]> = {};
    timeRecords.forEach((r) => { (grupos[r.record_date] ||= []).push(r); });
    return Object.entries(grupos)
      .map(([fecha, recs]) => ({
        fecha,
        entrada: recs.find((r) => r.log_type === LOG_TYPE.inicioJornada)?.record_time ?? null,
        salida: recs.find((r) => r.log_type === LOG_TYPE.finJornada)?.record_time ?? null,
        horas: calcularHoras(recs),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  })();

  const nombre = empleado
    ? [empleado.first_name, empleado.middle_name, empleado.last_name, empleado.second_last_name].filter((p) => p && p.trim()).join(' ')
    : 'Empleado';
  const inactivo = (empleado?.status || '').toLowerCase() !== 'activo';

  const filaInfo = (icon: React.ReactNode, label: string, value: string) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.85, borderBottom: '1px solid #f1f5f9', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#64748b' }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#eaf2fb', color: AZUL }}>{icon}</Box>
        <Typography sx={{ fontSize: '0.82rem' }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f2c4a' }}>{value || '—'}</Typography>
    </Box>
  );

  const kpi = (icon: React.ReactNode, label: string, valor: number | string, color: string, bg: string) => (
    <Box sx={{ flex: 1, minWidth: 110, bgcolor: bg, border: `1px solid ${color}22`, borderRadius: 2.5, p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: color, color: '#fff' }}>{icon}</Box>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.3px' }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{valor}</Typography>
    </Box>
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <DialogTitle component="div" sx={{ bgcolor: AZUL, color: '#fff', py: 2, px: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: colorAvatar(nombre), width: 46, height: 46, fontWeight: 700 }}>{nombre.charAt(0).toUpperCase()}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.05rem', display: 'block', textTransform: 'capitalize', lineHeight: 1.2 }} noWrap>{nombre}</Typography>
            <Typography component="span" variant="caption" sx={{ opacity: 0.85, display: 'block' }}>{empleado?.position_name || 'Sin cargo'}</Typography>
          </Box>
          <Chip label={(empleado?.status || '—').toUpperCase()} size="small" sx={{ height: 22, fontWeight: 700, fontSize: '0.65rem', bgcolor: inactivo ? '#fee2e2' : '#dcfce7', color: inactivo ? '#dc2626' : '#16a34a' }} />
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {cargando ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={30} sx={{ color: AZUL }} /></Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {filaInfo(
                  <BadgeIcon sx={{ fontSize: 17 }} />,
                  'Documento',
                  [empleado?.document_type, empleado?.document_number ? formatDocumentNumber(empleado.document_number) : ''].filter(Boolean).join(' ') || '—'
                )}
                {filaInfo(
                  <StorefrontIcon sx={{ fontSize: 17 }} />,
                  'Tienda',
                  tiendaNombre || '—'
                )}
                {filaInfo(
                  <EmailIcon sx={{ fontSize: 17 }} />,
                  'Email',
                  empleado?.email || '—'
                )}
                {filaInfo(
                  <PhoneIcon sx={{ fontSize: 17 }} />,
                  'Teléfono',
                  empleado?.phone_number || '—'
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {kpi(<EventNoteIcon sx={{ fontSize: 16 }} />, 'JORNADAS (MES)', jornadas.filter((j) => j.entrada).length, '#004680', '#eaf2fb')}
                {kpi(<PauseCircleOutlineIcon sx={{ fontSize: 16 }} />, 'PAUSAS (MES)', eventos.length, '#b45309', '#fef3c7')}
                {kpi(<AssignmentIcon sx={{ fontSize: 16 }} />, 'NOVEDADES', novedades.length, '#7c3aed', '#ede9fe')}
              </Box>

              <Divider />

              <SeccionColapsable titulo="ÚLTIMAS JORNADAS" count={jornadas.length} vacio="Sin jornadas este mes." hayDatos={jornadas.length > 0} defaultOpen>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {jornadas.slice(0, 5).map((j) => (
                    <Box key={j.fecha} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid #f1f5f9', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <EventNoteIcon sx={{ fontSize: 18, color: AZUL, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.82rem', color: '#0f2c4a', fontWeight: 600 }}>{dayjs(j.fecha).format('DD MMM')}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.8rem', color: '#475569' }}>{hhmm(j.entrada)} → {hhmm(j.salida)}</Typography>
                      <Chip label={j.horas} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#eaf2fb', color: AZUL }} />
                    </Box>
                  ))}
                </Box>
              </SeccionColapsable>

              <SeccionColapsable titulo="ÚLTIMAS NOVEDADES" count={novedades.length} vacio="Sin novedades registradas." hayDatos={novedades.length > 0}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {novedades.map((n) => {
                    const tipo = n.newness_id?.name || 'Novedad';
                    const c = getChipColor(tipo);
                    return (
                      <Box key={n.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid #f1f5f9', gap: 1 }}>
                        <Chip
                          icon={getIconForTipo(tipo)}
                          label={tipo}
                          size="small"
                          sx={{ height: 24, fontWeight: 700, fontSize: '0.72rem', bgcolor: c.bg, color: c.text, '& .MuiChip-icon': { ml: 0.5 } }}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', flexShrink: 0 }}>
                            {n.report_date ? dayjs(n.report_date).format('DD MMM YYYY') : '—'}
                          </Typography>
                          {isAdminUser && (
                            <IconButton
                              size="small"
                              onClick={() => setConfirmDeleteId(n.id)}
                              sx={{ color: '#ef4444', p: 0.25, '&:hover': { bgcolor: '#fef2f2' } }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </SeccionColapsable>

              <SeccionColapsable titulo="ÚLTIMAS PAUSAS" count={eventos.length} vacio="Sin pausas este mes." hayDatos={eventos.length > 0}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {eventos.slice(0, 5).map((e) => (
                    <Box key={e.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid #f1f5f9', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <PauseCircleOutlineIcon sx={{ fontSize: 18, color: '#b45309', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.82rem', color: '#0f2c4a', fontWeight: 600 }} noWrap>{e.event_type}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', flexShrink: 0 }}>
                        {e.date ? dayjs(e.date).format('DD MMM') : '—'} · {hhmm(e.hour)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </SeccionColapsable>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, color: '#475569', borderColor: '#cbd5e1', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>Cerrar</Button>
          <Button onClick={onEditar} variant="contained" disableElevation startIcon={<EditOutlinedIcon />} sx={{ bgcolor: AZUL, borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#003a6b' } }}>Editar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f2c4a' }}>
          ¿Eliminar novedad?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
            ¿Estás seguro de que deseas eliminar esta novedad? Esta acción no se puede deshacer y el empleado volverá a figurar según sus marcaciones habituales.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setConfirmDeleteId(null)}
            variant="outlined"
            disabled={eliminarMutation.isPending}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#475569', borderColor: '#cbd5e1', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            disableElevation
            disabled={eliminarMutation.isPending}
            startIcon={eliminarMutation.isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
            sx={{ bgcolor: '#dc2626', borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#b91c1c' } }}
          >
            {eliminarMutation.isPending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}