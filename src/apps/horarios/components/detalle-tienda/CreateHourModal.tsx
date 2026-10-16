import { useState } from 'react';
import {
  Box, Typography, CircularProgress, TextField, Dialog, DialogContent,
  IconButton, Button, Avatar, DialogActions, Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { mensajeDeError } from '../../utils/errores';

export interface CreateHourModalProps {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  eventName: string;
  onConfirm: (hora: string, observacion: string) => Promise<void>;
}

export default function CreateHourModal({ open, onClose, employeeName, eventName, onConfirm }: CreateHourModalProps) {
  const [horaSeleccionada, setHoraSeleccionada] = useState<dayjs.Dayjs | null>(dayjs().hour(8).minute(0));
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGuardar = async () => {
    if (!horaSeleccionada) {
      setError('Selecciona una hora');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const horaFormateada = horaSeleccionada.format('hh:mm A');
      await onConfirm(horaFormateada, observacion);
      onClose();
    } catch (err) {
      console.error('Error en handleGuardar:', err);
      setError(mensajeDeError(err, 'Error al crear la hora. Revisa la consola.'));
    } finally {
      setGuardando(false);
    }
  };

  const initial = employeeName ? employeeName.charAt(0).toUpperCase() : '?';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, overflow: 'hidden' } } }}>
      <Box sx={{ bgcolor: '#004680', color: '#fff', py: 2.5, px: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: '#fff', color: '#004680', width: 44, height: 44, fontWeight: 700, fontSize: '1.1rem' }}>
          {initial}
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {eventName}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.85, display: 'block', mt: 0.3 }}>
            {employeeName}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff', ml: 'auto' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3, pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem' }}>
            <strong>Error:</strong> {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
            <TimePicker
              label="Hora de marcación"
              value={horaSeleccionada}
              onChange={(val) => setHoraSeleccionada(val as dayjs.Dayjs | null)}
              ampm
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: { '& .MuiOutlinedInput-root': { borderRadius: 2 } },
                },
              }}
            />
          </LocalizationProvider>

          <TextField
            label="Nota / observación (opcional)"
            multiline
            rows={3}
            fullWidth
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Escriba una nota (opcional)..."
            helperText="Opcional"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1, bgcolor: '#f8fafc' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleGuardar}
          variant="contained"
          disabled={!horaSeleccionada || guardando}
          sx={{
            bgcolor: '#004680',
            borderRadius: 2,
            fontWeight: 600,
            '&:hover': { bgcolor: '#003366' },
          }}
        >
          {guardando ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
