import { useState, useEffect } from 'react';
import { obtenerTiendasIdsUsuarioActual } from '@/services/directus/userStores';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Autocomplete, TextField, Checkbox, FormControlLabel, Divider, CircularProgress,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { getStores, fetchTimeRecordsExport, getReasonNamesForRecords } from '../../api/directus/read';
import { exportarHistorialExcel } from '../../utils/exportarHistorial';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import { useHorariosPolicies } from '../../hooks/useHorariosPolicies';
import { useAuth } from '@/auth/hooks/useAuth';
import type { Tienda } from '../../interfaces/tiendas';

const AZUL = '#004680';

interface Props {
  open: boolean;
  onClose: () => void;
  fechaInicio?: string;
  fechaFin?: string;
  tiendaDefault?: number | null;
  searchNombre?: string;
}

export default function ExportHistorialDialog({ open, onClose, fechaInicio, fechaFin, tiendaDefault, searchNombre }: Props) {
  const { showSnackbar } = useGlobalSnackbar();
  const { esAdmin: originalEsAdmin, esReport, esAreaManager } = useHorariosPolicies();
  const esAdmin = () => originalEsAdmin() || esReport();
  const isAreaMgr = esAreaManager ? esAreaManager() : false;
  const { user } = useAuth();
  const [tiendasSel, setTiendasSel] = useState<Tienda[]>([]);
  const [detallada, setDetallada] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [rangoInicio, setRangoInicio] = useState<Dayjs | null>(null);
  const [rangoFin, setRangoFin] = useState<Dayjs | null>(null);

  const storeIdUsuario = user?.store_id ? Number(user.store_id) : null;
  const tiendaEfectiva = tiendaDefault != null ? tiendaDefault : storeIdUsuario;

  const { data: tiendas = [], isLoading: loadingTiendas } = useQuery<Tienda[]>({
    queryKey: ['adminTiendas'],
    queryFn: getStores,
    staleTime: 30 * 60 * 1000,
    enabled: open,
  });

  const { data: tiendasAcceso = [] } = useQuery<number[]>({
    queryKey: ['tiendasAccesoUsuario'],
    queryFn: () => obtenerTiendasIdsUsuarioActual({ excludeOnline: true }),
    enabled: open && isAreaMgr,
    staleTime: 30 * 60 * 1000,
  });

  const tiendasFiltradas = isAreaMgr
    ? tiendas.filter(t => {
        const idsPermitidos = tiendasAcceso.map(id => {
          if (id && typeof id === 'object') {
            return Number((id as any).id ?? (id as any).store_id);
          }
          return Number(id);
        }).filter(id => Boolean(id) && Number(id) !== 5);
        return idsPermitidos.includes(Number(t.id)) && Number(t.id) !== 5;
      })
    : tiendas;

  const todas = tiendasFiltradas.length > 0 && tiendasSel.length === tiendasFiltradas.length;

  useEffect(() => {
    if (open) {
      setRangoInicio(fechaInicio ? dayjs(fechaInicio) : dayjs().subtract(6, 'day'));
      setRangoFin(fechaFin ? dayjs(fechaFin) : dayjs());
      setTiendasSel([]);
    }
  }, [open, fechaInicio, fechaFin]);

  useEffect(() => {
    if (open && tiendaDefault != null && tiendas.length > 0) {
      const t = tiendas.find((x) => x.id === tiendaDefault);
      setTiendasSel(t ? [t] : []);
    }
  }, [open, tiendas, tiendaDefault]);

  const puedeExportar = (esAdmin() ? (todas || tiendasSel.length > 0 || (isAreaMgr && tiendasFiltradas.length > 0)) : tiendaEfectiva != null) && !exportando;

  const handleExportar = async () => {
    setExportando(true);
    try {
      const storeIds = isAreaMgr
        ? (todas || tiendasSel.length === 0
            ? tiendasFiltradas.map((t) => Number(t.id))
            : tiendasSel.map((t) => Number(t.id)))
        : (esAdmin()
          ? (todas ? undefined : tiendasSel.map((t) => Number(t.id)))
          : [Number(tiendaEfectiva)]);
      let fIni = rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined;
      let fFin = rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined;
      const records = await fetchTimeRecordsExport(fIni, fFin, storeIds, esAdmin());

      let filteredRecords = records;
      if (searchNombre) {
        const normalizar = (texto: string) =>
          texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const searchClean = normalizar(searchNombre);
        filteredRecords = records.filter((r) => {
          const empName = r.employee_id
            ? [r.employee_id.first_name, r.employee_id.middle_name, r.employee_id.last_name, r.employee_id.second_last_name]
                .filter((n) => n && String(n).trim())
                .join(" ")
            : "Sin nombre";
          return normalizar(empName).includes(searchClean);
        });
      }

      const reasonsMap = detallada
        ? await getReasonNamesForRecords(filteredRecords.map((r) => r.id))
        : new Map<number, string>();

      const res = await exportarHistorialExcel({ records: filteredRecords, stores: tiendasFiltradas, reasonsMap, detallada });
      if (res.ok) {
        showSnackbar('Exportación generada con éxito', 'success');
        onClose();
      } else {
        showSnackbar(res.mensaje || 'No hay datos para exportar', 'error');
      }
    } catch (err: any) {
      showSnackbar(err?.message || 'Error al exportar el historial', 'error');
    } finally {
      setExportando(false);
    }
  };

  return (
    <Dialog open={open} onClose={exportando ? undefined : onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      <DialogTitle component="div" sx={{ bgcolor: AZUL, color: '#fff', py: 2, px: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <FileDownloadIcon />
        <Box>
          <Typography component="span" variant="h6" sx={{ fontWeight: 600, display: 'block' }}>Exportar historial</Typography>
          <Typography component="span" variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
            {esAdmin() ? 'Selecciona tiendas, rango de fechas y nivel de detalle' : 'Selecciona el rango de fechas'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          {esAdmin() && (
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.5px', color: '#6b7280', mb: 1 }}>
                TIENDAS A EXPORTAR
              </Typography>
              <Autocomplete
                multiple
                limitTags={2}
                size="small"
                options={tiendasFiltradas}
                loading={loadingTiendas}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={tiendasSel}
                onChange={(_, v) => setTiendasSel(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Selecciona una o varias tiendas…"
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <StorefrontIcon sx={{ fontSize: 18, color: AZUL, ml: 0.5, mr: 0.5 }} />
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      },
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f1f7fe' } }}
                  />
                )}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={todas}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTiendasSel(tiendasFiltradas);
                      } else {
                        setTiendasSel([]);
                      }
                    }}
                    sx={{ color: AZUL, '&.Mui-checked': { color: AZUL } }}
                  />
                }
                label={<Typography sx={{ fontSize: '0.85rem', fontWeight: "bold" }}>Todas las tiendas</Typography>}
                sx={{ mt: 0.5 }}
              />
            </Box>
          )}

          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.5px', color: '#6b7280', mb: 1 }}>
              RANGO DE FECHAS
            </Typography>
            <DateRangeFilter
              fechaInicio={rangoInicio}
              fechaFin={rangoFin}
              onChange={(inicio, fin) => { setRangoInicio(inicio); setRangoFin(fin); }}
            />

            {(() => {
              const conRango = !!(rangoInicio || rangoFin);
              const c = conRango
                ? { bg: '#eaf2fb', border: '#cfe2f7', icon: '#004680', text: '#0f2c4a' }
                : { bg: '#fff8e1', border: '#ffe49c', icon: '#c08a00', text: '#7a5b00' };
              return (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1.5,
                    mt: 1.25,
                    borderRadius: 2,
                    bgcolor: c.bg,
                    border: `1px solid ${c.border}`,
                  }}
                >
                  {conRango
                    ? <CalendarMonthIcon sx={{ fontSize: 20, color: c.icon, flexShrink: 0 }} />
                    : <InfoOutlinedIcon sx={{ fontSize: 20, color: c.icon, flexShrink: 0 }} />}
                  <Typography sx={{ fontSize: '0.82rem', color: c.text, lineHeight: 1.4 }}>
                    {conRango ? (
                      <>
                        Se exportará del{' '}
                        <Box component="span" sx={{ fontWeight: 700 }}>{rangoInicio ? rangoInicio.format('DD-MM-YYYY') : '…'}</Box>
                        {' '}al{' '}
                        <Box component="span" sx={{ fontWeight: 700 }}>{rangoFin ? rangoFin.format('DD-MM-YYYY') : '…'}</Box>.
                      </>
                    ) : (
                      <>
                        Se exportarán{' '}
                        <Box component="span" sx={{ fontWeight: 700 }}>todos los registros disponibles</Box>.
                      </>
                    )}
                  </Typography>
                </Box>
              );
            })()}
          </Box>

          <Divider />

          <FormControlLabel
            control={<Checkbox checked={detallada} onChange={(e) => setDetallada(e.target.checked)} sx={{ color: AZUL, '&.Mui-checked': { color: AZUL } }} />}
            label={
              <Box>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Descarga detallada</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Incluye el motivo del cambio, la observación/nota y la hora inicial de cada evento editado.
                </Typography>
              </Box>
            }
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" disabled={exportando} sx={{ borderRadius: 2, fontWeight: 600, color: '#475569', borderColor: '#cbd5e1', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>
          Cancelar
        </Button>
        <Button
          onClick={handleExportar}
          variant="contained"
          disableElevation
          disabled={!puedeExportar}
          startIcon={exportando ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <FileDownloadIcon />}
          sx={{ bgcolor: AZUL, borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#003a6b' } }}
        >
          {exportando ? 'Exportando…' : 'Exportar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
