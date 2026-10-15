import { useState, useMemo, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogActions,
    Box, Typography, Button, IconButton, TextField, InputAdornment,
    Checkbox, FormControlLabel, Chip, Divider, Tooltip,
    Tabs, Tab,
} from '@mui/material';
import {
    Close as CloseIcon,
    Search as SearchIcon,
    Storefront as StorefrontIcon,
    Block as BlockIcon,
    CheckCircle as CheckCircleIcon,
    LockOpen as LockOpenIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';

import { ConfirmCierreMasivoDialog } from './cierre-masivo/ConfirmCierreMasivoDialog';
import { setStoreClosedDayStatus } from '../api/directus/create';
import { getStoreClosedDays } from '../api/directus/read';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { StoreClosedDayDto } from '../interfaces/api/stores';
import { useHolidays } from '../../reservas/hooks/useHolidays';
import type { MapaFestivos } from '../interfaces/comunes';
import type { TiendaOpcion } from '../interfaces/tiendas';

interface ModalCierreMasivoProps {
    open: boolean;
    onClose: () => void;
    tiendas: TiendaOpcion[];
}

// ─── Day slot personalizado: festivos + multiselección ────────────────────────
interface MultiSelectDayProps extends PickersDayProps {
    holidays?: MapaFestivos;
    selectedDates?: Set<string>;
    modoAccion?: 'cerrar' | 'reabrir';
    tiendasCerradasPorFecha?: Map<string, string[]>;
}
function MultiSelectDay(props: MultiSelectDayProps) {
    const {
        holidays = {},
        selectedDates = new Set(),
        modoAccion = 'cerrar',
        tiendasCerradasPorFecha = new Map(),
        day,
        outsideCurrentMonth,
        ...other
    } = props;
    const dateStr = format(toNativeDate(day), 'yyyy-MM-dd');
    const holidayName = holidays[dateStr];
    const isHoliday = Boolean(holidayName) && !outsideCurrentMonth;
    const isSelected = selectedDates.has(dateStr) && !outsideCurrentMonth;

    const nombresTiendas = tiendasCerradasPorFecha.get(dateStr) || [];
    const isCurrentlyClosed = nombresTiendas.length > 0 && !outsideCurrentMonth;

    const bgSelected = modoAccion === 'cerrar' ? '#004680 !important' : '#2e7d32 !important';
    const bgSelectedHover = modoAccion === 'cerrar' ? '#003366 !important' : '#1b5e20 !important';

    let dayStyle: any = {};

    if (isSelected) {
        dayStyle = {
            backgroundColor: bgSelected,
            color: '#fff !important',
            borderRadius: '50%',
            fontWeight: 700,
            '&:hover': { backgroundColor: bgSelectedHover },
        };
    } else if (modoAccion === 'reabrir') {
        if (isCurrentlyClosed) {
            dayStyle = {
                backgroundColor: '#fff7ed',
                color: '#c2410c',
                border: '1.5px solid #f97316',
                fontWeight: 700,
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#ffedd5' },
            };
        } else {
            dayStyle = {
                opacity: 0.35,
                cursor: 'default',
            };
        }
    } else if (isHoliday) {
        dayStyle = {
            backgroundColor: '#fef2f2',
            '&:hover': { backgroundColor: '#fee2e2' },
        };
    }

    const dayEl = (
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <PickersDay
                {...other}
                day={day}
                outsideCurrentMonth={outsideCurrentMonth}
                selected={false}
                sx={[
                    dayStyle,
                    ...(Array.isArray(other.sx) ? other.sx : other.sx ? [other.sx] : []),
                ]}
            />
            {isHoliday && (
                <Box sx={{
                    position: 'absolute', top: 2, right: 2,
                    width: 5, height: 5, borderRadius: '50%',
                    backgroundColor: '#dc2626', pointerEvents: 'none',
                }} />
            )}
            {modoAccion === 'reabrir' && isCurrentlyClosed && !isSelected && (
                <Box sx={{
                    position: 'absolute', top: 2, left: 2,
                    width: 6, height: 6, borderRadius: '50%',
                    backgroundColor: '#f97316', pointerEvents: 'none',
                }} />
            )}
        </Box>
    );

    let tooltipContent: React.ReactNode = null;

    if (modoAccion === 'reabrir' && isCurrentlyClosed && nombresTiendas.length > 0) {
        tooltipContent = (
            <Box sx={{ p: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 150 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: isSelected ? '#86efac' : '#fed7aa', borderBottom: '1px solid rgba(255,255,255,0.15)', pb: 0.3 }}>
                    {isSelected ? 'Reabrirá en:' : 'Cerrado en:'}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, pt: 0.3 }}>
                    {nombresTiendas.map((nombre: string, idx: number) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isSelected ? '#4ade80' : '#fb923c', flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.73rem', color: '#fff' }}>
                                {nombre}
                            </Typography>
                        </Box>
                    ))}
                </Box>
                {holidayName && (
                    <Typography variant="caption" sx={{ color: '#fca5a5', fontStyle: 'italic', fontSize: '0.68rem', mt: 0.3, borderTop: '1px solid rgba(255,255,255,0.1)', pt: 0.3 }}>
                        {holidayName}
                    </Typography>
                )}
            </Box>
        );
    } else if (isSelected) {
        tooltipContent = modoAccion === 'cerrar' ? 'Seleccionado para cerrar' : 'Seleccionado para reabrir';
    } else if (isHoliday) {
        tooltipContent = holidayName;
    }

    return tooltipContent ? (
        <Tooltip title={tooltipContent} arrow placement="top">{dayEl}</Tooltip>
    ) : dayEl;
}

// ─── Calendario con festivos y multiselección ─────────────────────────────────

/** Convierte Dayjs, Date o cualquier valor a Date nativo sin error de tipos */
function toNativeDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (value && typeof (value as any).toDate === 'function') return (value as any).toDate();
    return new Date(String(value));
}

function CalendarioCierreMasivo({
    diasSeleccionados,
    onToggleDia,
    modoAccion = 'cerrar',
    tiendasCerradasPorFecha = new Map(),
    currentMonth,
    onMonthChange,
}: {
    diasSeleccionados: Set<string>;
    onToggleDia: (fecha: string) => void;
    modoAccion?: 'cerrar' | 'reabrir';
    tiendasCerradasPorFecha?: Map<string, string[]>;
    currentMonth: Date;
    onMonthChange: (date: Date) => void;
}) {
    const calendarYear = currentMonth.getFullYear();
    const { data: festivos = {} } = useHolidays(calendarYear);

    const handleChange = (value: unknown) => {
        if (value) {
            const dateStr = format(toNativeDate(value), 'yyyy-MM-dd');
            if (modoAccion === 'reabrir' && !tiendasCerradasPorFecha.has(dateStr)) {
                return; // Ignorar clic en fechas no cerradas en modo reabrir
            }
            onToggleDia(dateStr);
        }
    };

    const handleMonthOrYearChange = (date: unknown) => {
        const d = toNativeDate(date);
        if (d && !isNaN(d.getTime())) {
            onMonthChange(d);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
            <Box sx={{
                bgcolor: '#fff', borderRadius: 2, border: '1px solid #d1d5db', overflow: 'hidden',
                maxWidth: 336,
                width: '100%',
                mx: 'auto',
                '& .MuiPickersCalendarHeader-root': { paddingLeft: 1.5, paddingRight: 1.5 },
                '& .MuiDayCalendar-root': { width: '100%' },
                '& .MuiPickersDay-root.Mui-disabled': { color: '#ccc', backgroundColor: '#f5f5f5' },
            }}>
                <StaticDatePicker
                    value={null}
                    referenceDate={currentMonth}
                    onChange={handleChange as any}
                    onMonthChange={handleMonthOrYearChange as any}
                    onYearChange={handleMonthOrYearChange as any}
                    displayStaticWrapperAs="desktop"
                    slots={{ day: MultiSelectDay as any }}
                    slotProps={{
                        actionBar: { actions: [] },
                        day: { holidays: festivos, selectedDates: diasSeleccionados, modoAccion, tiendasCerradasPorFecha } as any,
                    }}
                />
            </Box>

            {/* Leyenda */}
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: modoAccion === 'cerrar' ? '#004680' : '#2e7d32' }} />
                    <Typography variant="caption" color="text.secondary">
                        {modoAccion === 'cerrar' ? 'Seleccionado para Cierre' : 'Seleccionado para Reabrir'}
                    </Typography>
                </Box>

                {modoAccion === 'reabrir' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: '#fff7ed', border: '1.5px solid #f97316' }} />
                        <Typography variant="caption" color="text.secondary">Día Cerrado Actualmente</Typography>
                    </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid #d1d5db' }} />
                    <Typography variant="caption" color="text.secondary">Disponible</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#dc2626', mt: '3px' }} />
                    <Typography variant="caption" color="text.secondary">Festivo</Typography>
                </Box>
            </Box>
        </LocalizationProvider>
    );
}


// ─── Componente principal ─────────────────────────────────────────────────────

export default function ModalCierreMasivo({ open, onClose, tiendas }: ModalCierreMasivoProps) {
    const { showSnackbar } = useGlobalSnackbar();
    const queryClient = useQueryClient();

    const [busqueda, setBusqueda] = useState('');
    const [tiendasSeleccionadas, setTiendasSeleccionadas] = useState<Set<number>>(new Set());
    const [diasSeleccionados, setDiasSeleccionados] = useState<Set<string>>(new Set());
    const [guardando, setGuardando] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [accion, setAccion] = useState<'cerrar' | 'reabrir'>('cerrar');
    const [filtroSoloConCierres, setFiltroSoloConCierres] = useState(false);
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

    const mesActualStr = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth]);
    const tiendasMap = useMemo(() => new Map(tiendas.map(t => [t.id, t.nombre])), [tiendas]);

    // Consulta de todos los días cerrados para las tiendas
    const storeIds = useMemo(() => tiendas.map(t => t.id), [tiendas]);
    const { data: todosDiasCerrados = [] } = useQuery<StoreClosedDayDto[]>({
        queryKey: ['todosDiasCerradosMasivo', storeIds],
        queryFn: () => getStoreClosedDays(storeIds),
        enabled: open,
        staleTime: 30 * 1000,
    });

    // Mapeo: storeId -> Set<fecha> (Días cerrados SOLO en el mes que se está mostrando en el calendario)
    const diasCerradosPorTienda = useMemo(() => {
        const map = new Map<number, Set<string>>();
        todosDiasCerrados.forEach(d => {
            if (d.status && d.date && d.date.startsWith(mesActualStr)) {
                if (!map.has(d.store_id)) map.set(d.store_id, new Set());
                map.get(d.store_id)!.add(d.date);
            }
        });
        return map;
    }, [todosDiasCerrados, mesActualStr]);

    // Al abrir el modal, resetear al mes actual
    useEffect(() => {
        if (open) {
            setCurrentMonth(new Date());
        }
    }, [open]);

    // Al abrir el modal o cambiar la acción a 'reabrir', activar filtro y auto-seleccionar tiendas con cierres en este mes
    useEffect(() => {
        if (!open) return;
        if (accion === 'reabrir') {
            setFiltroSoloConCierres(true);
            const tiendasConCierres = tiendas
                .filter(t => (diasCerradosPorTienda.get(t.id)?.size || 0) > 0)
                .map(t => t.id);
            setTiendasSeleccionadas(new Set(tiendasConCierres));
        }
    }, [accion, open, diasCerradosPorTienda, tiendas]);

    const handleToggleFiltroSoloConCierres = () => {
        setFiltroSoloConCierres(prev => {
            const next = !prev;
            if (next) {
                const tiendasConCierres = tiendas
                    .filter(t => (diasCerradosPorTienda.get(t.id)?.size || 0) > 0)
                    .map(t => t.id);
                setTiendasSeleccionadas(new Set(tiendasConCierres));
            }
            return next;
        });
    };

    // Mapeo: fecha -> lista de nombres de tiendas cerradas en esa fecha (para las tiendas seleccionadas y del mes actual)
    const tiendasCerradasPorFecha = useMemo(() => {
        const map = new Map<string, string[]>();
        const idsUsar = tiendasSeleccionadas.size > 0
            ? tiendasSeleccionadas
            : new Set(tiendas.filter(t => (diasCerradosPorTienda.get(t.id)?.size || 0) > 0).map(t => t.id));

        if (idsUsar.size === 0) return map;

        todosDiasCerrados.forEach(d => {
            if (d.status && d.date && d.date.startsWith(mesActualStr) && idsUsar.has(d.store_id)) {
                const nombre = tiendasMap.get(d.store_id);
                if (nombre) {
                    if (!map.has(d.date)) map.set(d.date, []);
                    if (!map.get(d.date)!.includes(nombre)) {
                        map.get(d.date)!.push(nombre);
                    }
                }
            }
        });
        return map;
    }, [todosDiasCerrados, tiendasSeleccionadas, tiendasMap, tiendas, diasCerradosPorTienda, mesActualStr]);

    const tiendasFiltradas = useMemo(() => {
        let res = tiendas.filter(t => t.nombre.toLowerCase().includes(busqueda.toLowerCase()));
        if (filtroSoloConCierres) {
            res = res.filter(t => (diasCerradosPorTienda.get(t.id)?.size || 0) > 0);
        }
        return res;
    }, [tiendas, busqueda, filtroSoloConCierres, diasCerradosPorTienda]);

    const todasSeleccionadas = tiendasSeleccionadas.size === tiendasFiltradas.length && tiendasFiltradas.length > 0;
    const algunaSeleccionada = tiendasSeleccionadas.size > 0 && !todasSeleccionadas;

    const handleToggleTienda = (id: number) => {
        setTiendasSeleccionadas(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleToggleTodas = () => {
        if (todasSeleccionadas) setTiendasSeleccionadas(new Set());
        else setTiendasSeleccionadas(new Set(tiendasFiltradas.map(t => t.id)));
    };

    const handleToggleDia = (fecha: string) => {
        setDiasSeleccionados(prev => {
            const next = new Set(prev);
            if (next.has(fecha)) next.delete(fecha);
            else next.add(fecha);
            return next;
        });
    };

    const totalOperaciones = tiendasSeleccionadas.size * diasSeleccionados.size;
    const puedeConfirmar = tiendasSeleccionadas.size > 0 && diasSeleccionados.size > 0;

    const handleGuardar = async () => {
        setGuardando(true);
        try {
            const tiendaIds = Array.from(tiendasSeleccionadas);
            const fechas = Array.from(diasSeleccionados);
            const esCierre = accion === 'cerrar';
            await Promise.all(
                tiendaIds.flatMap(storeId =>
                    fechas.map(fecha => setStoreClosedDayStatus(storeId, fecha, esCierre))
                )
            );
            tiendaIds.forEach(storeId => {
                queryClient.invalidateQueries({ queryKey: ['diasCerradosTienda', storeId] });
                queryClient.invalidateQueries({ queryKey: ['calendarioAsistencia', storeId] });
            });
            queryClient.invalidateQueries({ queryKey: ['todosDiasCerradosMasivo'] });

            if (esCierre) {
                showSnackbar(
                    `${totalOperaciones} día(s) de cierre registrados en ${tiendaIds.length} tienda(s)`,
                    'success'
                );
            } else {
                showSnackbar(
                    `Reapertura procesada para ${tiendaIds.length} tienda(s) en ${fechas.length} día(s)`,
                    'success'
                );
            }
            handleCerrar();
        } catch (err: any) {
            console.error('Error al procesar acción masiva:', err);
            showSnackbar(err?.message || 'Error al guardar los cambios', 'error');
        } finally {
            setGuardando(false);
            setConfirmOpen(false);
        }
    };

    const handleCerrar = () => {
        setBusqueda('');
        setTiendasSeleccionadas(new Set());
        setDiasSeleccionados(new Set());
        setAccion('cerrar');
        setFiltroSoloConCierres(false);
        setConfirmOpen(false);
        setCurrentMonth(new Date());
        onClose();
    };

    const isCerrar = accion === 'cerrar';
    const mainColor = isCerrar ? '#004680' : '#2e7d32';
    const mainColorHover = isCerrar ? '#003366' : '#1b5e20';

    return (
        <>
            <Dialog
                open={open}
                onClose={!guardando ? handleCerrar : undefined}
                maxWidth="md"
                fullWidth
                slotProps={{ paper: { sx: { borderRadius: 3, maxWidth: 920, maxHeight: '90vh', display: 'flex', flexDirection: 'column' } } }}
            >
                {/* Cabecera */}
                <Box sx={{ bgcolor: mainColor, color: '#fff', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', transition: 'background-color 0.2s', flexShrink: 0 }}>
                    {isCerrar ? <BlockIcon sx={{ fontSize: 26 }} /> : <LockOpenIcon sx={{ fontSize: 26 }} />}
                    <Box>
                        <Typography variant="h6" fontWeight={700}>
                            {isCerrar ? 'Marcar Días de Cierre Masivo' : 'Reabrir Tiendas Masivo'}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>
                            {isCerrar ? 'Selecciona las tiendas y los días que no abrirán' : 'Selecciona las tiendas y los días cerrados que sí abrirán'}
                        </Typography>
                    </Box>

                    <Tabs
                        value={accion}
                        onChange={(_, v) => {
                            setAccion(v);
                            setDiasSeleccionados(new Set());
                        }}
                        textColor="inherit"
                        sx={{
                            ml: 'auto', mr: 1,
                            '& .MuiTab-root': {
                                color: 'rgba(255,255,255,0.75)',
                                fontWeight: 600,
                                textTransform: 'none',
                                minHeight: 34, py: 0.5, px: 1.5,
                                fontSize: '0.82rem',
                                '&.Mui-selected': { color: '#fff', fontWeight: 700 },
                            },
                            '& .MuiTabs-indicator': { backgroundColor: '#fff', height: 3 },
                        }}
                    >
                        <Tab label="Marcar Cierre" value="cerrar" icon={<BlockIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
                        <Tab label="Quitar Cierre" value="reabrir" icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
                    </Tabs>

                    <IconButton onClick={handleCerrar} sx={{ color: '#fff' }} disabled={guardando}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                <DialogContent sx={{ p: 0, overflowY: 'auto', flex: 1 }}>
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
                        gap: 2.5,
                        p: 2.5,
                        alignItems: 'start',
                    }}>
                        {/* ── Columna izquierda: Tiendas ── */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle2" fontWeight={700} color="#0a1929" sx={{ letterSpacing: 0.5 }}>
                                    TIENDAS
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={handleToggleFiltroSoloConCierres}
                                    sx={{
                                        fontSize: '0.7rem', textTransform: 'none', py: 0.2, px: 1, minHeight: 22, borderRadius: 1.5,
                                        color: filtroSoloConCierres ? '#c2410c' : '#64748b',
                                        bgcolor: filtroSoloConCierres ? '#fff7ed' : '#f1f5f9',
                                        border: filtroSoloConCierres ? '1px solid #f97316' : '1px solid #e2e8f0',
                                        fontWeight: 600,
                                    }}
                                >
                                    {filtroSoloConCierres ? 'Ver todas' : 'Solo con cierres'}
                                </Button>
                            </Box>

                            <TextField
                                placeholder="Buscar tienda..."
                                size="small"
                                fullWidth
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={todasSeleccionadas}
                                        indeterminate={algunaSeleccionada}
                                        onChange={handleToggleTodas}
                                        sx={{ color: mainColor, '&.Mui-checked': { color: mainColor }, '&.MuiCheckbox-indeterminate': { color: mainColor } }}
                                    />
                                }
                                label={
                                    <Typography variant="body2" fontWeight={700} color="#0a1929">
                                        Seleccionar todas ({tiendasFiltradas.length})
                                    </Typography>
                                }
                            />
                            <Divider sx={{ mt: -0.5 }} />

                            <Box sx={{
                                maxHeight: 300,
                                overflowY: 'auto',
                                pr: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.3,
                                '&::-webkit-scrollbar': { width: 6 },
                                '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 3 },
                                '&::-webkit-scrollbar-thumb:hover': { bgcolor: '#94a3b8' },
                            }}>
                                {tiendasFiltradas.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                        No se encontraron tiendas
                                    </Typography>
                                ) : tiendasFiltradas.map(tienda => {
                                    const closedCount = diasCerradosPorTienda.get(tienda.id)?.size || 0;
                                    return (
                                        <FormControlLabel
                                            key={tienda.id}
                                            control={
                                                <Checkbox
                                                    checked={tiendasSeleccionadas.has(tienda.id)}
                                                    onChange={() => handleToggleTienda(tienda.id)}
                                                    size="small"
                                                    sx={{ color: mainColor, '&.Mui-checked': { color: mainColor } }}
                                                />
                                            }
                                            label={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, width: '100%', justifyContent: 'space-between' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                                        <StorefrontIcon sx={{ fontSize: 15, color: '#64748b' }} />
                                                        <Typography variant="body2" color="#0a1929">{tienda.nombre}</Typography>
                                                    </Box>
                                                    {closedCount > 0 && (
                                                        <Chip
                                                            size="small"
                                                            label={`${closedCount} cerrado(s)`}
                                                            sx={{
                                                                bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 700, fontSize: '0.68rem', height: 20,
                                                                border: '1px solid #ffedd5',
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            }
                                            sx={{ mx: 0, borderRadius: 1.5, px: 0.5, py: 0.2, '&:hover': { bgcolor: '#f1f5f9' }, width: '100%' }}
                                        />
                                    );
                                })}
                            </Box>

                            <Box sx={{ pt: 1, borderTop: '1px solid #e0e0e0' }}>
                                <Chip
                                    size="small"
                                    label={`${tiendasSeleccionadas.size} tienda(s) seleccionada(s)`}
                                    sx={{
                                        bgcolor: tiendasSeleccionadas.size > 0 ? '#e3f2fd' : '#f1f5f9',
                                        color: tiendasSeleccionadas.size > 0 ? '#0d47a1' : '#64748b',
                                        fontWeight: 600,
                                    }}
                                />
                            </Box>
                        </Box>

                        {/* ── Columna derecha: Calendario ── */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Typography variant="subtitle2" fontWeight={700} color="#0a1929" sx={{ letterSpacing: 0.5 }}>
                                FECHAS
                            </Typography>

                            <CalendarioCierreMasivo
                                diasSeleccionados={diasSeleccionados}
                                onToggleDia={handleToggleDia}
                                modoAccion={accion}
                                tiendasCerradasPorFecha={tiendasCerradasPorFecha}
                                currentMonth={currentMonth}
                                onMonthChange={setCurrentMonth}
                            />

                            <Box sx={{ mt: 'auto', pt: 1, borderTop: '1px solid #e0e0e0' }}>
                                <Chip
                                    size="small"
                                    label={`${diasSeleccionados.size} día(s) seleccionado(s)`}
                                    sx={{
                                        bgcolor: diasSeleccionados.size > 0 ? (isCerrar ? '#e3f2fd' : '#e8f5e9') : '#f1f5f9',
                                        color: diasSeleccionados.size > 0 ? (isCerrar ? '#0d47a1' : '#1b5e20') : '#64748b',
                                        fontWeight: 600,
                                    }}
                                />
                            </Box>
                        </Box>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0', justifyContent: 'space-between', bgcolor: '#f8fafc' }}>
                    <Button
                        onClick={handleCerrar}
                        variant="outlined"
                        disabled={guardando}
                        sx={{ color: '#64748b', borderColor: '#cbd5e1', borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => setConfirmOpen(true)}
                        variant="contained"
                        disabled={!puedeConfirmar || guardando}
                        sx={{
                            bgcolor: mainColor, '&:hover': { bgcolor: mainColorHover },
                            borderRadius: 2, textTransform: 'none', fontWeight: 700,
                            '&.Mui-disabled': { bgcolor: '#e0e0e0', color: '#9e9e9e' },
                        }}
                    >
                        {puedeConfirmar
                            ? (isCerrar
                                ? `Confirmar Cierre: ${tiendasSeleccionadas.size} tienda(s) × ${diasSeleccionados.size} día(s)`
                                : `Confirmar Reapertura: ${tiendasSeleccionadas.size} tienda(s) × ${diasSeleccionados.size} día(s)`)
                            : 'Selecciona tiendas y fechas'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de confirmación final */}
            <ConfirmCierreMasivoDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                guardando={guardando}
                isCerrar={isCerrar}
                diasCount={diasSeleccionados.size}
                tiendasCount={tiendasSeleccionadas.size}
                totalOperaciones={totalOperaciones}
                mainColor={mainColor}
                mainColorHover={mainColorHover}
                onConfirm={handleGuardar}
            />
        </>
    );
}
