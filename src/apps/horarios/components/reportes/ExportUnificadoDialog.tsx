import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Autocomplete, TextField, Checkbox, FormControlLabel, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Chip, Tabs, Tab, IconButton
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import StorefrontIcon from '@mui/icons-material/Storefront';
import DateRangeIcon from '@mui/icons-material/DateRange';
import HistoryIcon from '@mui/icons-material/History';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import {
  getStores,
  getEmpleadosBulk,
  getTimeRecordsBulkRange,
  fetchTimeRecordsExport,
  getReasonNamesForRecords,
  fetchNewnessReportsExport,
  fetchEventReportsExport,
  getStoreClosedDays
} from '../../api/directus/read';
import { exportarSemanalExcel } from '../../utils/exportarSemanal';
import { exportarHistorialExcel } from '../../utils/exportarHistorial';
import { exportarNovedadesExcel } from '../../utils/exportarNovedades';
import { exportarEventosExcel } from '../../utils/exportarEventos';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import DateRangeFilter from './DateRangeFilter';
import { DIAS_DE_LA_SEMANA } from '../../pages/reporte/ReporteUtils';
import { useHorariosPolicies } from '../../hooks/useHorariosPolicies';
import { useAuth } from '@/auth/hooks/useAuth';
import { obtenerTiendasIdsUsuarioActual } from '@/services/directus/userStores';
import type { Tienda } from '../../interfaces/tiendas';

export interface ExportUnificadoDialogProps {
  open: boolean;
  onClose: () => void;
  tabInicial?: 'semanal' | 'registros' | 'novedades' | 'pausas';
  storeSel?: number | null;
  rangoInicioDefault?: Dayjs | null;
  rangoFinDefault?: Dayjs | null;
  searchNombre?: string;
  tiendasPermitidas?: Tienda[];
  diaInicioSemana?: number;
  diaFinSemana?: number;
}

export default function ExportUnificadoDialog({
  open,
  onClose,
  tabInicial = 'registros',
  storeSel,
  rangoInicioDefault,
  rangoFinDefault,
  searchNombre = '',
  tiendasPermitidas,
  diaInicioSemana = 1,
  diaFinSemana = 0,
}: ExportUnificadoDialogProps) {
  const { showSnackbar } = useGlobalSnackbar();
  const { esAdmin: originalEsAdmin, esReport, esAreaManager } = useHorariosPolicies();
  const esAdmin = () => originalEsAdmin() || esReport();
  const isAreaMgr = esAreaManager ? esAreaManager() : false;
  const { user: _user } = useAuth();

  const getTabIndexFromNombre = (nombre: string): number => {
    switch (nombre) {
      case 'registros': return 0;
      case 'novedades': return 1;
      case 'pausas': return 2;
      case 'semanal': return 3;
      default: return 0;
    }
  };

  const [tabIndex, setTabIndex] = useState<number>(getTabIndexFromNombre(tabInicial));
  const [exportando, setExportando] = useState(false);

  // Estados de Filtros
  const [rangoInicio, setRangoInicio] = useState<Dayjs | null>(rangoInicioDefault || dayjs().subtract(6, 'day'));
  const [rangoFin, setRangoFin] = useState<Dayjs | null>(rangoFinDefault || dayjs());
  const [tiendasSel, setTiendasSel] = useState<Tienda[]>([]);
  const [todas, setTodas] = useState(true);

  // Opciones específicas por pestaña
  const [diaInicio, setDiaInicio] = useState<number>(diaInicioSemana);
  const [diaFin, setDiaFin] = useState<number>(diaFinSemana);
  const [detallada, setDetallada] = useState(false);
  const [todasNovedades, setTodasNovedades] = useState(false);

  const [modoGranularidad, setModoGranularidad] = useState<'semanal' | 'diario'>('semanal');

  const { data: todasLasTiendas = [], isLoading: loadingTiendas } = useQuery<Tienda[]>({
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
    ? todasLasTiendas.filter(t => {
        const idsPermitidos = tiendasAcceso.map(id => {
          if (id && typeof id === 'object') {
            return Number((id as any).id ?? (id as any).store_id);
          }
          return Number(id);
        }).filter(id => Boolean(id) && Number(id) !== 5);
        return idsPermitidos.includes(Number(t.id)) && Number(t.id) !== 5;
      })
    : todasLasTiendas;

  const tiendas = (tiendasPermitidas && tiendasPermitidas.length > 0)
    ? tiendasPermitidas
    : tiendasFiltradas;

  useEffect(() => {
    if (open) {
      setTabIndex(getTabIndexFromNombre(tabInicial));
      if (rangoInicioDefault) setRangoInicio(rangoInicioDefault);
      if (rangoFinDefault) setRangoFin(rangoFinDefault);
      setDiaInicio(diaInicioSemana);
      setDiaFin(diaFinSemana);

      if (storeSel !== null && storeSel !== undefined && tiendas.length > 0) {
        const t = tiendas.find(x => Number(x.id) === Number(storeSel));
        if (t) {
          setTodas(false);
          setTiendasSel([t]);
        } else {
          setTodas(true);
          setTiendasSel(tiendas);
        }
      } else if (tiendas.length > 0) {
        setTodas(true);
        setTiendasSel(tiendas);
      }
    }
  }, [open, tabInicial, storeSel, tiendas, rangoInicioDefault, rangoFinDefault, diaInicioSemana, diaFinSemana]);



  // --- Exportar Horas Semanales ---
  const handleExportSemanal = async () => {
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
        fetchNewnessReportsExport(startStr, endStr, storeIdsToFetch, esAdmin()),
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
    } catch (err: any) {
      console.error('Error al exportar reporte semanal:', err);
      showSnackbar(err?.message || 'Error al generar la exportación en Excel', 'error');
    } finally {
      setExportando(false);
    }
  };

  // --- Exportar Historial de Registros ---
  const handleExportRegistros = async () => {
    const storeIdsToFetch = todas || tiendasSel.length === 0 ? tiendas.map(t => Number(t.id)) : tiendasSel.map(t => Number(t.id));

    setExportando(true);
    try {
      const iniStr = rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined;
      const finStr = rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined;

      const records = await fetchTimeRecordsExport(iniStr, finStr, storeIdsToFetch);
      if (records.length === 0) {
        showSnackbar('No hay registros de marcación en el rango seleccionado', 'info');
      }

      let reasonsMap = new Map<number, string>();
      if (detallada && records.length > 0) {
        const recordIds = records.map((r) => r.id);
        reasonsMap = await getReasonNamesForRecords(recordIds);
      }

      let dataFinal = records;
      if (searchNombre) {
        const searchLower = searchNombre.toLowerCase();
        dataFinal = records.filter((r) => {
          const first = r.employee_id?.first_name || '';
          const middle = r.employee_id?.middle_name || '';
          const last = r.employee_id?.last_name || '';
          const second = r.employee_id?.second_last_name || '';
          const full = [first, middle, last, second].filter(Boolean).join(' ').toLowerCase();
          return full.includes(searchLower);
        });
      }

      await exportarHistorialExcel({
        records: dataFinal,
        stores: tiendas,
        reasonsMap,
        detallada
      });
      showSnackbar('Historial de registros exportado exitosamente', 'success');
      onClose();
    } catch (err: any) {
      console.error('Error al exportar registros:', err);
      showSnackbar('Error al exportar los registros', 'error');
    } finally {
      setExportando(false);
    }
  };

  // --- Exportar Novedades ---
  const handleExportNovedades = async () => {
    const storeIdsToFetch = todas || tiendasSel.length === 0 ? tiendas.map(t => Number(t.id)) : tiendasSel.map(t => Number(t.id));

    setExportando(true);
    try {
      const iniStr = !todasNovedades && rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined;
      const finStr = !todasNovedades && rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined;

      const reports = await fetchNewnessReportsExport(iniStr, finStr, storeIdsToFetch);
      if (reports.length === 0) {
        showSnackbar('No hay novedades en el rango seleccionado', 'info');
      }

      let dataFinal = reports;
      if (searchNombre) {
        const searchLower = searchNombre.toLowerCase();
        dataFinal = reports.filter((r) => {
          const emp = r.employee_id;
          if (!emp) return false;
          const full = [emp.first_name, emp.middle_name, emp.last_name, emp.second_last_name].filter(Boolean).join(' ').toLowerCase();
          return full.includes(searchLower);
        });
      }

      await exportarNovedadesExcel({
        reports: dataFinal,
        stores: tiendas
      });
      showSnackbar('Novedades exportadas exitosamente', 'success');
      onClose();
    } catch (err: any) {
      console.error('Error al exportar novedades:', err);
      showSnackbar('Error al exportar las novedades', 'error');
    } finally {
      setExportando(false);
    }
  };

  // --- Exportar Pausas Activas ---
  const handleExportPausas = async () => {
    const storeIdsToFetch = todas || tiendasSel.length === 0 ? tiendas.map(t => Number(t.id)) : tiendasSel.map(t => Number(t.id));

    setExportando(true);
    try {
      const iniStr = rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined;
      const finStr = rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined;

      const events = await fetchEventReportsExport(iniStr, finStr, storeIdsToFetch);
      if (events.length === 0) {
        showSnackbar('No hay pausas activas en el rango seleccionado', 'info');
      }

      let dataFinal = events;
      if (searchNombre) {
        const searchLower = searchNombre.toLowerCase();
        dataFinal = events.filter((r) => {
          const emp = r.employee_id;
          if (!emp) return false;
          const full = [emp.first_name, emp.middle_name, emp.last_name, emp.second_last_name].filter(Boolean).join(' ').toLowerCase();
          return full.includes(searchLower);
        });
      }

      await exportarEventosExcel({
        reports: dataFinal,
        stores: tiendas
      });
      showSnackbar('Pausas activas exportadas exitosamente', 'success');
      onClose();
    } catch (err: any) {
      console.error('Error al exportar pausas activas:', err);
      showSnackbar('Error al exportar las pausas activas', 'error');
    } finally {
      setExportando(false);
    }
  };

  const handleExportarActual = () => {
    switch (tabIndex) {
      case 0:
        handleExportRegistros();
        break;
      case 1:
        handleExportNovedades();
        break;
      case 2:
        handleExportPausas();
        break;
      case 3:
        handleExportSemanal();
        break;
    }
  };

  return (
    <Dialog open={open} onClose={exportando ? undefined : onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, overflow: 'hidden', width: '100%', maxWidth: 750 } } }}>
      <DialogTitle sx={{ bgcolor: '#004680', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FileDownloadIcon sx={{ fontSize: 26 }} />
          <Typography variant="h6" fontWeight={700}>
            Exportar Reportes a Excel
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={exportando} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Pestañas dentro del Modal */}
      <Tabs
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: '#f8fafc',
          px: 1,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.85rem' },
          '& .Mui-selected': { color: '#004680' },
          '& .MuiTabs-indicator': { bgcolor: '#004680', height: 3 }
        }}
      >
        <Tab label="Historial de Registros" icon={<HistoryIcon fontSize="small" />} iconPosition="start" />
        <Tab label="Novedades" icon={<AssignmentIcon fontSize="small" />} iconPosition="start" />
        <Tab label="Pausas Activas" icon={<PauseCircleIcon fontSize="small" />} iconPosition="start" />
        <Tab label="Horas Semanales" icon={<DateRangeIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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

        {/* Rango de Fechas */}
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

        {/* Contenido Específico por Pestaña */}
        {tabIndex === 0 && (
          <FormControlLabel
            control={
              <Checkbox
                checked={detallada}
                onChange={(e) => setDetallada(e.target.checked)}
                sx={{ color: '#004680', '&.Mui-checked': { color: '#004680' } }}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#334155' }}>
                Vista detallada (incluir columna de motivos de modificación)
              </Typography>
            }
          />
        )}

        {tabIndex === 1 && (
          <FormControlLabel
            control={
              <Checkbox
                checked={todasNovedades}
                onChange={(e) => setTodasNovedades(e.target.checked)}
                sx={{ color: '#004680', '&.Mui-checked': { color: '#004680' } }}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#334155' }}>
                Incluir todo el histórico de novedades (omitir filtro de rango de fecha)
              </Typography>
            }
          />
        )}

        {tabIndex === 3 && (
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
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between', borderTop: '1px solid #eef2f6', pt: 2 }}>
        <Button onClick={onClose} disabled={exportando} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleExportarActual}
          disabled={exportando}
          variant="contained"
          startIcon={exportando ? <CircularProgress size={18} color="inherit" /> : <FileDownloadIcon />}
          sx={{
            bgcolor: '#004680',
            color: '#fff',
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 'bold',
            px: 3,
            '&:hover': { bgcolor: '#003366' },
          }}
        >
          {exportando ? 'Generando Excel...' : 'Exportar Excel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
