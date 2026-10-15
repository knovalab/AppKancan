// LEGACY: sustituido por components/employee-card/header/ (refactor C1–C8).
import React from 'react';
import { Box, Typography, Button, IconButton, Chip, Tooltip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import { ESTADO, type EstadoAsistencia, ETIQUETA_ESTADO, EVENTO } from '../../domain/registro';
import { EmpleadoAsistencia } from '../../interfaces/horarios.interface';
import { NombreEmpleado } from './EmployeeCardUtils';

interface EmployeeCardHeaderProps {
  empleado: EmpleadoAsistencia;
  estadoActual: EstadoAsistencia;
  pausasActivasCount: number;
  pausasAgotadas: boolean;
  novedadActiva: boolean;
  reporteActivo: boolean;
  finalizado: boolean;
  showAceptarNormasButton: boolean;
  maxPausas: number;
  onOpenNovedadModal: () => void;
  onOpenEventoModal: () => void;
  onOpenEmployeeNormasModal: () => void;
}

export const EmployeeCardHeader: React.FC<EmployeeCardHeaderProps> = React.memo(({
  empleado,
  estadoActual,
  pausasActivasCount,
  pausasAgotadas,
  novedadActiva,
  reporteActivo,
  finalizado,
  showAceptarNormasButton,
  maxPausas,
  onOpenNovedadModal,
  onOpenEventoModal,
  onOpenEmployeeNormasModal,
}) => {
  return (
    <Box sx={{ bgcolor: '#004680', color: 'white', p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, pr: 1 }}>
        <NombreEmpleado nombre={empleado.nombre} />
        {empleado.cargo && (
          <Typography sx={{ fontWeight: 500, fontSize: '0.7rem', opacity: 0.85, textTransform: 'uppercase', mt: 0.3, letterSpacing: '0.5px' }}>
            {empleado.cargo}
          </Typography>
        )}
        {estadoActual !== ESTADO.entradaPendiente && !finalizado && (
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#ffffff', opacity: 0.75, textTransform: 'uppercase', mt: 0.5, letterSpacing: '0.5px' }}>
            {pausasAgotadas
              ? null
              : pausasActivasCount === 0
                ? 'Pausa activa pendiente'
                : `Pausa activa ${pausasActivasCount} de ${maxPausas} completada`
            }
          </Typography>
        )}
        {showAceptarNormasButton && (
          <Button
            size="small"
            variant="contained"
            onClick={onOpenEmployeeNormasModal}
            sx={{
              mt: 0.75,
              alignSelf: 'flex-start',
              fontSize: '0.65rem',
              fontWeight: 800,
              bgcolor: '#fbbf24',
              color: '#451a03',
              textTransform: 'uppercase',
              px: 1.25,
              py: 0.25,
              borderRadius: 1.5,
              boxShadow: 'none',
              letterSpacing: '0.4px',
              '&:hover': { bgcolor: '#f59e0b', boxShadow: 'none' }
            }}
          >
            ⚠ Aceptar Normas
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Tooltip title={novedadActiva ? 'Registrar novedad' : 'No disponible'}>
          <span className="tour-novedad-btn">
            <IconButton
              size="medium"
              disabled={!novedadActiva}
              onClick={onOpenNovedadModal}
              sx={{
                color: novedadActiva ? '#ffffff' : 'rgba(255,255,255,0.3)',
                '&:hover': {
                  bgcolor: novedadActiva ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                },
                '&.Mui-disabled': {
                  color: 'rgba(255,255,255,0.3)',
                }
              }}
            >
              <WarningIcon fontSize="medium" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={
          pausasAgotadas
            ? `Pausas activas completadas (${maxPausas} de ${maxPausas})`
            : reporteActivo
              ? EVENTO.iniciarPausaActiva
              : 'No disponible'
        }>
          <span className="tour-evento-btn">
            <IconButton
              size="medium"
              disabled={!reporteActivo}
              onClick={onOpenEventoModal}
              sx={{
                color: reporteActivo ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                '&:hover': {
                  bgcolor: reporteActivo ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                },
                '&.Mui-disabled': {
                  color: 'rgba(255,255,255,0.3)',
                }
              }}
            >
              <PauseCircleOutlineIcon fontSize="medium" />
            </IconButton>
          </span>
        </Tooltip>
        <Chip label={ETIQUETA_ESTADO[estadoActual]} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 'bold', fontSize: '0.65rem', height: 24 }} />
      </Box>
    </Box>
  );
});
