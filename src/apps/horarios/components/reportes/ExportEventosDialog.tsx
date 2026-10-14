import { useState, useEffect } from 'react';
import { obtenerTiendasIdsUsuarioActual } from '@/services/directus/userStores';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, CircularProgress,
  Autocomplete, TextField, FormControlLabel, Checkbox
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { getStores, getStoreIdUsuarioActual, fetchEventReportsExport } from '../../api/directus/read';
import { exportarEventosExcel } from '../../utils/exportarEventos';
import { Tienda } from '../../interfaces/horarios.interface';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import { useHorariosPolicies } from '../../hooks/useHorariosPolicies';
import { horariosKeys } from '../../hooks/registro/keys';

const AZUL = '#004680';

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: number | null;
  fechaInicio?: string;
  fechaFin?: string;
}

export default function ExportEventosDialog({ open, onClose, storeId, fechaInicio, fechaFin }: Props) {
  const { showSnackbar } = useGlobalSnackbar();
  const { esAdmin: originalEsAdmin, esReport, esAreaManager } = useHorariosPolicies();
  const esAdmin = () => originalEsAdmin() || esReport();
  const isAreaMgr = esAreaManager ? esAreaManager() : false;
  const [exportando, setExportando] = useState(false);
  const [rangoInicio, setRangoInicio] = useState<Dayjs | null>(null);
  const [rangoFin, setRangoFin] = useState<Dayjs | null>(null);

  const [tiendasSel, setTiendasSel] = useState<Tienda[]>([]);

  useEffect(() => {
    if (open) { 
      setRangoInicio(fechaInicio ? dayjs(fechaInicio) : dayjs().subtract(6, 'day')); 
      setRangoFin(fechaFin ? dayjs(fechaFin) : dayjs()); 
      setTiendasSel([]);
    }
  }, [open, fechaInicio, fechaFin]);

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

  const { data: storeUsuario = null } = useQuery<number | null>({
    queryKey: horariosKeys.storeUsuario,
    queryFn: getStoreIdUsuarioActual,
    staleTime: 30 * 60 * 1000,
    enabled: open && storeId == null,
  });

  const tiendaEfectiva = storeId != null ? storeId : storeUsuario;
  const todas = tiendasFiltradas.length > 0 && tiendasSel.length === tiendasFiltradas.length;

  useEffect(() => {
    if (open && storeId != null && tiendas.length > 0) {
      const t = tiendas.find((x) => x.id === storeId);
      setTiendasSel(t ? [t] : []);
    }
  }, [open, tiendas, storeId]);

  const puedeExportar = (esAdmin() ? (todas || tiendasSel.length > 0 || (isAreaMgr && tiendasFiltradas.length > 0)) : tiendaEfectiva != null) && !exportando;

  const handleExportar = async () => {
    if (!puedeExportar) return;
    setExportando(true);
    try {
      const storeIds = isAreaMgr
        ? (todas || tiendasSel.length === 0
            ? tiendasFiltradas.map((t) => Number(t.id))
            : tiendasSel.map((t) => Number(t.id)))
        : (esAdmin()
          ? (todas ? undefined : tiendasSel.map((t) => Number(t.id)))
          : (tiendaEfectiva != null ? [Number(tiendaEfectiva)] : undefined));
      let fIni = rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined;
      let fFin = rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined;
      const reports = await fetchEventReportsExport(fIni, fFin, storeIds, esAdmin());
      const targetStores = isAreaMgr
        ? (todas || tiendasSel.length === 0 ? tiendasFiltradas : tiendasSel)
        : (esAdmin()
          ? (todas ? tiendasFiltradas : tiendasSel)
          : (tiendaEfectiva != null ? tiendas.filter((t) => Number(t.id) === Number(tiendaEfectiva)) : []));
      const res = await exportarEventosExcel({ reports, stores: targetStores });
      if (res.ok) {
        showSnackbar('Exportación generada con éxito', 'success');
        onClose();
      } else {
        showSnackbar(res.mensaje || 'No hay datos para exportar', 'error');
      }
    } catch (err: any) {
      showSnackbar(err?.message || 'Error al exportar los eventos', 'error');
    } finally {
      setExportando(false);
    }
  };

  return (
    <Dialog open={open} onClose={exportando ? undefined : onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      <DialogTitle component="div" sx={{ bgcolor: AZUL, color: '#fff', py: 2, px: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <FileDownloadIcon />
        <Box>
          <Typography component="span" variant="h6" sx={{ fontWeight: 600, display: 'block' }}>Exportar pausas activas</Typography>
          <Typography component="span" variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
            Reportes de pausas y eventos de la tienda
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
                            <StorefrontIcon sx={{ color: '#94a3b8', mr: 1, fontSize: 20 }} />
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      },
                    }}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.5, mt: 1.25, borderRadius: 2, bgcolor: c.bg, border: `1px solid ${c.border}` }}>
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
                        <Box component="span" sx={{ fontWeight: 700 }}>todas las pausas activas disponibles</Box>.
                      </>
                    )}
                  </Typography>
                </Box>
              );
            })()}
          </Box>
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
