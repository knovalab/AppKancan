import { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Tooltip, CircularProgress,
    IconButton as MuiIconButton,
} from '@mui/material';
import {
    CalendarMonth as CalendarMonthIcon,
    InfoOutlined as InfoOutlinedIcon,
    NavigateBefore as NavigateBeforeIcon,
    NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import 'dayjs/locale/es';
import { LOG_TYPE } from '../domain/registro';

dayjs.extend(isSameOrBefore);

import { fetchTimeRecords, getStoreClosedDays } from '../api/directus/read';
import { useHolidays } from '../../reservas/hooks/useHolidays';
import type { StoreClosedDayDto } from '../interfaces/api/stores';
import type { EstadoDia } from '../interfaces/ui/monitoreo';

interface CalendarioMensualTiendaProps {
    tiendaId: number;
    totalEmpleados: number;
    fechaSeleccionada: string;
    onDateSelect: (fecha: string) => void;
    todasNovedades: any[];
    puedeGestionar?: boolean;
    // Props de multiselección
    modoSeleccion?: boolean;
    diasSeleccionados?: Set<string>;
    onToggleDia?: (fecha: string) => void;
}

export default function CalendarioMensualTienda({
    tiendaId,
    totalEmpleados: _totalEmpleados,
    fechaSeleccionada,
    onDateSelect,
    todasNovedades,
    puedeGestionar = false,
    modoSeleccion = false,
    diasSeleccionados,
    onToggleDia,
}: CalendarioMensualTiendaProps) {
    const [mesActual, setMesActual] = useState(() => dayjs(fechaSeleccionada).startOf('month'));
    const { data: festivosMap = {} } = useHolidays(mesActual.year());

    useEffect(() => {
        const mesSel = dayjs(fechaSeleccionada).startOf('month');
        if (!mesActual.isSame(mesSel, 'month')) setMesActual(mesSel);
    }, [fechaSeleccionada]);

    const hoy = dayjs();
    const inicioMes = mesActual.startOf('month');
    const finMes = mesActual.endOf('month');

    const { data: { diasEstado = {}, diasCerradosMap: _diasCerradosMap = {} } = {}, isLoading } = useQuery({
        queryKey: ['calendarioAsistencia', tiendaId, mesActual.format('YYYY-MM'), todasNovedades.length, puedeGestionar],
        queryFn: async () => {
            const limite = (mesActual.isSame(hoy, 'month') && !puedeGestionar) ? hoy : finMes;

            const [recordsMes, diasCerrados] = await Promise.all([
                fetchTimeRecords(
                    inicioMes.format('YYYY-MM-DD'),
                    limite.format('YYYY-MM-DD'),
                    tiendaId
                ),
                getStoreClosedDays(
                    tiendaId,
                    inicioMes.format('YYYY-MM-DD'),
                    limite.format('YYYY-MM-DD')
                )
            ]);

            const closedMap: Record<string, StoreClosedDayDto> = {};
            diasCerrados.forEach((d) => {
                closedMap[d.date] = d;
            });

            // Agrupar registros en memoria por fecha
            const recordsPorDia: Record<string, any[]> = {};
            recordsMes.forEach((r: any) => {
                const dateKey = r.record_date;
                (recordsPorDia[dateKey] ||= []).push(r);
            });

            // Agrupar novedades en memoria por fecha
            const novedadesPorDia: Record<string, any[]> = {};
            todasNovedades.forEach((n: any) => {
                const dateKey = n.report_date;
                if (dateKey) {
                    (novedadesPorDia[dateKey] ||= []).push(n);
                }
            });

            const dias: string[] = [];
            let cursor = inicioMes;
            while (cursor.isSameOrBefore(limite, 'day')) {
                dias.push(cursor.format('YYYY-MM-DD'));
                cursor = cursor.add(1, 'day');
            }

            const resultados = dias.map((fecha) => {
                if (closedMap[fecha] && closedMap[fecha].status === true) {
                    return { fecha, estado: 'tienda_cerrada' as EstadoDia };
                }

                const records = recordsPorDia[fecha] || [];

                if (records.length === 0) {
                    return { fecha, estado: 'sin_registro' as EstadoDia };
                }

                const employeeIdsWithRecords = Array.from(
                    new Set(records.map((r: any) => Number(r.employee_id?.id || r.employee_id)))
                );

                let hasIncomplete = false;
                let hasComplete = false;

                employeeIdsWithRecords.forEach((empId) => {
                    const empRecs = records.filter(
                        (r: any) => Number(r.employee_id?.id || r.employee_id) === empId
                    );
                    const tieneEntrada = empRecs.some((r: any) => r.log_type === LOG_TYPE.inicioJornada);
                    const tieneSalida = empRecs.some((r: any) => r.log_type === LOG_TYPE.finJornada);
                    if (tieneEntrada && tieneSalida) {
                        hasComplete = true;
                    } else {
                        hasIncomplete = true;
                    }
                });

                let estado: EstadoDia = 'sin_registro';
                if (hasIncomplete) {
                    estado = 'parcial';
                } else if (hasComplete) {
                    estado = 'completo';
                }

                return { fecha, estado };
            });

            const estadoDict = resultados.reduce((acc, { fecha, estado }) => ({ ...acc, [fecha]: estado }), {} as Record<string, EstadoDia>);
            return { diasEstado: estadoDict, diasCerradosMap: closedMap };
        },
        enabled: !!tiendaId,
        staleTime: 5 * 60 * 1000,
    });

    const hoyStr = dayjs().format('YYYY-MM-DD');
    const diasSinRegistro = Object.entries(diasEstado).filter(([fecha, e]) => e === 'sin_registro' && fecha < hoyStr).length;
    const primerDiaSemana = (inicioMes.day() + 6) % 7;
    const totalDiasMes = finMes.date();
    const celdas: (number | null)[] = [
        ...Array(primerDiaSemana).fill(null),
        ...Array.from({ length: totalDiasMes }, (_, i) => i + 1),
    ];

    const colorPorEstado = (estado?: EstadoDia, esFuturo?: boolean) => {
        if (estado === 'tienda_cerrada') return { bg: '#e2e8f0', color: '#475569', border: '1.5px solid #cbd5e1' };
        if (esFuturo) {
            if (puedeGestionar) {
                return { bg: 'transparent', color: '#0a1929', border: '1.5px dashed #0a1929' };
            }
            return { bg: 'transparent', color: '#cfd8dc', border: 'none' };
        }
        if (!estado) return { bg: 'transparent', color: '#cfd8dc', border: 'none' };
        if (estado === 'completo') return { bg: '#2e7d32', color: '#fff', border: 'none' };
        if (estado === 'parcial') return { bg: '#ef6c00', color: '#fff', border: 'none' };
        return { bg: '#d32f2f', color: '#fff', border: 'none' };
    };

    const handleDateClick = (fecha: string, esCerrado: boolean) => {
        if (modoSeleccion) {
            // En modo selección: no se pueden seleccionar días ya cerrados
            if (!esCerrado && onToggleDia) onToggleDia(fecha);
            return;
        }
        onDateSelect(fecha);
        setMesActual(dayjs(fecha).startOf('month'));
    };

    const handleMesAnterior = () => setMesActual(mesActual.subtract(1, 'month'));
    const handleMesSiguiente = () => setMesActual(mesActual.add(1, 'month'));

    return (
        <Box sx={{ mb: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, bgcolor: diasSinRegistro > 0 ? '#fdf2f2' : '#f0fdf4', border: '1px solid', borderColor: diasSinRegistro > 0 ? '#fde8e8' : '#bbf7d0', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: diasSinRegistro > 0 ? '#d32f2f' : '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarMonthIcon sx={{ color: '#fff', fontSize: 20 }} />
                </Box>
                <Box>
                    <Typography fontWeight={700} color={diasSinRegistro > 0 ? '#9b1c1c' : '#15803d'}>
                        {isLoading ? 'Calculando días...' : `${diasSinRegistro} días sin registro este mes`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Historial de asistencia de {mesActual.locale('es').format('MMMM [de] YYYY')}</Typography>
                </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e0e0e0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <CalendarMonthIcon sx={{ color: '#004680', fontSize: 20 }} />
                        <Typography fontWeight={700} color="#0a1929" sx={{ letterSpacing: 0.5 }}>CALENDARIO DE ASISTENCIA</Typography>
                        <Tooltip title="Haz clic en un día para ver los registros de ese día.">
                            <InfoOutlinedIcon sx={{ fontSize: 16, color: '#90a4ae', cursor: 'help' }} />
                        </Tooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MuiIconButton size="small" onClick={handleMesAnterior}><NavigateBeforeIcon /></MuiIconButton>
                        <Typography variant="subtitle2" fontWeight={600} color="#004680" sx={{ minWidth: 100, textAlign: 'center' }}>
                            {mesActual.locale('es').format('MMM YYYY')}
                        </Typography>
                        <MuiIconButton size="small" onClick={handleMesSiguiente}>
                            <NavigateNextIcon />
                        </MuiIconButton>
                    </Box>
                </Box>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} sx={{ color: '#004680' }} /></Box>
                ) : (
                    <Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <Typography key={d} variant="caption" align="center" fontWeight={600} color="text.secondary">{d}</Typography>)}
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                            {celdas.map((dia, idx) => {
                                if (dia === null) return <Box key={`vacio-${idx}`} />;
                                const fechaDayjs = inicioMes.date(dia);
                                const fecha = fechaDayjs.format('YYYY-MM-DD');
                                const esFuturo = fechaDayjs.isAfter(hoy, 'day');
                                const esHoy = fechaDayjs.isSame(hoy, 'day');
                                const estado = diasEstado[fecha];
                                const esCerrado = estado === 'tienda_cerrada';
                                const holidayName = festivosMap[fecha];
                                const esFestivo = Boolean(holidayName);

                                // --- Modo selección múltiple ---
                                if (modoSeleccion) {
                                    const estaSeleccionado = diasSeleccionados?.has(fecha) ?? false;
                                    // Días cerrados no son seleccionables en modo selección
                                    const seleccionable = !esCerrado && (!esFuturo || puedeGestionar);

                                    let selBg = 'transparent';
                                    let selColor = '#cfd8dc';
                                    let selBorder = 'none';
                                    let selCursor = 'default';

                                    if (esCerrado) {
                                        selBg = '#e2e8f0'; selColor = '#94a3b8'; selBorder = '1.5px solid #cbd5e1';
                                    } else if (estaSeleccionado) {
                                        selBg = '#004680'; selColor = '#fff'; selBorder = 'none'; selCursor = 'pointer';
                                    } else if (seleccionable) {
                                        const baseStyle = colorPorEstado(estado, esFuturo);
                                        selBg = esFestivo && !estado ? '#fef2f2' : baseStyle.bg;
                                        selColor = esFestivo && !estado ? '#dc2626' : baseStyle.color;
                                        selBorder = esFuturo ? '1.5px dashed #0a1929' : (baseStyle.border !== 'none' ? baseStyle.border : esFestivo ? '1px solid #fca5a5' : 'none');
                                        selCursor = 'pointer';
                                    }

                                    const selCell = (
                                        <Box key={fecha} sx={{ position: 'relative', display: 'inline-flex', mx: 'auto' }}>
                                            <Box
                                                onClick={() => seleccionable && handleDateClick(fecha, esCerrado)}
                                                sx={{
                                                    width: 36, height: 36, borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    bgcolor: selBg, color: selColor, fontWeight: 700, fontSize: '0.85rem',
                                                    cursor: selCursor,
                                                    border: selBorder !== 'none' ? selBorder : esHoy ? '1.5px dashed #0a1929' : 'none',
                                                    outline: 'none',
                                                    boxShadow: estaSeleccionado ? '0 4px 12px rgba(0,70,128,0.35)' : 'none',
                                                    transform: estaSeleccionado ? 'scale(1.15)' : 'none',
                                                    zIndex: estaSeleccionado ? 2 : 1,
                                                    transition: 'all 0.15s ease-in-out',
                                                    opacity: !seleccionable && !esCerrado ? 0.35 : 1,
                                                    '&:hover': seleccionable ? { transform: estaSeleccionado ? 'scale(1.15)' : 'scale(1.1)', boxShadow: 2 } : {},
                                                }}
                                            >
                                                {dia}
                                            </Box>
                                            {esFestivo && (
                                                <Box sx={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: '50%', bgcolor: '#dc2626', border: '1px solid #fff', zIndex: 3, pointerEvents: 'none' }} />
                                            )}
                                        </Box>
                                    );

                                    const tooltipText = esCerrado
                                        ? (esFestivo ? `Tienda Cerrada • ${holidayName}` : 'Ya marcado como Tienda Cerrada')
                                        : (esFestivo ? holidayName : undefined);

                                    if (tooltipText) {
                                        return <Tooltip key={fecha} title={tooltipText} arrow>{selCell}</Tooltip>;
                                    }
                                    return selCell;
                                }

                                // --- Modo normal ---
                                const { bg, color, border } = colorPorEstado(estado, esFuturo);
                                const selected = fecha === fechaSeleccionada;
                                const permiteClick = !esFuturo || puedeGestionar;
                                const cellBg = esFestivo && !estado && !esFuturo ? '#fef2f2' : bg;
                                const cellColor = esFestivo && !estado && !esFuturo ? '#dc2626' : color;
                                const cellBorder = border !== 'none' ? border : selected ? '2px solid #ffffff' : esHoy ? '1.5px dashed #0a1929' : esFestivo && !estado ? '1.5px solid #fca5a5' : 'none';

                                const cellContent = (
                                    <Box key={fecha} sx={{ position: 'relative', display: 'inline-flex', mx: 'auto' }}>
                                        <Box
                                            onClick={() => permiteClick && handleDateClick(fecha, esCerrado)}
                                            sx={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: cellBg, color: cellColor, fontWeight: 700, fontSize: '0.85rem',
                                                cursor: permiteClick ? 'pointer' : 'default',
                                                border: cellBorder,
                                                outline: selected ? '3px solid #004680' : 'none',
                                                boxShadow: selected ? '0 4px 10px rgba(0,0,0,0.25)' : 'none',
                                                transform: selected ? 'scale(1.15)' : 'none',
                                                zIndex: selected ? 2 : 1,
                                                transition: 'all 0.15s ease-in-out',
                                                '&:hover': { transform: !permiteClick ? 'none' : selected ? 'scale(1.15)' : 'scale(1.1)', boxShadow: !permiteClick ? 'none' : 2 },
                                            }}
                                        >
                                            {dia}
                                        </Box>
                                        {esFestivo && (
                                            <Box sx={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: '50%', bgcolor: '#dc2626', border: '1px solid #fff', zIndex: 3, pointerEvents: 'none' }} />
                                        )}
                                    </Box>
                                );

                                const tooltipTitle = esCerrado
                                    ? (esFestivo ? `Tienda Cerrada • ${holidayName}` : 'Tienda Cerrada')
                                    : (esFestivo ? holidayName : undefined);

                                if (tooltipTitle) {
                                    return (
                                        <Tooltip key={fecha} title={tooltipTitle} arrow>
                                            {cellContent}
                                        </Tooltip>
                                    );
                                }

                                return cellContent;
                            })}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2.5, mt: 2.5, flexWrap: 'wrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#2e7d32' }} /><Typography variant="caption" color="text.secondary">Registrado Correctamente</Typography></Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ef6c00' }} /><Typography variant="caption" color="text.secondary">Incompleto / Tarde</Typography></Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#d32f2f' }} /><Typography variant="caption" color="text.secondary">Sin Registro</Typography></Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e2e8f0', border: '1.5px solid #cbd5e1' }} /><Typography variant="caption" color="text.secondary">Tienda Cerrada</Typography></Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#fef2f2', border: '1.5px solid #fca5a5', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#dc2626' }} />
                                </Box>
                                <Typography variant="caption" color="#b91c1c" fontWeight={600}>Día Festivo</Typography>
                            </Box>
                            {puedeGestionar && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'transparent', border: '1.5px dashed #0a1929' }} /><Typography variant="caption" color="#0a1929" fontWeight={600}>Día Futuro Habilitado</Typography></Box>
                            )}
                            {modoSeleccion && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#004680' }} /><Typography variant="caption" color="#004680" fontWeight={600}>Día Seleccionado</Typography></Box>
                            )}
                        </Box>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
