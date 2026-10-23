// LEGACY: modales controlados de la tarjeta antes del refactor; sustituidos por components/employee-card/modales/.
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Alert,
  Button, TextField, FormControl, InputLabel, Select, MenuItem, Box,
  Divider, CircularProgress
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import NoFoodIcon from '@mui/icons-material/NoFood';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { EVENTOS_REPORTABLES, type EventoTipo, type LogType, MAX_CARACTERES_OBSERVACION } from '../../domain/registro';
import { FestivoDay } from '../../components/FestivoDay';

interface EmployeeCardObsModalProps {
  open: boolean;
  onClose: () => void;
  eventoActualObs: LogType;
  nombre: string;
  maxLength: number;
  observacionTexto: string;
  setObservacionTexto: (val: string) => void;
  obsInicialModal: string;
  onGuardar: () => void;
}

export const EmployeeCardObsModal: React.FC<EmployeeCardObsModalProps> = ({
  open, onClose, eventoActualObs, nombre, maxLength,
  observacionTexto, setObservacionTexto, obsInicialModal, onGuardar
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
    <DialogTitle component="div" sx={{ bgcolor: '#004680', color: '#fff', py: 2, px: 3 }}>
      <Typography component="span" variant="h6" sx={{ fontWeight: 600, display: 'block' }}>Observaciones del evento</Typography>
      <Typography component="span" variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.5 }}>{eventoActualObs} • {nombre}</Typography>
    </DialogTitle>
    <Divider />
    <DialogContent sx={{ p: 3 }}>
      <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: '0.8rem' }}>Registre o edite la nota. Máximo {maxLength} caracteres.</Alert>
      <TextField fullWidth multiline rows={5} placeholder="Escriba aquí la observación..." value={observacionTexto} onChange={(e) => setObservacionTexto(e.target.value.slice(0, maxLength))} helperText={`${observacionTexto.length}/${maxLength} caracteres`} slotProps={{ formHelperText: { sx: { textAlign: 'right', mt: 1, fontWeight: 500 } } }} />
    </DialogContent>
    <DialogActions sx={{ p: 3, gap: 2, bgcolor: '#f8fafc' }}>
      <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, px: 3, fontWeight: 600, color: '#475569', borderColor: '#cbd5e1', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>Cancelar</Button>
      <Button onClick={onGuardar} variant="contained" disabled={observacionTexto === obsInicialModal} sx={{ bgcolor: '#004680', borderRadius: 2, px: 4, fontWeight: 600 }}>Guardar</Button>
    </DialogActions>
  </Dialog>
);

interface EmployeeCardNovedadModalProps {
  open: boolean;
  onClose: () => void;
  formData: any;
  setFormData: (val: any) => void;
  formErrors: any;
  tiposNovedad: any[];
  festivosMap: any;
  calendarYear: number;
  setCalendarYear: (yr: number) => void;
  onGuardar: () => void;
}

export const EmployeeCardNovedadModal: React.FC<EmployeeCardNovedadModalProps> = ({
  open, onClose, formData, setFormData, formErrors, tiposNovedad, festivosMap, setCalendarYear, onGuardar
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
    <DialogTitle sx={{ bgcolor: '#004680', color: '#fff', py: 2, px: 3 }}>Registro de Novedad</DialogTitle>
    <DialogContent dividers sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
        <FormControl fullWidth error={!!formErrors.novedad}>
          <InputLabel id="novedad-select-label">Novedad</InputLabel>
          <Select labelId="novedad-select-label" value={formData.novedad} label="Novedad" onChange={(e) => setFormData({ ...formData, novedad: e.target.value })}>
            {(tiposNovedad || []).map(tipo => (
              <MenuItem key={tipo.id} value={tipo.name || tipo.nombre}>
                {tipo.name || tipo.nombre}
              </MenuItem>
            ))}
          </Select>
          {formErrors.novedad && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{formErrors.novedad}</Typography>}
        </FormControl>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
          <Box sx={{ display: 'flex', gap: 2 }}>
            <DatePicker
              label="Desde el día"
              value={formData.fechaInicio ? dayjs(formData.fechaInicio) : null}
              onChange={(newValue: any) => {
                if (newValue === null) {
                  setFormData({ ...formData, fechaInicio: '' });
                } else if (dayjs.isDayjs(newValue)) {
                  setFormData({ ...formData, fechaInicio: newValue.format('YYYY-MM-DD') });
                }
              }}
              onMonthChange={(m: any) => setCalendarYear(dayjs(m).year())}
              onYearChange={(y: any) => setCalendarYear(dayjs(y).year())}
              slots={{ day: FestivoDay }}
              format="DD/MM/YYYY"
              slotProps={{
                day: { holidays: festivosMap } as any,
                textField: { fullWidth: true, error: !!formErrors.fechaInicio, helperText: formErrors.fechaInicio }
              }}
            />
            <DatePicker
              label="Hasta el día"
              value={formData.fechaFin ? dayjs(formData.fechaFin) : null}
              onChange={(newValue: any) => {
                if (newValue === null) {
                  setFormData({ ...formData, fechaFin: '' });
                } else if (dayjs.isDayjs(newValue)) {
                  setFormData({ ...formData, fechaFin: newValue.format('YYYY-MM-DD') });
                }
              }}
              onMonthChange={(m: any) => setCalendarYear(dayjs(m).year())}
              onYearChange={(y: any) => setCalendarYear(dayjs(y).year())}
              slots={{ day: FestivoDay }}
              format="DD/MM/YYYY"
              slotProps={{
                day: { holidays: festivosMap } as any,
                textField: { fullWidth: true, error: !!formErrors.fechaFin, helperText: formErrors.fechaFin }
              }}
            />
          </Box>
        </LocalizationProvider>
        <TextField label="Observaciones" multiline rows={3} fullWidth value={formData.observaciones} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} placeholder="Detalle adicional..." error={!!formErrors.observaciones} helperText={formErrors.observaciones} />
      </Box>
    </DialogContent>
    <DialogActions sx={{ p: 2, gap: 1 }}>
      <Button onClick={onClose} variant="outlined" sx={{ color: '#475569', borderColor: '#cbd5e1', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>Cancelar</Button>
      <Button onClick={onGuardar} variant="contained" disabled={!formData.novedad || !formData.fechaInicio || !formData.fechaFin} sx={{ bgcolor: '#004680' }}>Guardar</Button>
    </DialogActions>
  </Dialog>
);

interface EmployeeCardEventoModalProps {
  open: boolean;
  onClose: () => void;
  nombre: string;
  eventoSeleccionado: EventoTipo | '';
  setEventoSeleccionado: (val: EventoTipo) => void;
  eventoError: string;
  setEventoError: (val: string) => void;
  eventoObservaciones: string;
  setEventoObservaciones: (val: string) => void;
  guardandoEvento: boolean;
  onGuardar: () => void;
}

export const EmployeeCardEventoModal: React.FC<EmployeeCardEventoModalProps> = ({
  open, onClose, nombre, eventoSeleccionado, setEventoSeleccionado, eventoError,
  setEventoError, eventoObservaciones, setEventoObservaciones, guardandoEvento, onGuardar
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
    <DialogTitle sx={{ bgcolor: '#004680', color: '#fff', py: 2, px: 3, fontWeight: 700 }}>Reporta un evento</DialogTitle>
    <DialogContent dividers sx={{ p: 3 }}>
      <Typography sx={{ fontSize: '0.85rem', color: '#475569', mb: 2 }}>
        Escoja la novedad presentada para {nombre}:
      </Typography>
      <FormControl fullWidth error={!!eventoError}>
        <InputLabel id="evento-select-label">Evento</InputLabel>
        <Select
          labelId="evento-select-label"
          value={eventoSeleccionado}
          label="Evento"
          onChange={(e) => { setEventoSeleccionado(e.target.value as EventoTipo); setEventoError(''); }}
        >
          {EVENTOS_REPORTABLES.map((ev) => (
            <MenuItem key={ev} value={ev}>{ev}</MenuItem>
          ))}
        </Select>
        {eventoError && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{eventoError}</Typography>}
      </FormControl>
      <TextField
        label="Observaciones"
        multiline
        rows={3}
        fullWidth
        value={eventoObservaciones}
        onChange={(e) => setEventoObservaciones(e.target.value.slice(0, MAX_CARACTERES_OBSERVACION))}
        placeholder="Detalle adicional (opcional)..."
        helperText={`${eventoObservaciones.length}/${MAX_CARACTERES_OBSERVACION} caracteres`}
        slotProps={{ formHelperText: { sx: { textAlign: 'right' } } }}
        sx={{ mt: 2.5 }}
      />
    </DialogContent>
    <DialogActions sx={{ p: 2, gap: 1 }}>
      <Button onClick={onClose} disabled={guardandoEvento} variant="outlined" sx={{ color: '#475569', borderColor: '#cbd5e1', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>Cancelar</Button>
      <Button
        onClick={onGuardar}
        variant="contained"
        disabled={guardandoEvento}
        startIcon={guardandoEvento ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : undefined}
        sx={{ bgcolor: '#004680' }}
      >
        {guardandoEvento ? 'Guardando…' : 'Guardar'}
      </Button>
    </DialogActions>
  </Dialog>
);

interface EmployeeCardOmitirAlmuerzoModalProps {
  open: boolean;
  onClose: () => void;
  nombre: string;
  omitiendoAlmuerzo: boolean;
  onConfirmar: () => void;
}

export const EmployeeCardOmitirAlmuerzoModal: React.FC<EmployeeCardOmitirAlmuerzoModalProps> = ({
  open, onClose, nombre, omitiendoAlmuerzo, onConfirmar
}) => (
  <Dialog
    open={open}
    onClose={() => { if (!omitiendoAlmuerzo) onClose(); }}
    maxWidth="xs"
    fullWidth
    slotProps={{ paper: { sx: { borderRadius: 4 } } }}
  >
    <DialogTitle sx={{ bgcolor: '#004680', color: '#fff', py: 1.25, px: 2.25, fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 1 }}>
      <NoFoodIcon fontSize="small" />
      <Box>
        <Box>¿El turno no incluye almuerzo?</Box>
        <Box sx={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.85, textTransform: 'capitalize' }}>{nombre}</Box>
      </Box>
    </DialogTitle>
    <DialogContent dividers sx={{ px: 2.25, py: 1.75 }}>
      <Typography sx={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.55, mb: 1.5 }}>
        Al confirmar, las casillas de <strong>INICIAR ALMUERZO</strong> y <strong>FINALIZAR ALMUERZO</strong> serán marcadas automáticamente para la fecha <strong>{dayjs().format('DD/MM/YYYY')}</strong>.
      </Typography>
      <Alert severity="warning" icon={<WarningIcon sx={{ fontSize: 20 }} />} sx={{ borderRadius: 1.75, fontSize: '0.85rem', py: 0.375, alignItems: 'center', '& .MuiAlert-message': { py: 0.5 } }}>
        Una vez confirmada, esta opción solo se puede revertir llamando a soporte/sistemas.
      </Alert>
    </DialogContent>
    <DialogActions sx={{ px: 2.25, py: 1.5, gap: 1 }}>
      <Button
        onClick={onClose}
        disabled={omitiendoAlmuerzo}
        variant="outlined"
        size="small"
        sx={{ color: '#475569', borderColor: '#cbd5e1', fontSize: '0.78rem', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}
      >
        Cancelar
      </Button>
      <Button
        onClick={onConfirmar}
        variant="contained"
        size="small"
        disabled={omitiendoAlmuerzo}
        startIcon={omitiendoAlmuerzo ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : undefined}
        sx={{ bgcolor: '#004680', fontSize: '0.78rem' }}
      >
        {omitiendoAlmuerzo ? 'Registrando…' : 'Confirmar'}
      </Button>
    </DialogActions>
  </Dialog>
);
