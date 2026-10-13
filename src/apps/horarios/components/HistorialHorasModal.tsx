import React, { useState } from 'react';
import {
    Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle,
    DialogContent, DialogActions, IconButton as MuiIconButton, Tooltip, Badge,
    Grid, Avatar, Chip
} from '@mui/material';
import {
    Close as CloseIcon,
    NavigateBefore as NavigateBeforeIcon,
    NavigateNext as NavigateNextIcon,
    PlayArrow as PlayIcon,
    Coffee as CoffeeIcon,
    Restaurant as RestaurantIcon,
    ExitToApp as LogoutIcon,
    AccessTime as AccessTimeIcon,
    Lock as LockIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import 'dayjs/locale/es';
import { LOG_TYPE } from '../domain/registro';

dayjs.extend(isSameOrBefore);

import { fetchTimeRecords } from '../api/directus/read';
import { getStoreClosedDays } from '../api/directus/readBulk';
import DateRangeFilter from './reportes/DateRangeFilter';
import { HistorialTimelineView } from './historial/HistorialTimelineView';
import {
    EmpleadoFila,
    getNovedadIcon,
    calcularMinutosDia,
    formatearHoras,
} from './ModalDetalleTiendaUtils';

interface HistorialHorasModalProps {
    open: boolean;
    onClose: () => void;
    empleado: EmpleadoFila | null;
    tiendaId: number;
    todasNovedades: any[];
    onDayClick?: (fecha: string, empleadoNombre: string) => void;
}

// Meta para los tipos de registro en el timeline
export const REGISTRO_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    [LOG_TYPE.inicioJornada]: { icon: <PlayIcon sx={{ fontSize: 18 }} />, color: '#16a34a', bg: '#dcfce7' },
    [LOG_TYPE.inicioAlmuerzo]: { icon: <CoffeeIcon sx={{ fontSize: 18 }} />, color: '#ea580c', bg: '#ffedd5' },
    [LOG_TYPE.finAlmuerzo]: { icon: <RestaurantIcon sx={{ fontSize: 18 }} />, color: '#ca8a04', bg: '#fef9c3' },
    [LOG_TYPE.finJornada]: { icon: <LogoutIcon sx={{ fontSize: 18 }} />, color: '#004680', bg: '#eaf2fb' },
};

export default function HistorialHorasModal({
    open,
    onClose,
    empleado,
    tiendaId,
    todasNovedades,
    onDayClick,
}: HistorialHorasModalProps) {
    const [mesActual, setMesActual] = useState(dayjs().startOf('month'));
    const [fechaInicioFiltro, setFechaInicioFiltro] = useState<Dayjs | null>(() => dayjs().startOf('month'));
    const [fechaFinFiltro, setFechaFinFiltro] = useState<Dayjs | null>(() => dayjs());
    const [diaSeleccionado, setDiaSeleccionado] = useState<{
        fecha: dayjs.Dayjs;
        records: any[];
        minutos: number;
        tieneNovedad: boolean;
        novedadTipo: string;
    } | null>(null);

    React.useEffect(() => {
        if (open) {
            const inicioMes = dayjs().startOf('month');
            const hoy = dayjs();
            setMesActual(inicioMes);
            setFechaInicioFiltro(inicioMes);
            setFechaFinFiltro(hoy);
        }
    }, [open, empleado?.id]);

    const { data: registrosMes = [], isLoading } = useQuery({
        queryKey: ['historialMes', tiendaId, empleado?.id, mesActual.format('YYYY-MM')],
        queryFn: async () => {
            if (!empleado) return [];
            const inicioMes = mesActual.startOf('month');
            const finMes = mesActual.endOf('month');

            const storeFilter = tiendaId > 0 ? tiendaId : undefined;
            const recordsMes = await fetchTimeRecords(
                inicioMes.format('YYYY-MM-DD'),
                finMes.format('YYYY-MM-DD'),
                storeFilter,
                empleado.id
            );

            // Agrupar registros en memoria por fecha
            const recordsPorDia: Record<string, any[]> = {};
            recordsMes.forEach((r: any) => {
                const dateKey = r.record_date;
                (recordsPorDia[dateKey] ||= []).push(r);
            });

            const dias: string[] = [];
            let cursor = inicioMes;
            while (cursor.isSameOrBefore(finMes, 'day')) {
                dias.push(cursor.format('YYYY-MM-DD'));
                cursor = cursor.add(1, 'day');
            }

            const registrosPorDia = dias.map((fecha) => {
                const records = recordsPorDia[fecha] || [];
                return { fecha, records };
            });

            return registrosPorDia;
        },
        enabled: !!empleado && open,
        staleTime: 5 * 60 * 1000,
    });

    // Consultar días cerrados de la tienda del mes activo
    const storeIdParaCerrados = tiendaId > 0 ? tiendaId : (empleado as any)?.storeId > 0 ? (empleado as any).storeId : undefined;
    const { data: diasCerrados = [] } = useQuery({
        queryKey: ['storeClosedDays', storeIdParaCerrados, mesActual.format('YYYY-MM')],
        queryFn: () => {
            if (!storeIdParaCerrados) return Promise.resolve([]);
            return getStoreClosedDays(
                storeIdParaCerrados,
                mesActual.startOf('month').format('YYYY-MM-DD'),
                mesActual.endOf('month').format('YYYY-MM-DD')
            );
        },
        enabled: !!open && !!storeIdParaCerrados,
        staleTime: 5 * 60 * 1000,
    });

    const diasCerradosSet = React.useMemo(() => {
        const s = new Set<string>();
        diasCerrados.forEach(d => { if (d.status !== false) s.add(d.date); });
        return s;
    }, [diasCerrados]);

    const semanas = React.useMemo(() => {
        if (!registrosMes || registrosMes.length === 0) return [];
        const semanasMap: { [key: string]: any[] } = {};
        registrosMes.forEach(({ fecha, records }) => {
            const dayObj = dayjs(fecha).locale('es');
            const semanaInicio = dayObj.startOf('week'); // Lunes
            const key = semanaInicio.format('YYYY-MM-DD');
            if (!semanasMap[key]) semanasMap[key] = [];
            semanasMap[key].push({ fecha, records });
        });
        const semanasArray = Object.keys(semanasMap).map((key) => ({
            inicio: dayjs(key).locale('es'),
            dias: semanasMap[key],
        }));
        semanasArray.sort((a, b) => b.inicio.diff(a.inicio));
        return semanasArray;
    }, [registrosMes]);

    const handleMesAnterior = () => {
        const nuevoMes = mesActual.subtract(1, 'month');
        setMesActual(nuevoMes);
        if (nuevoMes.isSame(dayjs(), 'month')) {
            setFechaInicioFiltro(nuevoMes.startOf('month'));
            setFechaFinFiltro(dayjs());
        } else {
            setFechaInicioFiltro(nuevoMes.startOf('month'));
            setFechaFinFiltro(nuevoMes.endOf('month'));
        }
    };
    const handleMesSiguiente = () => {
        const siguiente = mesActual.add(1, 'month');
        if (!siguiente.isAfter(dayjs(), 'month')) {
            setMesActual(siguiente);
            if (siguiente.isSame(dayjs(), 'month')) {
                setFechaInicioFiltro(siguiente.startOf('month'));
                setFechaFinFiltro(dayjs());
            } else {
                setFechaInicioFiltro(siguiente.startOf('month'));
                setFechaFinFiltro(siguiente.endOf('month'));
            }
        }
    };

    const getNovedadDelDia = (fecha: string) => {
        return todasNovedades.find(n => {
            const nFecha = n.report_date || n.fecha;
            const nEmpId = Number(n.employee_id?.id || n.employee_id || n.empleadoId || n.idEmpleado);
            return nFecha === fecha && nEmpId === Number(empleado?.id);
        });
    };

    const iniciales = (empleado?.nombre || 'XX')
        .split(' ')
        .slice(0, 2)
        .map((p: string) => p[0] || '')
        .join('')
        .toUpperCase();

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="lg" 
            fullWidth
            slotProps={{ paper: { sx: { borderRadius: 4, overflow: 'hidden' } } }}
        >
            {/* Header del Diálogo */}
            <DialogTitle component="div" sx={{ bgcolor: '#004680', color: '#fff', py: 2.5, px: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: '#0284c7', fontWeight: 700, fontSize: '0.9rem' }}>
                            {iniciales}
                        </Avatar>
                        <Box>
                            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                                Historial de Marcaciones
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                                {empleado?.nombre} {empleado?.cargo ? `· ${empleado.cargo}` : ''}
                            </Typography>
                        </Box>
                    </Box>
                    <MuiIconButton onClick={onClose} sx={{ color: '#fff' }}><CloseIcon /></MuiIconButton>
                </Box>
            </DialogTitle>

            {/* Contenido Principal */}
            <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
                
                {/* Selector de Mes y Filtro de Rango de Fechas (A la par) */}
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' }, 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: { xs: 1.5, sm: 3 }, 
                    mb: 3, 
                    mt: 1 
                }}>
                    {/* Selector de Mes */}
                    <Box className="tour-hh-navegacion" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <MuiIconButton onClick={handleMesAnterior} size="small" sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', '&:hover': { bgcolor: '#f1f5f9' } }}>
                            <NavigateBeforeIcon />
                        </MuiIconButton>
                        <Typography variant="h6" fontWeight={800} color="#0f2c4a" sx={{ minWidth: 170, textAlign: 'center', textTransform: 'capitalize', fontSize: '1.05rem' }}>
                            {mesActual.locale('es').format('MMMM [de] YYYY')}
                        </Typography>
                        <MuiIconButton 
                            onClick={handleMesSiguiente} 
                            size="small"
                            disabled={mesActual.isSame(dayjs(), 'month')}
                            sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', '&:hover': { bgcolor: '#f1f5f9' }, '&.Mui-disabled': { opacity: 0.3 } }}
                        >
                            <NavigateNextIcon />
                        </MuiIconButton>
                    </Box>

                    {/* Filtro de Rango de Fechas */}
                    <Box sx={{ width: { xs: '100%', sm: 260 } }}>
                        <DateRangeFilter
                            fechaInicio={fechaInicioFiltro}
                            fechaFin={fechaFinFiltro}
                            onChange={(inicio, fin) => {
                                setFechaInicioFiltro(inicio);
                                setFechaFinFiltro(fin);
                                if (inicio && !inicio.isSame(mesActual, 'month')) {
                                    setMesActual(inicio.startOf('month'));
                                }
                            }}
                        />
                    </Box>
                </Box>

                {isLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
                        <CircularProgress sx={{ color: '#004680' }} />
                        <Typography color="text.secondary" fontWeight={600}>Consultando registros mensuales...</Typography>
                    </Box>
                ) : semanas.length === 0 ? (
                    <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                        <Typography variant="body1" color="text.secondary">No se encontraron registros de asistencia para este mes.</Typography>
                    </Paper>
                ) : (
                    <Box className="tour-hh-semanas" sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                        {semanas.map((semana, idx) => {
                            const inicio = semana.inicio;
                            const fin = inicio.add(6, 'day'); // Lunes a Domingo
                            const esActual = inicio.isSame(dayjs().locale('es').startOf('week'), 'day');
                            
                            let totalMinutos = 0;
                            let diasEnRangoCount = 0;

                            const diasDetalle = semana.dias.map(({ fecha, records }) => {
                                const dayObj = dayjs(fecha);
                                const esAntes = fechaInicioFiltro ? dayObj.isBefore(fechaInicioFiltro, 'day') : false;
                                const esDespues = fechaFinFiltro ? dayObj.isAfter(fechaFinFiltro, 'day') : false;
                                const fueraDeRango = esAntes || esDespues;

                                const minutos = fueraDeRango ? 0 : calcularMinutosDia(records, empleado!.id);
                                if (!fueraDeRango) {
                                    totalMinutos += minutos;
                                    diasEnRangoCount++;
                                }

                                const novedad = getNovedadDelDia(fecha);
                                const tiendaCerrada = diasCerradosSet.has(fecha);
                                return {
                                    fecha: dayObj,
                                    records,
                                    minutos,
                                    tieneNovedad: !!novedad,
                                    novedadTipo: novedad?.newness_id?.name || novedad?.tipo || '',
                                    fueraDeRango,
                                    tiendaCerrada,
                                };
                            });
                            
                            diasDetalle.sort((a, b) => a.fecha.diff(b.fecha));

                            if (diasEnRangoCount === 0) return null;

                            return (
                                <Paper 
                                    key={idx} 
                                    elevation={0} 
                                    sx={{ 
                                        p: 2.5, 
                                        borderRadius: 3.5, 
                                        border: esActual ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                        bgcolor: '#fff',
                                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01), 0 2px 4px -1px rgba(0,0,0,0.01)'
                                    }}
                                >
                                    {/* Cabecera de la Semana */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Typography variant="subtitle1" fontWeight={800} color={esActual ? '#1d4ed8' : '#0f2c4a'}>
                                                Semana: {inicio.format('D MMM')} – {fin.format('D MMM YYYY')}
                                            </Typography>
                                            {esActual && (
                                                <Chip label="Actual" size="small" color="primary" sx={{ fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
                                            )}
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <AccessTimeIcon sx={{ fontSize: 16, color: '#64748b' }} />
                                            <Typography variant="subtitle2" fontWeight={800} color="#0f2c4a">
                                                Acumulado: <Box component="span" sx={{ color: '#004680' }}>{formatearHoras(totalMinutos)}</Box>
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Grid de Tarjetas Diarias */}
                                    <Grid container spacing={1.5}>
                                        {diasDetalle.map((dia) => {
                                            if (dia.fueraDeRango) {
                                                return (
                                                    <Grid size={{ xs: 6, sm: 4, md: 2.4, lg: 1.71 }} key={dia.fecha.format('YYYY-MM-DD')}>
                                                        <Box sx={{ visibility: 'hidden', minHeight: 90 }} />
                                                    </Grid>
                                                );
                                            }

                                            const tieneRegistros = dia.records.length > 0;
                                            const esDomingo = dia.fecha.day() === 0;

                                            // Estilos para novedades en días sin marcas
                                            const getNovedadEstilo = (tipo: string) => {
                                                const t = tipo.toLowerCase();
                                                if (t.includes('descanso')) return { bg: '#e8f5e9', color: '#2e7d32', border: '#c8e6c9' };
                                                if (t.includes('vacaciones')) return { bg: '#e3f2fd', color: '#1565c0', border: '#bbdefb' };
                                                if (t.includes('incapacidad') || t.includes('ausencia') || t.includes('suspensión')) return { bg: '#ffebee', color: '#c62828', border: '#ffcdd2' };
                                                if (t.includes('permiso') || t.includes('calamidad') || t.includes('familia')) return { bg: '#fff3e0', color: '#ef6c00', border: '#ffe0b2' };
                                                return { bg: '#f5f5f5', color: '#616161', border: '#e0e0e0' };
                                            };

                                            const novedadEstilo = dia.tieneNovedad && !tieneRegistros ? getNovedadEstilo(dia.novedadTipo) : null;
                                            const capitalizar = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

                                            // --- TIENDA CERRADA ---
                                            if (dia.tiendaCerrada) {
                                                const tooltipRegistros = tieneRegistros
                                                    ? `${formatearHoras(dia.minutos)} registrados (${dia.records.length} marcación${dia.records.length > 1 ? 'es' : ''})`
                                                    : '';

                                                const cardContent = (
                                                    <Box
                                                        onClick={() => { if (tieneRegistros) setDiaSeleccionado(dia); }}
                                                        sx={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            p: 1.5,
                                                            borderRadius: 3,
                                                            bgcolor: tieneRegistros ? '#fdf4ff' : '#f3f4f6',
                                                            border: '1px dashed',
                                                            borderColor: tieneRegistros ? '#c084fc' : '#9ca3af',
                                                            cursor: tieneRegistros ? 'pointer' : 'default',
                                                            height: '100%',
                                                            minHeight: 90,
                                                            justifyContent: 'space-between',
                                                            transition: 'all 0.2s ease',
                                                            ...(tieneRegistros && {
                                                                '&:hover': {
                                                                    borderColor: '#a855f7',
                                                                    boxShadow: '0 4px 12px rgba(168,85,247,0.15)',
                                                                    transform: 'translateY(-2px)'
                                                                }
                                                            }),
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                            <Typography variant="caption" fontWeight={700} sx={{ color: '#6b7280', textTransform: 'capitalize' }}>
                                                                {dia.fecha.locale('es').format('ddd D')}
                                                            </Typography>
                                                            <LockIcon sx={{ fontSize: 18, color: tieneRegistros ? '#c084fc' : '#9ca3af' }} />
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={700} sx={{ color: tieneRegistros ? '#7c3aed' : '#9ca3af', fontSize: '0.78rem' }}>
                                                                Tienda Cerrada
                                                            </Typography>
                                                            {tieneRegistros && (
                                                                <Typography variant="caption" sx={{ color: '#7c3aed', fontSize: '0.62rem', mt: 0.25, display: 'block' }}>
                                                                    {formatearHoras(dia.minutos)} marcados →
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                );

                                                return (
                                                    <Grid size={{ xs: 6, sm: 4, md: 2.4, lg: 1.71 }} key={dia.fecha.format('YYYY-MM-DD')}>
                                                        {tieneRegistros ? (
                                                            <Tooltip
                                                                title={<Box><Typography variant="caption" fontWeight={700}>La tienda estaba cerrada este día</Typography><br /><Typography variant="caption">{tooltipRegistros}</Typography></Box>}
                                                                placement="top"
                                                            >
                                                                <Box sx={{ height: '100%' }}>{cardContent}</Box>
                                                            </Tooltip>
                                                        ) : cardContent}
                                                    </Grid>
                                                );
                                            }
                                            // --- FIN TIENDA CERRADA ---

                                            return (
                                                 <Grid size={{ xs: 6, sm: 4, md: 2.4, lg: 1.71 }} key={dia.fecha.format('YYYY-MM-DD')}>
                                                    <Box
                                                        className={dia.fecha.format('YYYY-MM-DD') === diasDetalle[0].fecha.format('YYYY-MM-DD') ? 'tour-hh-dia' : undefined}
                                                        onClick={() => {
                                                            if (tieneRegistros) {
                                                                setDiaSeleccionado(dia);
                                                            }
                                                        }}
                                                        sx={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            p: 1.5,
                                                            borderRadius: 3,
                                                            bgcolor: tieneRegistros 
                                                                ? '#f1f7fe' 
                                                                : novedadEstilo 
                                                                    ? novedadEstilo.bg 
                                                                    : '#f8fafc',
                                                            border: '1px solid',
                                                            borderColor: tieneRegistros 
                                                                ? '#c7dffc' 
                                                                : novedadEstilo 
                                                                    ? novedadEstilo.border 
                                                                    : '#e2e8f0',
                                                            cursor: tieneRegistros ? 'pointer' : 'default',
                                                            height: '100%',
                                                            minHeight: 90,
                                                            justifyContent: 'space-between',
                                                            transition: 'all 0.2s ease',
                                                            ...(tieneRegistros && {
                                                                '&:hover': {
                                                                    borderColor: '#3b82f6',
                                                                    boxShadow: '0 4px 12px rgba(59,130,246,0.12)',
                                                                    transform: 'translateY(-2px)'
                                                                }
                                                            }),
                                                            ...(esDomingo && !novedadEstilo && {
                                                                bgcolor: tieneRegistros ? '#fef9c3' : '#fffbeb',
                                                                borderColor: tieneRegistros ? '#fde68a' : '#fef3c7'
                                                            })
                                                        }}
                                                    >
                                                        {/* Día y Fecha */}
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                            <Typography 
                                                                variant="caption" 
                                                                fontWeight={700} 
                                                                sx={{ 
                                                                    color: novedadEstilo 
                                                                        ? novedadEstilo.color 
                                                                        : esDomingo 
                                                                            ? '#b45309' 
                                                                            : '#64748b', 
                                                                    textTransform: 'capitalize' 
                                                                }}
                                                            >
                                                                {dia.fecha.locale('es').format('ddd D')}
                                                            </Typography>
                                                            {dia.tieneNovedad && (
                                                                <Tooltip title={`Novedad: ${dia.novedadTipo}`}>
                                                                    <Badge color="error" variant="dot">
                                                                        {getNovedadIcon(dia.novedadTipo)}
                                                                    </Badge>
                                                                </Tooltip>
                                                            )}
                                                        </Box>

                                                        {/* Total Horas / Novedad del Día */}
                                                        <Box>
                                                            <Typography 
                                                                variant="body2" 
                                                                fontWeight={800} 
                                                                sx={{ 
                                                                    color: tieneRegistros 
                                                                        ? '#004680' 
                                                                        : novedadEstilo 
                                                                            ? novedadEstilo.color 
                                                                            : '#94a3b8', 
                                                                    fontSize: '0.85rem' 
                                                                }}
                                                            >
                                                                {tieneRegistros 
                                                                    ? formatearHoras(dia.minutos) 
                                                                    : novedadEstilo 
                                                                        ? capitalizar(dia.novedadTipo) 
                                                                        : 'Sin marcas'}
                                                            </Typography>
                                                            {tieneRegistros && (
                                                                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem', mt: 0.25, display: 'block' }}>
                                                                    Ver detalles →
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                </Grid>
                                            );
                                        })}
                                    </Grid>
                                </Paper>
                            );
                        })}
                    </Box>
                )}
            </DialogContent>

            {/* Acciones del Diálogo Principal */}
            <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f1f5f9', borderTop: '1px solid #e2e8f0' }}>
                <Button 
                    onClick={onClose} 
                    variant="contained" 
                    disableElevation
                    sx={{ bgcolor: '#004680', borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#003366' } }}
                >
                    Cerrar Historial
                </Button>
            </DialogActions>

            {/* DIÁLOGO HIJO: Detalle Diario Premium (Timeline) */}
            <HistorialTimelineView
                diaSeleccionado={diaSeleccionado}
                onCloseDia={() => setDiaSeleccionado(null)}
                onCloseMain={onClose}
                onDayClick={onDayClick}
                empleadoNombre={empleado?.nombre || ''}
            />
        </Dialog>
    );
}