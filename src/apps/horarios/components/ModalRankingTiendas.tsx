import { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, IconButton, TextField, InputAdornment,
  Button, Chip, Avatar, List, ListItem, ListItemAvatar,
  ListItemText, Badge, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, FormControl,
  InputLabel, Select, MenuItem, OutlinedInput, CircularProgress
} from '@mui/material';
import {
  Storefront as StorefrontIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  Sort as SortIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  CalendarToday as CalendarTodayIcon,
  ArrowBackIos as ArrowBackIosIcon,
  ArrowForwardIos as ArrowForwardIosIcon,
  Visibility as VisibilityIcon,
  Message as MessageIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { COLUMNAS_EDICIONES, rowsPerPage, getColorForMotivo } from '../pages/monitoreo/MonitoreoUtils';
import { Paginador } from '../pages/monitoreo/MonitoreoComponents';
import type { RegistroEditado } from '../interfaces/ui/monitoreo';


// Misma forma que devuelve getEditedTimeRecords (antes, una copia local `EditedRecord`).
type EditedRecord = RegistroEditado;


interface ModalRankingTiendasProps {
  open: boolean;
  onClose: () => void;
  editedRecords: EditedRecord[];
  rankingMesTiendas: Dayjs;
  setRankingMesTiendas: (date: Dayjs) => void;
  isLoading?: boolean;
}


export default function ModalRankingTiendas({
  open,
  onClose,
  editedRecords,
  rankingMesTiendas,
  setRankingMesTiendas,
  isLoading = false
}: ModalRankingTiendasProps) {
  const [buscarTiendaRanking, setBuscarTiendaRanking] = useState('');
  const [ordenTiendasRanking, setOrdenTiendasRanking] = useState<'asc' | 'desc'>('desc');
  const [paginaTiendasRanking, setPaginaTiendasRanking] = useState(0);
  const [tiendaEdicionesRanking, setTiendaEdicionesRanking] = useState<{ id: number, nombre: string } | null>(null);
  const [paginaEdicionesTiendaRanking, setPaginaEdicionesTiendaRanking] = useState(0);
  const [motivosFiltro, setMotivosFiltro] = useState<string[]>([]);


  // Al cerrar el modal o cambiar de mes, resetear la tienda seleccionada y regresar al listado principal
  useEffect(() => {
    if (!open) {
      setTiendaEdicionesRanking(null);
      setPaginaEdicionesTiendaRanking(0);
      setPaginaTiendasRanking(0);
      setBuscarTiendaRanking('');
    }
  }, [open]);


  useEffect(() => {
    setTiendaEdicionesRanking(null);
    setPaginaEdicionesTiendaRanking(0);
    setPaginaTiendasRanking(0);
  }, [rankingMesTiendas]);


  // Motivos únicos globales (filtrados estrictamente por el mes actual)
  const motivosUnicosGlobales = useMemo(() => {
    const s = new Set<string>();
    editedRecords.forEach(r => {
      if (dayjs(r.fecha).isSame(rankingMesTiendas, 'month')) {
        const m = r.motivo?.trim() || 'Sin motivo';
        s.add(m);
      }
    });
    return Array.from(s).sort();
  }, [editedRecords, rankingMesTiendas]);


  // Ranking de tiendas (con filtro de motivos y cuenta exacta)
  const rankingTiendasBase = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string; total: number }>();
    editedRecords.forEach(r => {
      const coincideMes = dayjs(r.fecha).isSame(rankingMesTiendas, 'month');
      const motivoStr = r.motivo?.trim() || 'Sin motivo';
      const coincideMotivo = motivosFiltro.length === 0 || motivosFiltro.includes(motivoStr);
     
      if (coincideMes && coincideMotivo) {
        const tiendaId = r.tiendaId || 0;
        if (!map.has(tiendaId)) map.set(tiendaId, { id: tiendaId, nombre: r.tiendaNombre, total: 0 });
        map.get(tiendaId)!.total += 1;
      }
    });
    return Array.from(map.values());
  }, [editedRecords, rankingMesTiendas, motivosFiltro]);


  const rankingTiendasOrdenado = useMemo(() => {
    const ordenados = [...rankingTiendasBase];
    ordenados.sort((a, b) => (ordenTiendasRanking === 'asc' ? a.total - b.total : b.total - a.total));
    return ordenados;
  }, [rankingTiendasBase, ordenTiendasRanking]);


  const rankingTiendasFiltrado = useMemo(() => {
    if (!buscarTiendaRanking.trim()) return rankingTiendasOrdenado;
    return rankingTiendasOrdenado.filter(t => t.nombre.toLowerCase().includes(buscarTiendaRanking.toLowerCase().trim()));
  }, [rankingTiendasOrdenado, buscarTiendaRanking]);


  const totalEdicionesGenerales = useMemo(() => {
    return rankingTiendasFiltrado.reduce((acc, t) => acc + t.total, 0);
  }, [rankingTiendasFiltrado]);


  // Ediciones de la tienda seleccionada (con filtro exacto de motivos)
  const edicionesDeTiendaRanking = useMemo(() => {
    if (!tiendaEdicionesRanking) return [];
    return editedRecords.filter(r => {
      const motivoStr = r.motivo?.trim() || 'Sin motivo';
      return r.tiendaId === tiendaEdicionesRanking.id &&
             dayjs(r.fecha).isSame(rankingMesTiendas, 'month') &&
             (motivosFiltro.length === 0 || motivosFiltro.includes(motivoStr));
    });
  }, [editedRecords, tiendaEdicionesRanking, rankingMesTiendas, motivosFiltro]);


  const edicionesDeTiendaRankingPagina = useMemo(() => {
    const start = paginaEdicionesTiendaRanking * rowsPerPage.ediciones;
    return edicionesDeTiendaRanking.slice(start, start + rowsPerPage.ediciones);
  }, [edicionesDeTiendaRanking, paginaEdicionesTiendaRanking]);


  // Desglose riguroso por MOTIVO
  const resumenPorMotivo = useMemo(() => {
    const motivos: Record<string, number> = {};
    edicionesDeTiendaRanking.forEach(r => {
      const m = r.motivo?.trim() || 'Sin motivo';
      motivos[m] = (motivos[m] || 0) + 1;
    });
    return motivos;
  }, [edicionesDeTiendaRanking]);


  const maxTotal = rankingTiendasFiltrado.length ? Math.max(...rankingTiendasFiltrado.map(t => t.total)) : 0;


  const handleCambiarMes = (nuevoMes: Dayjs) => {
    setRankingMesTiendas(nuevoMes);
    setPaginaTiendasRanking(0);
    setTiendaEdicionesRanking(null);
  };


  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            height: '90vh',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        }
      }}
    >
      <DialogTitle sx={{ bgcolor: '#004680', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, px: 3, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {tiendaEdicionesRanking ? (
            <>
              <IconButton onClick={() => setTiendaEdicionesRanking(null)} sx={{ color: '#ffffff', p: 0.5 }}>
                <ArrowBackIosIcon fontSize="small" />
              </IconButton>
              <StorefrontIcon sx={{ fontSize: 26 }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.3rem' }}>
                Ediciones en {tiendaEdicionesRanking.nombre}
              </Typography>
            </>
          ) : (
            <>
              <StorefrontIcon sx={{ fontSize: 28 }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.4rem' }}>
                Ranking de Tiendas
              </Typography>
              <Chip
                label={`${rankingTiendasFiltrado.length} tiendas`}
                size="small"
                sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem' }}
              />
            </>
          )}
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#ffffff' }}><CloseIcon /></IconButton>
      </DialogTitle>


      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!tiendaEdicionesRanking ? (
          // ---- VISTA LISTADO DE TIENDAS ----
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 3, pt: 2.5, pb: 2, flexShrink: 0, borderBottom: '1px solid #e0e0e0' }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  label="Buscar tienda"
                  placeholder="Escribe el nombre..."
                  value={buscarTiendaRanking}
                  onChange={(e) => { setBuscarTiendaRanking(e.target.value); setPaginaTiendasRanking(0); }}
                  size="medium"
                  sx={{ flex: 1, minWidth: 220 }}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start"><SearchIcon fontSize="medium" sx={{ color: '#94a3b8' }} /></InputAdornment>,
                      endAdornment: buscarTiendaRanking ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => { setBuscarTiendaRanking(''); setPaginaTiendasRanking(0); }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null
                    }
                  }}
                />
                <Tooltip title={ordenTiendasRanking === 'desc' ? 'Ordenar de menor a mayor' : 'Ordenar de mayor a menor'}>
                  <Button
                    variant="outlined"
                    size="medium"
                    onClick={() => { setOrdenTiendasRanking(p => p === 'asc' ? 'desc' : 'asc'); setPaginaTiendasRanking(0); }}
                    sx={{ textTransform: 'none', borderColor: '#004680', color: '#004680', borderRadius: 2, fontWeight: 600 }}
                  >
                    <SortIcon fontSize="small" />
                    {ordenTiendasRanking === 'desc' ? 'Mayor a menor' : 'Menor a mayor'}
                    {ordenTiendasRanking === 'desc' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
                  </Button>
                </Tooltip>
              </Box>


              {/* Fila reorganizada: Calendario -> Filtro de Motivos -> Conteo Total */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #d0d7de', borderRadius: 2, px: 2, py: 0.75, bgcolor: '#ffffff' }}>
                  <CalendarTodayIcon sx={{ color: '#004680', fontSize: 20, mr: 1 }} />
                  <Typography variant="body1" fontWeight={600} color="#004680" sx={{ textTransform: 'capitalize', minWidth: 150 }}>
                    {rankingMesTiendas.format('MMMM YYYY')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => handleCambiarMes(rankingMesTiendas.subtract(1, 'month'))} sx={{ color: '#004680', p: 0.5 }}>
                      <ArrowBackIosIcon fontSize="small" sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleCambiarMes(rankingMesTiendas.add(1, 'month'))}
                      disabled={rankingMesTiendas.isSame(dayjs(), 'month')}
                      sx={{ color: '#004680', p: 0.5 }}
                    >
                      <ArrowForwardIosIcon fontSize="small" sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>


                <FormControl size="small" sx={{ minWidth: 300, flex: 1, '& .MuiOutlinedInput-notchedOutline': { borderColor: motivosFiltro.length > 0 ? '#004680' : '#d0d7de', borderWidth: motivosFiltro.length > 0 ? '2px' : '1px' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#004680' } }}>
                  <InputLabel id="motivos-filtro-label">Filtrar por Motivos</InputLabel>
                  <Select
                    labelId="motivos-filtro-label"
                    multiple
                    value={motivosFiltro}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (Array.isArray(value) && value.includes('limpiar')) { setMotivosFiltro([]); setPaginaTiendasRanking(0); return; }
                      if (Array.isArray(value) && value.includes('todos')) setMotivosFiltro(motivosUnicosGlobales);
                      else setMotivosFiltro(typeof value === 'string' ? value.split(',') : value);
                      setPaginaTiendasRanking(0);
                    }}
                    input={<OutlinedInput label="Filtrar por Motivos" endAdornment={motivosFiltro.length > 0 ? <InputAdornment position="end"><IconButton size="small" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMotivosFiltro([]); setPaginaTiendasRanking(0); }} onMouseDown={(e) => e.stopPropagation()} sx={{ p: 0.5, mr: 0.5 }}><CloseIcon fontSize="small" sx={{ color: '#64748b' }} /></IconButton></InputAdornment> : null} sx={{ borderRadius: 2 }} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 60, overflow: 'auto' }}>
                        {selected.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Todos los motivos</Typography> :
                          selected.map((value) => {
                            const colors = getColorForMotivo(value);
                            return <Box key={value} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: colors.bg, color: colors.text, pl: 1, pr: 0.5, py: 0.25, borderRadius: 1, height: '24px', cursor: 'default' }} onMouseDown={(e) => e.stopPropagation()}>
                              <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem' }}>{value}</Typography>
                              <Box component="span" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: '50%', '&:hover': { bgcolor: 'rgba(0,0,0,0.12)' } }}
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMotivosFiltro(motivosFiltro.filter(item => item !== value)); setPaginaTiendasRanking(0); }}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                                <CloseIcon sx={{ fontSize: '0.85rem', color: colors.text }} />
                              </Box>
                            </Box>;
                          })}
                      </Box>
                    )}
                    MenuProps={{
                      PaperProps: {
                        style: { maxHeight: 280, width: 280 },
                        sx: {
                          '& .MuiMenuItem-root.Mui-selected': { bgcolor: '#e3f2fd', '&:hover': { bgcolor: '#bbdefb' } },
                          '& .MuiMenuItem-root': { borderRadius: 1, mx: 0.5, my: 0.3 }
                        }
                      }
                    }}
                  >
                    <MenuItem value="todos" sx={{ fontWeight: 700, borderBottom: '1px solid #e0e0e0', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e8e8e8', border: '1px solid #9e9e9e' }} />Todos</Box>
                      {motivosFiltro.length === motivosUnicosGlobales.length && <CheckCircleIcon sx={{ color: '#004680', fontSize: 18 }} />}
                    </MenuItem>
                    <MenuItem value="limpiar" sx={{ fontWeight: 700, borderBottom: '1px solid #e0e0e0', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ffebee', border: '1px solid #c62828' }} />Limpiar</Box>
                      {motivosFiltro.length === 0 && <CheckCircleIcon sx={{ color: '#004680', fontSize: 18 }} />}
                    </MenuItem>
                    {motivosUnicosGlobales.map(motivo => (
                      <MenuItem key={motivo} value={motivo} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, fontWeight: motivosFiltro.includes(motivo) ? 700 : 400 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: getColorForMotivo(motivo).bg, border: `1px solid ${getColorForMotivo(motivo).text}` }} />
                          {motivo}
                        </Box>
                        {motivosFiltro.includes(motivo) && <CheckCircleIcon sx={{ color: '#004680', fontSize: 18 }} />}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>


                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', ml: 'auto', fontWeight: 500 }}>
                  {rankingTiendasFiltrado.length} tiendas con ediciones ({totalEdicionesGenerales} en total)
                </Typography>
              </Box>
            </Box>


            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
              {isLoading ? (
                <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={40} sx={{ color: '#004680' }} />
                  <Typography variant="body2" fontWeight={600} color="#004680">
                    Cargando ediciones del mes...
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {(() => {
                    const start = paginaTiendasRanking * rowsPerPage.ranking;
                    const pagina = rankingTiendasFiltrado.slice(start, start + rowsPerPage.ranking);
                    if (!pagina.length) {
                      return (
                        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                          {buscarTiendaRanking ? 'No se encontraron tiendas' : 'No hay ediciones registradas para los motivos seleccionados'}
                        </Box>
                      );
                    }
                    return pagina.map((tienda, index) => {
                    const isTop = tienda.total === maxTotal && maxTotal > 0;
                    return (
                      <ListItem
                        key={tienda.id}
                        divider
                        sx={{
                          py: 1.5,
                          px: 2.5,
                          '&:hover': { bgcolor: '#f5f7fa' },
                          bgcolor: index % 2 === 0 ? 'transparent' : '#fafbfc'
                        }}
                        secondaryAction={
                          <Tooltip title="Ver ediciones de esta tienda" arrow>
                            <IconButton
                              edge="end"
                              onClick={() => setTiendaEdicionesRanking({ id: tienda.id, nombre: tienda.nombre })}
                              sx={{
                                color: '#004680',
                                bgcolor: '#e3f2fd',
                                borderRadius: '50%',
                                p: 0.8,
                                '&:hover': { bgcolor: '#bbdefb', transform: 'scale(1.05)' },
                                transition: 'all 0.2s'
                              }}
                            >
                              <VisibilityIcon fontSize="medium" />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemAvatar>
                          <Badge
                            badgeContent={tienda.total}
                            color="primary"
                            sx={{
                              '& .MuiBadge-badge': {
                                bgcolor: isTop ? '#e65100' : '#004680',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                height: 20,
                                minWidth: 20,
                                borderRadius: '50%'
                              }
                            }}
                          >
                            <Avatar sx={{ bgcolor: isTop ? '#e65100' : '#004680', color: '#fff', width: 42, height: 42 }}>
                              <StorefrontIcon sx={{ fontSize: 24 }} />
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="h6" fontWeight={600} color="#0a1929" sx={{ fontSize: '1rem' }}>
                              {tienda.nombre}
                            </Typography>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                          secondary={
                            <Chip
                              component="span"
                              size="small"
                              label={`${tienda.total} edición${tienda.total !== 1 ? 'es' : ''}`}
                              sx={{
                                bgcolor: isTop ? '#fff3e0' : '#e1f5fe',
                                color: isTop ? '#e65100' : '#0288d1',
                                fontWeight: 600,
                                fontSize: '0.7rem'
                              }}
                            />
                          }
                        />
                      </ListItem>
                    );
                  });
                })()}
              </List>
              )}
            </Box>
            <Box sx={{ flexShrink: 0, bgcolor: 'white', borderTop: '1px solid #e0e0e0', p: 1 }}>
              <Paginador
                count={Math.ceil(rankingTiendasFiltrado.length / rowsPerPage.ranking)}
                page={paginaTiendasRanking}
                setPage={setPaginaTiendasRanking}
                label="tiendas"
                total={rankingTiendasFiltrado.length}
              />
            </Box>
          </>
        ) : (
          // ---- VISTA DETALLE DE TIENDA (con desglose exacto de motivos filtrados) ----
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: '#f8fafc',
                borderRadius: 2,
                border: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap'
              }}
            >
              <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ mr: 0.5 }}>
                Desglose:
              </Typography>
              {Object.entries(resumenPorMotivo).length > 0 ? (
                Object.entries(resumenPorMotivo).map(([motivo, count]) => {
                  const colors = getColorForMotivo(motivo);
                  return (
                    <Chip
                      key={motivo}
                      size="medium"
                      label={`${motivo}: ${count}`}
                      sx={{ bgcolor: colors.bg, color: colors.text, fontWeight: 600, fontSize: '0.75rem' }}
                    />
                  );
                })
              ) : (
                <Typography variant="body2" color="text.secondary">Sin registros para los motivos seleccionados</Typography>
              )}
              <Chip
                label={`Total: ${edicionesDeTiendaRanking.length}`}
                size="medium"
                sx={{ bgcolor: '#004680', color: '#ffffff', fontWeight: 700, fontSize: '0.75rem', ml: 'auto' }}
              />
            </Paper>


            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: 2,
                border: '1px solid #e0e0e0',
                flex: 1,
                overflow: 'auto',
                '& .MuiTableCell-root': { padding: '10px 14px' },
                '& .MuiTableRow-root:hover': { bgcolor: '#f5f7fa' }
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {COLUMNAS_EDICIONES.map(t => (
                      <TableCell
                        key={t}
                        sx={{
                          bgcolor: '#f8fafc',
                          fontWeight: 700,
                          color: '#546e7a',
                          fontSize: '0.85rem',
                          whiteSpace: 'nowrap'
                        }}
                        align={['HORA ORIG.', 'HORA MOD.', 'OBSERVACIONES'].includes(t) ? 'center' : 'left'}
                      >
                        {t}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {edicionesDeTiendaRankingPagina.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: '0.95rem' }}>No hay modificaciones para mostrar.</TableCell></TableRow>
                  ) : (
                    edicionesDeTiendaRankingPagina.map((r, index) => (
                      <TableRow key={r.id} hover sx={{ bgcolor: index % 2 === 0 ? 'transparent' : '#fafbfc' }}>
                        <TableCell><Typography variant="body1" fontWeight={600} color="#0a1929" sx={{ fontSize: '0.9rem' }}>{r.fecha}</Typography></TableCell>
                        <TableCell><Typography variant="body1" fontWeight={600} color="#0a1929" sx={{ fontSize: '0.9rem' }}>{r.empleadoNombre}</Typography></TableCell>
                        <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><StorefrontIcon fontSize="small" sx={{ color: '#64748b', fontSize: 18 }} /><Typography variant="body1" color="#0a1929" sx={{ fontSize: '0.9rem' }}>{r.tiendaNombre}</Typography></Box></TableCell>
                        <TableCell><Chip size="small" label={r.tipoRegistro} sx={{ bgcolor: '#f0f4f8', color: '#004680', fontWeight: 600, fontSize: '0.7rem' }} /></TableCell>
                        <TableCell align="center"><Typography variant="body1" color="text.secondary" sx={{ textDecoration: 'line-through', fontSize: '0.9rem' }}>{r.horaOriginal ? r.horaOriginal.substring(0, 5) : '--:--'}</Typography></TableCell>
                        <TableCell align="center"><Typography variant="body1" fontWeight={700} color="#c62828" sx={{ fontSize: '0.9rem' }}>{r.horaModificada ? r.horaModificada.substring(0, 5) : '--:--'}</Typography></TableCell>
                        <TableCell><Chip size="small" label={r.motivo} sx={{ bgcolor: '#ffebee', color: '#c62828', fontWeight: 600, fontSize: '0.7rem' }} /></TableCell>
                        <TableCell align="center">
                          {r.observaciones && r.observaciones.toLowerCase() !== 'sin comentarios' ? (
                            <Tooltip title={r.observaciones} arrow>
                              <IconButton size="small" sx={{ color: '#004680', bgcolor: '#e3f2fd', '&:hover': { bgcolor: '#bbdefb' }, p: 0.5 }}>
                                <MessageIcon fontSize="small" sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="#94a3b8" sx={{ fontStyle: 'italic', fontSize: '0.75rem' }}>Sin obs.</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                Mostrando {edicionesDeTiendaRankingPagina.length} de {edicionesDeTiendaRanking.length} modificaciones
              </Typography>
              <Paginador
                count={Math.ceil(edicionesDeTiendaRanking.length / rowsPerPage.ediciones)}
                page={paginaEdicionesTiendaRanking}
                setPage={setPaginaEdicionesTiendaRanking}
                label="modificaciones"
                total={edicionesDeTiendaRanking.length}
              />
            </Box>
          </Box>
        )}
      </DialogContent>


      <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
        {tiendaEdicionesRanking && (
          <Button
            onClick={() => setTiendaEdicionesRanking(null)}
            variant="outlined"
            startIcon={<ArrowBackIosIcon fontSize="small" />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              borderColor: '#004680',
              color: '#004680',
              mr: 'auto',
              fontSize: '0.85rem',
              '&:hover': { bgcolor: '#e3f2fd' }
            }}
          >
            Volver al listado
          </Button>
        )}
        <Button onClick={onClose} variant="contained" disableElevation sx={{ bgcolor: '#004680', textTransform: 'none', fontWeight: 600, borderRadius: 2, fontSize: '0.85rem', '&:hover': { bgcolor: '#003366' } }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
