import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Autocomplete, TextField, Checkbox, FormControlLabel, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Chip
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import StorefrontIcon from '@mui/icons-material/Storefront';
import DateRangeIcon from '@mui/icons-material/DateRange';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { getStores, getEmpleadosBulk, getTimeRecordsBulkRange, fetchNewnessReportsExport, getStoreClosedDays } from '../../api/directus/read';
import { exportarSemanalExcel } from '../../utils/exportarSemanal';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import DateRangeFilter from './DateRangeFilter';
import { DIAS_DE_LA_SEMANA } from '../../pages/reporte/ReporteUtils';
import type { Tienda } from '../../interfaces/tiendas';
import { mensajeDeError } from '../../utils/errores';

interface ExportSemanalDialogProps {
  open: boolean;
  onClose: () => void;
  fechaInicioDefault?: Dayjs | null;
  fechaFinDefault?: Dayjs | null;
  tiendasPermitidas?: Tienda[];
  diaInicioSemana?: number;
  diaFinSemana?: number;
}

export default function ExportSemanalDialog({
  open,
  onClose,
  fechaInicioDefault,
  fechaFinDefault,
  tiendasPermitidas,
  diaInicioSemana = 1,
  diaFinSemana = 0,
}: ExportSemanalDialogProps) {
  const { showSnackbar } = useGlobalSnackbar();
  const [tiendasSel, setTiendasSel] = useState<Tienda[]>([]);
  const [todas, setTodas] = useState(true);
  const [rangoInicio, setRangoInicio] = useState<Dayjs | null>(fechaInicioDefault || dayjs().subtract(6, 'day'));
  const [rangoFin, setRangoFin] = useState<Dayjs | null>(fechaFinDefault || dayjs());
  const [diaInicio, setDiaInicio] = useState<number>(diaInicioSemana);
  const [diaFin, setDiaFin] = useState<number>(diaFinSemana);
  const [modoGranularidad, setModoGranularidad] = useState<'semanal' | 'diario'>('semanal');
  const [exportando, setExportando] = useState(false);

  const { data: todasLasTiendas = [], isLoading: loadingTiendas } = useQuery<Tienda[]>({
    queryKey: ['adminTiendas'],
    queryFn: getStores,
    staleTime: 30 * 60 * 1000,
    enabled: open && (!tiendasPermitidas || tiendasPermitidas.length === 0),
  });

  const tiendas = (tiendasPermitidas && tiendasPermitidas.length > 0)
    ? tiendasPermitidas
    : todasLasTiendas;

  // Solo al abrir el diálogo inicializamos las tiendas y fechas
  useEffect(() => {
    if (open) {
      if (fechaInicioDefault) setRangoInicio(fechaInicioDefault);
      if (fechaFinDefault) setRangoFin(fechaFinDefault);
      setDiaInicio(diaInicioSemana);
      setDiaFin(diaFinSemana);

      if (tiendas.length > 0) {
        setTodas(true);
        setTiendasSel(tiendas);
      }
    }
  }, [open, tiendas, fechaInicioDefault, fechaFinDefault, diaInicioSemana, diaFinSemana]);



  const handleExport = async () => {
    if (!rangoInicio || !rangoFin) {
      showSnackbar('Por favor, selecciona una fecha de inicio y de fin', 'warning');
      return;
    }

    if (rangoFin.isBefore(rangoInicio, 'day')) {
      showSnackbar('La fecha de fin debe ser posterior a la fecha de inicio', 'warning');
      return;
    }

    const tiendasAExportar = todas || tiendasSel.length === 0 ? tiendas : tiendasSel;
    if (tiendasAExportar.length === 0) {
      showSnackbar('Por favor, selecciona al menos una tienda para exportar', 'warning');
      return;
    }

    const storeIdsToFetch = tiendasAExportar.map(t => Number(t.id));
    const tiendaNombre = todas || tiendasSel.length === tiendas.length
      ? 'Consolidado General - Todas las Tiendas'
      : tiendasAExportar.length === 1
        ? tiendasAExportar[0].name
        : `${tiendasAExportar.length} Tiendas Seleccionadas`;

    setExportando(true);
    try {
      const startStr = rangoInicio.format('YYYY-MM-DD');
      const endStr = rangoFin.format('YYYY-MM-DD');

      const [empleados, records, novedades, storeClosedDays] = await Promise.all([
        getEmpleadosBulk(storeIdsToFetch),
        getTimeRecordsBulkRange(storeIdsToFetch, startStr, endStr),
        fetchNewnessReportsExport(startStr, endStr, storeIdsToFetch),
        getStoreClosedDays(storeIdsToFetch, startStr, endStr),
      ]);

      if (empleados.length === 0) {
        showSnackbar('No hay empleados registrados para el período y tiendas seleccionadas', 'info');
      }

      await exportarSemanalExcel({
        tiendaNombre,
        fechaInicio: rangoInicio,
        fechaFin: rangoFin,
        empleados,
        records,
        novedades,
        storeClosedDays,
        tiendas,
        diaInicioSemana: diaInicio,
        diaFinSemana: diaFin,
        modoGranularidad,
      });

      showSnackbar('Reporte semanal exportado exitosamente', 'success');
      onClose();
    } catch (err) {
      console.error('Error al exportar reporte semanal:', err);
      showSnackbar(mensajeDeError(err, 'Error al generar la exportación en Excel'), 'error');
    } finally {
      setExportando(false);
    }
  };

  return (
    <Dialog open={open} onClose={exportando ? undefined : onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ bgcolor: '#004680', color: '#fff', display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
        <DateRangeIcon sx={{ fontSize: 26 }} />
        <Typography variant="h6" fontWeight={700}>
          Exportar Horas Semanales / Quincena
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Typography variant="body2" color="text.secondary">
          Selecciona una o varias tiendas y el rango de fechas (ej. quincena del 11 al 25) para generar la exportación en Excel.
        </Typography>

        {/* Selección Múltiple de Tiendas */}
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.5px', color: '#6b7280', mb: 1 }}>
            TIENDAS A EXPORTAR
          </Typography>
          <Autocomplete
            multiple
            size="small"
            options={tiendas}
            loading={loadingTiendas}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => Number(o.id) === Number(v.id)}
            value={todas ? tiendas : tiendasSel}
            onChange={(_, newValue) => {
              if (newValue.length === tiendas.length) {
                setTodas(true);
                setTiendasSel(tiendas);
              } else {
                setTodas(false);
                setTiendasSel(newValue);
              }
            }}
            renderValue={(value, getItemProps) => {
              if (!value || value.length === 0) return null;
              const limit = 2;
              const visible = value.slice(0, limit);
              const remaining = value.length - limit;
              return (
                <>
                  {visible.map((option, index) => {
                    const { key, ...tagProps } = getItemProps({ index });
                    return (
                      <Chip
                        key={key || option.id}
                        {...tagProps}
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: '#e2e8f0', color: '#1e293b', fontWeight: 400, my: '2px' }}
                      />
                    );
                  })}
                  {remaining > 0 && (
                    <Chip
                      size="small"
                      label={`+${remaining}`}
                      sx={{ bgcolor: '#cbd5e1', color: '#334155', fontWeight: 500, my: '2px' }}
                    />
                  )}
                </>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={todas || tiendasSel.length > 0 ? '' : 'Buscar y seleccionar tiendas...'}
                slotProps={{
                  input: {
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <StorefrontIcon sx={{ fontSize: 18, color: '#004680', ml: 0.5, mr: 0.5 }} />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: '#f1f7fe'
                  }
                }}
              />
            )}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={todas}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setTodas(checked);
                  if (checked) {
                    setTiendasSel(tiendas);
                  } else {
                    setTiendasSel([]);
                  }
                }}
                sx={{ color: '#004680', '&.Mui-checked': { color: '#004680' } }}
              />
            }
            label={<Typography sx={{ fontSize: '0.85rem', fontWeight: 400, color: '#374151' }}>Todas las tiendas</Typography>}
            sx={{ mt: 0.5 }}
          />
        </Box>

        {/* Rango de Fechas (ej: 11/07/2026 - 25/07/2026) */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', mb: 1, display: 'block' }}>
            PERÍODO A EXPORTAR:
          </Typography>
          <DateRangeFilter
            fechaInicio={rangoInicio}
            fechaFin={rangoFin}
            onChange={(inicio, fin) => {
              setRangoInicio(inicio);
              setRangoFin(fin);
            }}
          />
        </Box>

        {/* Formato de Detalle y Estructura */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', mb: 1, display: 'block' }}>
              FORMATO DE DETALLE EN EXCEL:
            </Typography>
            <FormControl size="small" fullWidth>
              <Select
                value={modoGranularidad}
                onChange={(e) => setModoGranularidad(e.target.value as 'semanal' | 'diario')}
                sx={{ borderRadius: 2, bgcolor: '#fff', fontSize: '0.875rem' }}
              >
                <MenuItem value="semanal">Acumulado por Semanas (Semana 1, Semana 2...)</MenuItem>
                <MenuItem value="diario">Detalle Día a Día (Celda por cada día + Novedades)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {modoGranularidad === 'semanal' ? (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', mb: 1, display: 'block' }}>
                ESTRUCTURA DE SEMANA:
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="export-dia-inicio-label">Inicio Semana</InputLabel>
                  <Select
                    labelId="export-dia-inicio-label"
                    value={diaInicio}
                    label="Inicio Semana"
                    onChange={(e) => setDiaInicio(Number(e.target.value))}
                    sx={{ borderRadius: 2 }}
                  >
                    {DIAS_DE_LA_SEMANA.map((d) => (
                      <MenuItem key={`exp-ini-${d.value}`} value={d.value}>{d.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel id="export-dia-fin-label">Fin Semana</InputLabel>
                  <Select
                    labelId="export-dia-fin-label"
                    value={diaFin}
                    label="Fin Semana"
                    onChange={(e) => setDiaFin(Number(e.target.value))}
                    sx={{ borderRadius: 2 }}
                  >
                    {DIAS_DE_LA_SEMANA.map((d) => (
                      <MenuItem key={`exp-fin-${d.value}`} value={d.value}>{d.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              {(() => {
                const nombreIni = DIAS_DE_LA_SEMANA.find(d => d.value === diaInicio)?.label || 'Lunes';
                const endDayVal = (diaInicio + 6) % 7;
                const nombreFinAuto = DIAS_DE_LA_SEMANA.find(d => d.value === endDayVal)?.label || 'Domingo';
                const nombreFin = DIAS_DE_LA_SEMANA.find(d => d.value === diaFin)?.label || 'Domingo';
                const totalDias = diaInicio === diaFin
                  ? 7
                  : (diaFin - diaInicio + (diaFin < diaInicio ? 7 : 0) + 1);
                const textoRango = diaInicio === diaFin
                  ? `${nombreIni} a ${nombreFinAuto} (7 días completos)`
                  : `${nombreIni} a ${nombreFin} (${totalDias} días por columna)`;
                return (
                  <Chip
                    icon={<InfoOutlinedIcon sx={{ fontSize: '1rem !important', color: '#0284c7 !important' }} />}
                    label={`Estructura: ${textoRango}`}
                    size="small"
                    sx={{
                      bgcolor: '#e0f2fe',
                      color: '#0369a1',
                      fontWeight: 600,
                      borderRadius: 2,
                      height: 32,
                      mt: 1.5,
                      fontSize: '0.78rem',
                      border: '1px solid #bae6fd'
                    }}
                  />
                );
              })()}
            </Box>
          ) : (
            <Chip
              icon={<InfoOutlinedIcon sx={{ fontSize: '1rem !important', color: '#0284c7 !important' }} />}
              label="Granularidad Día a Día: Generará una celda por cada día en el rango con horas laboradas y novedades (Descanso, Vacaciones, Licencias)."
              size="small"
              sx={{
                bgcolor: '#e0f2fe',
                color: '#0369a1',
                fontWeight: 600,
                borderRadius: 2,
                height: 'auto',
                py: 1,
                fontSize: '0.78rem',
                border: '1px solid #bae6fd',
                '& .MuiChip-label': { whiteSpace: 'normal' }
              }}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={exportando} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={exportando}
          startIcon={exportando ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <FileDownloadIcon />}
          sx={{
            bgcolor: '#004680',
            '&:hover': { bgcolor: '#003366' },
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            px: 3,
          }}
        >
          {exportando ? 'Generando Excel...' : 'Descargar Excel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
