import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Button, Box, Divider, Typography, FormControl, InputLabel, Select, MenuItem, Alert
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
  LOG_TYPE,
  type MarcacionKey,
  MIN_CARACTERES_NOTA_MOTIVO_OTRO,
} from '../domain/registro';
import { Motivo } from '../interfaces/horarios.interface';
import { formatTo12Hour } from '../utils/format';

interface EditHourModalProps {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  eventName: string;
  initialTimeStr: string | null;
  initialObservation: string;
  reasons: Motivo[];
  initialReasonId: number | null;
  registros?: Partial<Record<MarcacionKey, string | null>>;
  onConfirm: (timeFormatted: string, observation: string, reasonId: number | null) => Promise<void> | void;
  motivoRequerido?: boolean;
}

export default function EditHourModal({
  open,
  onClose,
  employeeName,
  eventName,
  initialTimeStr,
  initialObservation,
  reasons,
  initialReasonId,
  registros,
  onConfirm,
  motivoRequerido = true,
}: EditHourModalProps) {
  const [horaSeleccionada, setHoraSeleccionada] = useState<dayjs.Dayjs | null>(dayjs());
  const [horaInicial, setHoraInicial] = useState<dayjs.Dayjs | null>(null);
  const [horaObservacion, setHoraObservacion] = useState('');
  const [reasonId, setReasonId] = useState<number>(0); // 👈 0 = sin motivo
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorValidacion(null);
      let horaDayjs = dayjs();
      if (initialTimeStr) {
        let hours = 0;
        let minutes = 0;
        if (initialTimeStr.includes('AM') || initialTimeStr.includes('PM')) {
          const [timePart, ampm] = initialTimeStr.split(' ');
          const [h, m] = timePart.split(':').map(Number);
          hours = h;
          minutes = m;
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        } else {
          const [h, m] = initialTimeStr.split(':').map(Number);
          hours = h;
          minutes = m;
        }
        horaDayjs = dayjs().hour(hours).minute(minutes).second(0).millisecond(0);
      }
      setHoraSeleccionada(horaDayjs);
      setHoraInicial(horaDayjs);
      setHoraObservacion(initialObservation || '');
      setReasonId(initialReasonId ?? 0); // 👈 0 si no hay motivo
    }
  }, [open, initialTimeStr, initialObservation, initialReasonId]);

  useEffect(() => {
    if (!open || !registros) return;
    setErrorValidacion(null);

    const selStr = horaSeleccionada?.format('HH:mm') || '';

    const checkMin = (targetTime: string | null | undefined, label: string) => {
      if (!targetTime) return true;
      const targetStr = targetTime.substring(0, 5);
      if (selStr < targetStr) {
        setErrorValidacion(`La hora no puede ser menor a la de ${label} (${formatTo12Hour(targetStr)}).`);
        return false;
      }
      return true;
    };

    const checkMax = (targetTime: string | null | undefined, label: string) => {
      if (!targetTime) return true;
      const targetStr = targetTime.substring(0, 5);
      if (selStr > targetStr) {
        setErrorValidacion(`La hora no puede ser mayor a la de ${label} (${formatTo12Hour(targetStr)}).`);
        return false;
      }
      return true;
    };

    if (eventName === LOG_TYPE.inicioJornada) {
      if (registros.inicioAlmuerzo) checkMax(registros.inicioAlmuerzo, LOG_TYPE.inicioAlmuerzo);
      else if (registros.finJornada) checkMax(registros.finJornada, LOG_TYPE.finJornada);
    } else if (eventName === LOG_TYPE.inicioAlmuerzo) {
      checkMin(registros.inicioJornada, LOG_TYPE.inicioJornada);
      checkMax(registros.finAlmuerzo, LOG_TYPE.finAlmuerzo);
    } else if (eventName === LOG_TYPE.finAlmuerzo) {
      checkMin(registros.inicioAlmuerzo, LOG_TYPE.inicioAlmuerzo);
      checkMax(registros.finJornada, LOG_TYPE.finJornada);
    } else if (eventName === LOG_TYPE.finJornada) {
      if (registros.finAlmuerzo) checkMin(registros.finAlmuerzo, LOG_TYPE.finAlmuerzo);
      else checkMin(registros.inicioJornada, LOG_TYPE.inicioJornada);
    }
  }, [horaSeleccionada, open, eventName, registros]);

  const motivoSeleccionado = reasonId === 0 ? undefined : reasons.find((r) => Number(r.id) === Number(reasonId));
  const esOtro = (motivoSeleccionado?.name || '').trim().toLowerCase() === 'otro';

  const handleConfirmarHora = async () => {
    if (esOtro && horaObservacion.trim().length < MIN_CARACTERES_NOTA_MOTIVO_OTRO) return;
    const horaFormateada = horaSeleccionada?.format('hh:mm A') || '';
    // 👈 Si reasonId es 0, enviamos null (sin motivo)
    await onConfirm(horaFormateada, horaObservacion, reasonId === 0 ? null : reasonId);
    onClose();
  };

  const horaCambiada = horaSeleccionada && horaInicial && !horaSeleccionada.isSame(horaInicial, 'minute');
  const notaValida = !esOtro || horaObservacion.trim().length >= MIN_CARACTERES_NOTA_MOTIVO_OTRO;
  const puedeGuardar = horaCambiada && notaValida && !errorValidacion && (motivoRequerido ? reasonId !== 0 : true);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      <DialogTitle component="div" sx={{ bgcolor: '#004680', color: '#fff', py: 2, px: 3 }}>
        <Typography component="span" variant="h6" sx={{ fontWeight: 600, display: 'block' }}>Editar Hora - {eventName}</Typography>
        <Typography component="span" variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.5 }}>{employeeName}</Typography>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2.5 }}>
          {errorValidacion && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {errorValidacion}
            </Alert>
          )}
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
            <TimePicker
              label="Hora"
              value={horaSeleccionada}
              onChange={(val) => setHoraSeleccionada(val as dayjs.Dayjs | null)}
              ampm
              slotProps={{ textField: { fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: 2 } } } }}
            />
          </LocalizationProvider>

          <FormControl fullWidth>
            <InputLabel id="motivo-edit-label">{motivoRequerido ? 'Motivo' : 'Motivo (opcional)'}</InputLabel>
            <Select
              labelId="motivo-edit-label"
              label={motivoRequerido ? 'Motivo' : 'Motivo (opcional)'}
              value={reasonId}
              onChange={(e) => {
                setReasonId(Number(e.target.value));
              }}
              sx={{ borderRadius: 2 }}
            >
              {!motivoRequerido && <MenuItem value={0}>Sin motivo</MenuItem>}
              {reasons.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {esOtro && (
            <Alert severity="warning" icon={<InfoOutlinedIcon fontSize="inherit" />} sx={{ borderRadius: 2, bgcolor: '#fff8e1', color: '#7a5b00', border: '1px solid #ffe49c', '& .MuiAlert-icon': { color: '#c08a00' }, fontSize: '0.82rem', alignItems: 'center' }}>
              Al seleccionar <b>"Otro"</b> debes agregar una nota (mínimo {MIN_CARACTERES_NOTA_MOTIVO_OTRO} caracteres) para especificar el motivo.
            </Alert>
          )}

          <TextField
            label={esOtro ? 'Especifica el motivo' : 'Nota / observación (opcional)'}
            multiline
            rows={4}
            fullWidth
            value={horaObservacion}
            onChange={(e) => setHoraObservacion(e.target.value)}
            placeholder={esOtro ? `Describe qué pasó (mínimo ${MIN_CARACTERES_NOTA_MOTIVO_OTRO} caracteres)...` : 'Escriba una nota (opcional)...'}
            helperText={esOtro ? `${horaObservacion.trim().length}/${MIN_CARACTERES_NOTA_MOTIVO_OTRO} Caracteres` : 'Opcional'}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, color: '#475569', borderColor: '#cbd5e1', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>Cancelar</Button>
        <Button onClick={handleConfirmarHora} variant="contained" disabled={!puedeGuardar} sx={{ bgcolor: '#004680', borderRadius: 2, fontWeight: 600 }}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
}