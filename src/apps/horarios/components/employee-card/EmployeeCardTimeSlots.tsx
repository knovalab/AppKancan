import React from 'react';
import { Box, Typography, Button, IconButton, Stack, Tooltip, CircularProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NoFoodIcon from '@mui/icons-material/NoFood';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { esEmpleadoDemo, LOG_TYPE, type LogType, type Marcacion } from '../../domain/registro';
import { getIcon, formatTo12Hour } from './EmployeeCardUtils';

/** Un botón de marcación: la marcación del catálogo, si es la siguiente acción y su hora. */
export interface BotonSlot {
  marcacion: Marcacion;
  activo: boolean;
  hora: string | null;
}

interface EmployeeCardTimeSlotsProps {
  idEmpleado: string;
  tiempoRestante: number | null;
  finalizado: boolean;
  almuerzoOmitidoLocal: boolean;
  guardandoRegistro: LogType | null;
  botones: BotonSlot[];
  getObservacion: (evento: LogType) => string;
  getEditadoStatus: (evento: LogType) => boolean;
  onOpenHoraModal: (evento: LogType) => void;
  onRegistrarEvento: (evento: LogType) => void;
  onOpenObsModal: (evento: LogType) => void;
  onOpenOmitirAlmuerzoModal: () => void;
  onTerminarDemoPausa: () => void;
}

export const EmployeeCardTimeSlots: React.FC<EmployeeCardTimeSlotsProps> = React.memo(({
  idEmpleado,
  tiempoRestante,
  finalizado,
  almuerzoOmitidoLocal,
  guardandoRegistro,
  botones,
  getObservacion,
  getEditadoStatus,
  onOpenHoraModal,
  onRegistrarEvento,
  onOpenObsModal,
  onOpenOmitirAlmuerzoModal,
  onTerminarDemoPausa,
}) => {
  return (
    <Box sx={{ p: 3, position: 'relative' }}>
      {tiempoRestante !== null && (
        <Box
          sx={{
            bgcolor: '#ecfeff',
            border: '1px solid #a5f3fc',
            borderRadius: 2,
            p: 1.5,
            mb: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s infinite ease-in-out',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.8 },
            }
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0e7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Pausas Activas
          </Typography>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#0891b2', mt: 0.5 }}>
            {Math.floor(tiempoRestante / 60)}:{(tiempoRestante % 60).toString().padStart(2, '0')}
          </Typography>
          {esEmpleadoDemo(idEmpleado) && (
            <Button
              size="small"
              onClick={onTerminarDemoPausa}
              sx={{ mt: 1, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#0891b2', color: '#fff', '&:hover': { bgcolor: '#0e7490' } }}
            >
              Terminar Demo
            </Button>
          )}
        </Box>
      )}

      <Stack className="tour-marcacion" spacing={1.5}>
        {botones.map((btn) => {
          const logType = btn.marcacion.logType;
          const esCasillaAlmuerzo = logType === LOG_TYPE.inicioAlmuerzo || logType === LOG_TYPE.finAlmuerzo;
          const yaHecho = !!btn.hora && !(almuerzoOmitidoLocal && esCasillaAlmuerzo);
          const bloqueado = (!btn.activo && !yaHecho) || (almuerzoOmitidoLocal && esCasillaAlmuerzo);
          const observacionGuardada = getObservacion(logType);
          const obsEnabled = yaHecho;
          const editado = getEditadoStatus(logType);
          const relojEnabled = yaHecho && !editado;
          const tooltipTitle = relojEnabled
            ? 'Editar hora'
            : (yaHecho && editado
                ? 'Esta hora ya fue editada y no se puede volver a editar. En caso de ser necesario, llamar a soporte/sistemas.'
                : 'No disponible');

          return (
            <Box key={btn.marcacion.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={tooltipTitle}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!relojEnabled}
                    onClick={() => onOpenHoraModal(logType)}
                    sx={{
                      border: '1px solid',
                      borderColor: relojEnabled ? '#cbd5e1' : '#e2e8f0',
                      borderRadius: 1.5,
                      color: relojEnabled ? '#004680' : '#cbd5e1',
                      '&:hover': { bgcolor: relojEnabled ? '#f1f5f9' : 'transparent' }
                    }}
                  >
                    <AccessTimeIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Button
                fullWidth
                variant={btn.activo ? 'contained' : yaHecho ? 'outlined' : 'text'}
                disabled={bloqueado || finalizado || guardandoRegistro !== null || tiempoRestante !== null}
                onClick={yaHecho ? undefined : () => onRegistrarEvento(logType)}
                endIcon={
                  guardandoRegistro === logType ? (
                    <CircularProgress size={16} sx={{ color: btn.activo ? '#fff' : '#004680' }} />
                  ) : yaHecho ? (
                    <CheckCircleOutlineIcon color="success" />
                  ) : (
                    getIcon(logType)
                  )
                }
                sx={{
                  justifyContent: 'space-between',
                  textTransform: 'uppercase',
                  fontSize: '12px',
                  fontWeight: 700,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: btn.activo ? '#004680' : 'transparent',
                  color: btn.activo ? '#fff' : yaHecho ? '#16a34a' : '#94a3b8',
                  borderColor: yaHecho ? '#cbd5e1' : 'transparent',
                  cursor: yaHecho ? 'default' : 'pointer',
                  boxShadow: 'none',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    bgcolor: btn.activo ? '#003366' : 'transparent',
                    transform: btn.activo ? 'translateY(-1px)' : 'none',
                    boxShadow: 'none',
                  },
                  '&:active': { boxShadow: 'none' },
                  '&:focus': { boxShadow: 'none' },
                }}
              >
                <span>{btn.marcacion.etiqueta}</span>
                {btn.hora && <span style={{ fontSize: '12px', fontWeight: 600 }}>{formatTo12Hour(btn.hora)}</span>}
              </Button>

              {logType === LOG_TYPE.inicioAlmuerzo && btn.activo && !almuerzoOmitidoLocal ? (
                <Tooltip title="Turno sin almuerzo" arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={onOpenOmitirAlmuerzoModal}
                      sx={{
                        border: '1px solid #efd8a8',
                        borderRadius: 1.5,
                        bgcolor: '#fdf3e0',
                        color: '#c08417',
                        '&:hover': { bgcolor: '#fceecb' }
                      }}
                    >
                      <NoFoodIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <Tooltip title={observacionGuardada ? `Observación: ${observacionGuardada.substring(0, 80)}...` : (obsEnabled ? 'Agregar observación' : 'No disponible')} arrow>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!obsEnabled}
                      onClick={() => obsEnabled && onOpenObsModal(logType)}
                      sx={{
                        border: '1px solid',
                        borderColor: obsEnabled ? '#cbd5e1' : '#e2e8f0',
                        borderRadius: 1.5,
                        color: obsEnabled ? '#004680' : '#cbd5e1',
                        '&:hover': { bgcolor: obsEnabled ? '#f1f5f9' : 'transparent' }
                      }}
                    >
                      <AssignmentIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          );
        })}
      </Stack>

      {finalizado && (
        <Box sx={{ mt: 2, textAlign: 'center', bgcolor: '#f0fdf4', py: 1, borderRadius: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#16a34a' }}>Jornada completada</Typography>
        </Box>
      )}
    </Box>
  );
});
