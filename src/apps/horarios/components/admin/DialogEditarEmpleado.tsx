import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Autocomplete, TextField, FormControl, InputLabel, Select, MenuItem, Chip, Divider,
  CircularProgress,
} from '@mui/material';
import BadgeIcon from '@mui/icons-material/Badge';
import { useParseNombreIA } from '../../hooks/useParseNombreIA';
import { formatDocumentNumber, formatNombrePropio } from '../../utils/format';
import type { Cargo, EmpleadoAdmin } from '../../interfaces/empleados';
import type { Tienda } from '../../interfaces/tiendas';

const AZUL = '#004680';

interface Props {
  open: boolean;
  empleado: EmpleadoAdmin | null;
  tiendas: Tienda[];
  cargos: Cargo[];
  guardando: boolean;
  onClose: () => void;
  onGuardar: (
    id: number,
    data: {
      store_id?: number;
      position_id?: number;
      status?: string;
      first_name?: string;
      middle_name?: string;
      last_name?: string;
      second_last_name?: string;
    }
  ) => Promise<unknown>;
}

function splitNombreLocal(nombre: string) {
  const nombreFormateado = formatNombrePropio(nombre);
  const t = nombreFormateado.split(/\s+/).filter(Boolean);
  const r = { first_name: '', middle_name: '', last_name: '', second_last_name: '' };
  if (t.length === 1) { r.first_name = t[0]; }
  else if (t.length === 2) { r.first_name = t[0]; r.last_name = t[1]; }
  else if (t.length === 3) { r.first_name = t[0]; r.last_name = t[1]; r.second_last_name = t[2]; }
  else {
    r.first_name = t[0];
    r.middle_name = t[1];
    r.second_last_name = t[t.length - 1];
    r.last_name = t.slice(2, t.length - 1).join(' ');
  }
  return r;
}

export default function DialogEditarEmpleado({
  open, empleado, tiendas, cargos, guardando, onClose, onGuardar,
}: Props) {
  const [storeEdit, setStoreEdit] = useState(0);
  const [cargoEdit, setCargoEdit] = useState(0);
  const [statusEdit, setStatusEdit] = useState('Activo');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [errorNombre, setErrorNombre] = useState('');

  const { separarNombre, procesando } = useParseNombreIA();

  useEffect(() => {
    if (open && empleado) {
      setStoreEdit(empleado.store_id ?? 0);
      setCargoEdit(empleado.position_id ?? 0);
      setStatusEdit(empleado.status ?? 'Activo');
      
      const full = [empleado.first_name, empleado.middle_name, empleado.last_name, empleado.second_last_name]
        .filter((p) => p && p.trim()).join(' ');
      setNombreCompleto(full);
      setErrorNombre('');
    }
  }, [open, empleado]);

  if (!empleado) return null;

  const originalNombre = [empleado.first_name, empleado.middle_name, empleado.last_name, empleado.second_last_name]
    .filter((p) => p && p.trim()).join(' ');

  const hayCambios =
    storeEdit !== (empleado.store_id ?? 0) ||
    cargoEdit !== (empleado.position_id ?? 0) ||
    statusEdit !== (empleado.status ?? '') ||
    nombreCompleto.trim().replace(/\s+/g, ' ') !== originalNombre;

  const guardar = async () => {
    setErrorNombre('');
    const nombre = formatNombrePropio(nombreCompleto);
    if (!nombre) {
      setErrorNombre('El nombre completo es obligatorio');
      return;
    }
    if (nombre.split(' ').length < 2) {
      setErrorNombre('Ingresa al menos un nombre y un apellido');
      return;
    }

    const data: {
      store_id?: number;
      position_id?: number;
      status?: string;
      first_name?: string;
      middle_name?: string;
      last_name?: string;
      second_last_name?: string;
    } = {};

    if (storeEdit !== (empleado.store_id ?? 0)) data.store_id = storeEdit;
    if (cargoEdit !== (empleado.position_id ?? 0)) data.position_id = cargoEdit;
    if (statusEdit !== (empleado.status ?? '')) data.status = statusEdit;

    if (nombre !== originalNombre) {
      let partes;
      try {
        partes = await separarNombre(nombre);
        if (!partes.first_name || !partes.last_name) partes = splitNombreLocal(nombre);
      } catch {
        partes = splitNombreLocal(nombre);
      }
      data.first_name = partes.first_name;
      data.middle_name = partes.middle_name || '';
      data.last_name = partes.last_name;
      data.second_last_name = partes.second_last_name || '';
    }

    if (Object.keys(data).length === 0) { onClose(); return; }

    await onGuardar(empleado.id, data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      <DialogTitle sx={{ bgcolor: AZUL, color: '#fff', p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <BadgeIcon />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', textTransform: 'capitalize', lineHeight: 1.2 }} noWrap>
            {nombreCompleto || 'Empleado'}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', opacity: 0.85 }}>
            {empleado.document_type || 'Documento'}: {formatDocumentNumber(empleado.document_number)}
          </Typography>
        </Box>
        <Chip label={(empleado.status || '—').toUpperCase()} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: '0.7rem', borderRadius: '8px' }} />
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField
          fullWidth
          label="Nombre completo *"
          placeholder="Ej: Juan Camilo Ortiz Grisales"
          value={nombreCompleto}
          onChange={(e) => {
            setNombreCompleto(e.target.value);
            if (errorNombre) setErrorNombre('');
          }}
          error={!!errorNombre}
          helperText={errorNombre}
          disabled={guardando || procesando}
        />

        <Autocomplete
          options={tiendas}
          getOptionLabel={(o) => o.name}
          value={tiendas.find((t) => t.id === storeEdit) ?? null}
          onChange={(_, v) => setStoreEdit(v ? v.id : 0)}
          disabled={guardando || procesando}
          renderInput={(params) => <TextField {...params} label="Tienda" placeholder="Buscar tienda..." />}
        />

        <FormControl fullWidth disabled={guardando || procesando}>
          <InputLabel id="cargo-edit-label">Cargo</InputLabel>
          <Select labelId="cargo-edit-label" label="Cargo" value={cargoEdit === 0 ? '' : cargoEdit} onChange={(e) => setCargoEdit(Number(e.target.value))}>
            <MenuItem value="" disabled>Selecciona un cargo…</MenuItem>
            {cargos.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.5px', color: '#6b7280', mb: 1 }}>ESTADO</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {['Activo', 'Inactivo'].map((s) => {
              const activo = statusEdit === s;
              return (
                <Chip
                  key={s}
                  label={s}
                  onClick={() => { if (!guardando && !procesando) setStatusEdit(s); }}
                  disabled={guardando || procesando}
                  sx={{
                    fontWeight: 600,
                    cursor: (guardando || procesando) ? 'default' : 'pointer',
                    borderRadius: '8px',
                    px: 0.5,
                    bgcolor: activo ? (s === 'Activo' ? '#dcfce7' : '#fee2e2') : '#f1f5f9',
                    color: activo ? (s === 'Activo' ? '#16a34a' : '#dc2626') : '#64748b',
                    border: '1px solid',
                    borderColor: activo ? (s === 'Activo' ? '#16a34a' : '#dc2626') : 'transparent',
                  }}
                />
              );
            })}
          </Box>
        </Box>
        <Divider />
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" disabled={guardando || procesando} sx={{ color: '#475569', borderColor: '#cbd5e1', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>Cancelar</Button>
        <Button
          onClick={guardar}
          variant="contained"
          disableElevation
          disabled={!hayCambios || guardando || procesando}
          startIcon={(guardando || procesando) ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : undefined}
          sx={{ bgcolor: AZUL, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#003a6b' } }}
        >
          {procesando ? 'Procesando nombre…' : guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
