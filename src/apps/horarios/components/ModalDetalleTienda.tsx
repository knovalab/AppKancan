import { useState, useCallback } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  Storefront as StorefrontIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/es';

import { getNovedades, fetchTimeRecords, getRecordReasonId, getStoreClosedDays } from '../api/directus/read';
import { createTimeRecord, updateTimeRecord, upsertRecordReason, setStoreClosedDayStatus } from '../api/directus/create';
import { useHorarios } from '../hooks/useHorarios';
import { useHorariosPolicies } from '../hooks/useHorariosPolicies';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';

import {
	calcularMinutosDia,
	formatearHoras,
	calcularHorasSemana,
} from './ModalDetalleTiendaUtils';

import NovedadDetalleModal from './NovedadDetalleModal';
import HistorialHorasModal from './HistorialHorasModal';
import CalendarioMensualTienda from './CalendarioMensualTienda';
import EditHourModal from './EditHourModal';

// Componentes extraídos
import EmpleadosTable from './detalle-tienda/EmpleadosTable';
import ConfirmClosedDayDialogs from './detalle-tienda/ConfirmClosedDayDialogs';
import { ModalDetalleTiendaHeader } from './detalle-tienda/ModalDetalleTiendaHeader';
import CreateHourModal from './detalle-tienda/CreateHourModal';
import { ESTADO, LOG_TYPE } from '../domain/registro';
import { horariosKeys } from '../hooks/registro/keys';
import type { StoreClosedDayDto } from '../interfaces/api/stores';
import type { FilaEmpleadoDetalle } from '../interfaces/ui/monitoreo';

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================
export default function ModalDetalleTienda({
    tiendaId,
    tiendaNombre,
    onClose,
    initialMonth,
}: {
    tiendaId: number;
    tiendaNombre: string;
    onClose: () => void;
    initialMonth?: Dayjs;
}) {
    const { esAdmin, esAreaManager } = useHorariosPolicies();
    const { empleados, loading, reasons } = useHorarios(tiendaId);
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const rowsPerPage = 10;
    const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
        if (initialMonth) return initialMonth.startOf('month').format('YYYY-MM-DD');
        return dayjs().format('YYYY-MM-DD');
    });
    const [novedadModalOpen, setNovedadModalOpen] = useState(false);
    const [novedadSeleccionada, setNovedadSeleccionada] = useState<any>(null);
    const [historialOpen, setHistorialOpen] = useState(false);
    const [empleadoHistorial, setEmpleadoHistorial] = useState<FilaEmpleadoDetalle | null>(null);

    const { showSnackbar } = useGlobalSnackbar();
    const puedeGestionarDiasCerrados = esAdmin() || esAreaManager();

    const [confirmClosedModalOpen, setConfirmClosedModalOpen] = useState(false);
    const [guardandoDiaCerrado, setGuardandoDiaCerrado] = useState(false);

    // ============================================================
    // ESTADO: MODO SELECCIÓN MÚLTIPLE
    // ============================================================
    const [modoSeleccion, setModoSeleccion] = useState(false);
    const [diasSeleccionadosSet, setDiasSeleccionadosSet] = useState<Set<string>>(new Set());
    const [confirmMasivoOpen, setConfirmMasivoOpen] = useState(false);
    const [guardandoMasivo, setGuardandoMasivo] = useState(false);
    // Registros por fecha para el modal masivo (cargados solo al confirmar)
    const [registrosPorFechaSeleccionada, setRegistrosPorFechaSeleccionada] = useState<Record<string, number>>({});

    const handleToggleDia = useCallback((fecha: string) => {
        setDiasSeleccionadosSet(prev => {
            const next = new Set(prev);
            if (next.has(fecha)) next.delete(fecha);
            else next.add(fecha);
            return next;
        });
    }, []);

    const handleActivarModoSeleccion = () => {
        setModoSeleccion(true);
        setDiasSeleccionadosSet(new Set());
    };

    const handleCancelarSeleccion = () => {
        setModoSeleccion(false);
        setDiasSeleccionadosSet(new Set());
    };

    const handleAbrirConfirmMasivo = async () => {
        const fechas = Array.from(diasSeleccionadosSet);
        const counts: Record<string, number> = {};
        await Promise.all(
            fechas.map(async (fecha) => {
                try {
                    const recs = await import('../api/directus/read').then(m => m.fetchTimeRecords(fecha, fecha, tiendaId));
                    counts[fecha] = (recs as any[]).length;
                } catch {
                    counts[fecha] = 0;
                }
            })
        );
        setRegistrosPorFechaSeleccionada(counts);
        setConfirmMasivoOpen(true);
    };

    const handleGuardarMasivo = async () => {
        setGuardandoMasivo(true);
        const fechas = Array.from(diasSeleccionadosSet);
        try {
            await Promise.all(
                fechas.map(fecha => setStoreClosedDayStatus(tiendaId, fecha, true))
            );
            queryClient.invalidateQueries({ queryKey: ['diasCerradosTienda', tiendaId] });
            queryClient.invalidateQueries({ queryKey: ['calendarioAsistencia', tiendaId] });
            showSnackbar(`${fechas.length} día(s) marcados como Tienda Cerrada`, 'success');
            setConfirmMasivoOpen(false);
            setModoSeleccion(false);
            setDiasSeleccionadosSet(new Set());
        } catch (err: any) {
            console.error('Error al guardar masivo:', err);
            showSnackbar(err?.message || 'Error al guardar los días', 'error');
        } finally {
            setGuardandoMasivo(false);
        }
    };

    // Estados para EditHourModal (edición)
    const [editHourOpen, setEditHourOpen] = useState(false);
    const [editData, setEditData] = useState<{
        employeeName: string;
        eventName: string;
        initialTimeStr: string | null;
        initialObservation: string;
        registros: any;
        initialReasonId: number | null;
        recordId: number | null;
    } | null>(null);

    // Estados para CreateHourModal (creación)
    const [createHourOpen, setCreateHourOpen] = useState(false);
    const [createData, setCreateData] = useState<{
        employeeId: string;
        employeeName: string;
        eventName: string;
    } | null>(null);

    const { data: recordsDia = [] } = useQuery({
        queryKey: ['recordsDiaModal', tiendaId, fechaSeleccionada],
        queryFn: () => fetchTimeRecords(fechaSeleccionada, fechaSeleccionada, tiendaId),
        enabled: !!tiendaId,
        staleTime: 5 * 60 * 1000,
    });

    const hoy = dayjs(fechaSeleccionada);
    const diaSemana = hoy.day();
    const lunes = hoy.subtract((diaSemana + 6) % 7, 'day');
    const { data: weekRecords = [] } = useQuery({
        queryKey: ['weekRecords', tiendaId, lunes.format('YYYY-MM-DD')],
        queryFn: () => fetchTimeRecords(
            lunes.format('YYYY-MM-DD'),
            lunes.add(6, 'day').format('YYYY-MM-DD'),
            tiendaId
        ),
        enabled: !!tiendaId,
        staleTime: 5 * 60 * 1000,
    });

    const { data: todasNovedades = [] } = useQuery({
        queryKey: ['todasNovedadesTienda', tiendaId],
        queryFn: () => getNovedades(tiendaId),
        enabled: !!tiendaId,
        staleTime: 5 * 60 * 1000,
    });
    const novedadesDia = todasNovedades.filter((n: any) => n.report_date === fechaSeleccionada);

    const { data: diasCerrados = [] } = useQuery({
        queryKey: ['diasCerradosTienda', tiendaId],
        queryFn: () => getStoreClosedDays(tiendaId),
        enabled: !!tiendaId,
        staleTime: 5 * 60 * 1000,
    });
    const diaCerradoActual = diasCerrados.find((d: StoreClosedDayDto) => d.date === fechaSeleccionada);
    const esDiaCerrado = !!(diaCerradoActual && diaCerradoActual.status === true);

    const handleToggleDiaCerradoClick = () => {
        if (esDiaCerrado) {
            executeToggleDiaCerrado(true);
        } else {
            const numRecords = recordsDia.length;
            if (numRecords > 0) {
                setConfirmClosedModalOpen(true);
            } else {
                executeToggleDiaCerrado(false);
            }
        }
    };

    const executeToggleDiaCerrado = async (actualmenteCerrado: boolean) => {
        setGuardandoDiaCerrado(true);
        try {
            if (actualmenteCerrado && diaCerradoActual) {
                await setStoreClosedDayStatus(tiendaId, fechaSeleccionada, false, diaCerradoActual.id);
                showSnackbar(`Se restableció el ${fechaSeleccionada} como día laboral normal`, 'success');
            } else {
                await setStoreClosedDayStatus(tiendaId, fechaSeleccionada, true, diaCerradoActual?.id);
                showSnackbar(`Se marcó el ${fechaSeleccionada} como Tienda Cerrada`, 'success');
            }
            queryClient.invalidateQueries({ queryKey: ['diasCerradosTienda', tiendaId] });
            queryClient.invalidateQueries({ queryKey: ['calendarioAsistencia', tiendaId] });
        } catch (err: any) {
            console.error('Error al guardar día cerrado:', err);
            showSnackbar(err?.message || 'Error al actualizar el estado del día', 'error');
        } finally {
            setGuardandoDiaCerrado(false);
            setConfirmClosedModalOpen(false);
        }
    };

    const getHora = (empId: string | number, logType: string) => {
        const record = recordsDia.find(r => Number(r.employee_id?.id || r.employee_id) === Number(empId) && r.log_type === logType);
        return record ? (record.record_time || '').substring(0, 5) : null;
    };

    const getRecordId = (empId: string | number, logType: string) => {
        const record = recordsDia.find(r => Number(r.employee_id?.id || r.employee_id) === Number(empId) && r.log_type === logType);
        return record ? record.id : null;
    };

    const getNovedadEmpleado = (empId: string | number) => {
        const novedad = novedadesDia.find(n => Number(n.employee_id?.id || n.employee_id) === Number(empId));
        return novedad ? { tiene: true, tipo: novedad.newness_id?.name || 'Novedad', observacion: novedad.observations || 'Sin observación', id: novedad.id } : null;
    };

    // Construir la unión de empleados para la fecha seleccionada
    const empleadosMap = new Map<string, { id: string | number; nombre: string; documento: string; cargo: string }>();

    empleados.forEach((emp: any) => {
        empleadosMap.set(String(emp.id), {
            id: emp.id,
            nombre: emp.nombre,
            documento: emp.documento || '--',
            cargo: emp.cargo || 'Sin cargo',
        });
    });

    recordsDia.forEach((rec: any) => {
        const empId = rec.employee_id?.id;
        if (empId && !empleadosMap.has(String(empId))) {
            const parts = [
                rec.employee_id.first_name,
                rec.employee_id.middle_name,
                rec.employee_id.last_name,
                rec.employee_id.second_last_name
            ].filter(part => part && part.trim() !== "");
            const fullName = parts.join(" ").trim() || "Empleado Sin Nombre";
            empleadosMap.set(String(empId), {
                id: empId,
                nombre: fullName,
                documento: rec.employee_id.document_number || '--',
                cargo: 'Sin cargo',
            });
        }
    });

    novedadesDia.forEach((nov: any) => {
        const empId = nov.employee_id?.id;
        if (empId && !empleadosMap.has(String(empId))) {
            const parts = [
                nov.employee_id.first_name,
                nov.employee_id.middle_name,
                nov.employee_id.last_name,
                nov.employee_id.second_last_name
            ].filter(part => part && part.trim() !== "");
            const fullName = parts.join(" ").trim() || "Empleado Sin Nombre";
            empleadosMap.set(String(empId), {
                id: empId,
                nombre: fullName,
                documento: '--',
                cargo: 'Sin cargo',
            });
        }
    });

    const filasEmpleados: FilaEmpleadoDetalle[] = Array.from(empleadosMap.values()).map((emp) => {
        const inicioJornada = getHora(emp.id, LOG_TYPE.inicioJornada);
        const inicioAlmuerzo = getHora(emp.id, LOG_TYPE.inicioAlmuerzo);
        const finAlmuerzo = getHora(emp.id, LOG_TYPE.finAlmuerzo);
        const finJornada = getHora(emp.id, LOG_TYPE.finJornada);
        let estado = 'Pendiente';
        if (finJornada) estado = ESTADO.jornadaFinalizada;
        else if (finAlmuerzo) estado = ESTADO.regresoAlmuerzo;
        else if (inicioAlmuerzo) estado = ESTADO.enAlmuerzo;
        else if (inicioJornada) estado = ESTADO.jornadaIniciada;
        const novedad = getNovedadEmpleado(emp.id);
        const horasSemana = calcularHorasSemana(emp.id, weekRecords);
        const minutosDia = calcularMinutosDia(recordsDia, emp.id);
        const horasDia = formatearHoras(minutosDia);
        return {
            id: String(emp.id), nombre: emp.nombre, documento: emp.documento, cargo: emp.cargo,
            inicioJornada, inicioAlmuerzo, finAlmuerzo, finJornada, estado,
            tieneNovedad: !!novedad, novedadTipo: novedad?.tipo || '', novedadObservacion: novedad?.observacion || '', novedadId: novedad?.id || '',
            horasDia, horasSemana,
        };
    });

    const empleadosFiltrados = filasEmpleados.filter(f =>
        f.nombre.toLowerCase().includes(search.toLowerCase()) || f.documento.includes(search)
    );
    const empleadosPagina = empleadosFiltrados.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    const fechaDisplay = dayjs(fechaSeleccionada).locale('es').format('dddd, D [de] MMMM [de] YYYY');

    const handleNovedadClick = (fila: FilaEmpleadoDetalle) => {
        setNovedadSeleccionada({ tipo: fila.novedadTipo || 'Novedad', observacion: fila.novedadObservacion || 'Sin observación', empleadoNombre: fila.nombre });
        setNovedadModalOpen(true);
    };

    const handleOpenHistorial = (fila: FilaEmpleadoDetalle) => {
        setEmpleadoHistorial(fila);
        setHistorialOpen(true);
    };

    const handleDayClick = (fecha: string, empleadoNombre: string) => {
        setFechaSeleccionada(fecha);
        setSearch(empleadoNombre);
        setPage(0);
    };

    const handleClearFilters = () => {
        setFechaSeleccionada(dayjs().format('YYYY-MM-DD'));
        setSearch('');
        setPage(0);
    };

    // ============================================================
    // FUNCIÓN PARA ABRIR MODAL DE EDICIÓN
    // ============================================================
    const handleOpenEditHour = async (empleadoId: string, empleadoNombre: string, evento: string, recordId: number) => {
        if (!esAdmin()) return;

        const horaActual = getHora(empleadoId, evento);
        const observacionActual = recordsDia.find(r => r.id === recordId)?.observations || '';
        let reasonId: number | null = null;
        if (recordId) {
            try {
                reasonId = await getRecordReasonId(recordId);
            } catch (e) {
                console.error('Error al obtener motivo:', e);
            }
        }

        const empleadoData = filasEmpleados.find(f => f.id === empleadoId);
        const registros = empleadoData ? {
            inicioJornada: empleadoData.inicioJornada,
            inicioAlmuerzo: empleadoData.inicioAlmuerzo,
            finAlmuerzo: empleadoData.finAlmuerzo,
            finJornada: empleadoData.finJornada,
            observaciones: empleadoData,
            ids: {
                inicioJornada: getRecordId(empleadoId, LOG_TYPE.inicioJornada),
                inicioAlmuerzo: getRecordId(empleadoId, LOG_TYPE.inicioAlmuerzo),
                finAlmuerzo: getRecordId(empleadoId, LOG_TYPE.finAlmuerzo),
                finJornada: getRecordId(empleadoId, LOG_TYPE.finJornada),
            },
            horasOriginales: {},
            horasEditadas: {},
        } : {};

        setEditData({
            employeeName: empleadoNombre,
            eventName: evento,
            initialTimeStr: horaActual,
            initialObservation: observacionActual,
            registros: registros,
            initialReasonId: reasonId,
            recordId: recordId,
        });
        setEditHourOpen(true);
    };

    const handleCloseEditHour = () => {
        setEditHourOpen(false);
        setEditData(null);
    };

    const handleConfirmEdit = async (horaFormateada: string, observacion: string, reasonId: number | null) => {
        if (!editData || !editData.recordId) return;
        try {
            const parsed = dayjs(horaFormateada, 'hh:mm A');
            const recordTime = parsed.format('HH:mm:ss');

            const existingRecord = recordsDia.find(r => r.id === editData.recordId);
            const originalTime = existingRecord
                ? (existingRecord.original_record_time || existingRecord.record_time)
                : undefined;

            await updateTimeRecord(editData.recordId, {
                record_time: recordTime,
                original_record_time: originalTime,
                observations: observacion,
            });

            if (reasonId) {
                await upsertRecordReason(editData.recordId, reasonId);
            }

            queryClient.invalidateQueries({ queryKey: ['recordsDiaModal', tiendaId, fechaSeleccionada] });
            queryClient.invalidateQueries({ queryKey: horariosKeys.timeRecords.todos });
            handleCloseEditHour();
        } catch (error) {
            console.error('Error al editar hora:', error);
            throw error;
        }
    };

    // ============================================================
    // FUNCIÓN PARA ABRIR MODAL DE CREACIÓN
    // ============================================================
    const handleOpenCreateHour = (empleadoId: string, empleadoNombre: string, evento: string) => {
        if (!esAdmin()) return;
        setCreateData({ employeeId: empleadoId, employeeName: empleadoNombre, eventName: evento });
        setCreateHourOpen(true);
    };

    const handleCloseCreateHour = () => {
        setCreateHourOpen(false);
        setCreateData(null);
    };

    const handleConfirmCreate = async (horaFormateada: string, observacion: string) => {
        if (!createData) return;
        try {
            const parsed = dayjs(horaFormateada, 'hh:mm A');
            const recordTime = parsed.format('HH:mm:ss');
            const recordDate = fechaSeleccionada;

            const nuevo = await createTimeRecord({
                employee_id: Number(createData.employeeId),
                store_id: tiendaId,
                log_type: createData.eventName,
                record_date: recordDate,
                record_time: recordTime,
                observations: observacion,
            });

            if (!nuevo || !nuevo.id) {
                throw new Error('No se recibió respuesta del servidor o el ID está vacío');
            }

            queryClient.invalidateQueries({ queryKey: ['recordsDiaModal', tiendaId, fechaSeleccionada] });
            queryClient.invalidateQueries({ queryKey: horariosKeys.timeRecords.todos });
            handleCloseCreateHour();
        } catch (error: any) {
            console.error('Error detallado al crear hora:', error);
            throw error;
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: 3,
                        overflow: 'hidden',
                        height: '90vh',
                        maxHeight: '90vh'
                    }
                }
            }}
        >
            <DialogTitle component="div" sx={{ bgcolor: '#004680', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, px: 3 }}>
                <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StorefrontIcon sx={{ fontSize: 24 }} /> {tiendaNombre}
                </Typography>
                <IconButton onClick={onClose} sx={{ color: '#fff' }}><CloseIcon /></IconButton>
            </DialogTitle>

            <Box sx={{ bgcolor: '#f8f9fa', flex: 1, overflow: 'auto' }}>
                <DialogContent sx={{ p: 3, bgcolor: 'transparent' }}>
                    <CalendarioMensualTienda
                        tiendaId={tiendaId}
                        totalEmpleados={filasEmpleados.length}
                        fechaSeleccionada={fechaSeleccionada}
                        onDateSelect={(fecha) => {
                            setFechaSeleccionada(fecha);
                            setSearch('');
                            setPage(0);
                        }}
                        todasNovedades={todasNovedades}
                        puedeGestionar={puedeGestionarDiasCerrados}
                        modoSeleccion={modoSeleccion}
                        diasSeleccionados={diasSeleccionadosSet}
                        onToggleDia={handleToggleDia}
                    />

                    {/* Header y Barra de Selección Flotante */}
                    <ModalDetalleTiendaHeader
                        modoSeleccion={modoSeleccion}
                        diasSeleccionadosSet={diasSeleccionadosSet}
                        handleCancelarSeleccion={handleCancelarSeleccion}
                        handleAbrirConfirmMasivo={handleAbrirConfirmMasivo}
                        fechaDisplay={fechaDisplay}
                        esDiaCerrado={esDiaCerrado}
                        puedeGestionarDiasCerrados={puedeGestionarDiasCerrados}
                        handleActivarModoSeleccion={handleActivarModoSeleccion}
                        handleToggleDiaCerradoClick={handleToggleDiaCerradoClick}
                        guardandoDiaCerrado={guardandoDiaCerrado}
                        fechaSeleccionada={fechaSeleccionada}
                        handleClearFilters={handleClearFilters}
                    />

                    {/* Tabla de Empleados Extraída */}
                    <EmpleadosTable
                        loading={loading}
                        search={search}
                        setSearch={setSearch}
                        page={page}
                        setPage={setPage}
                        rowsPerPage={rowsPerPage}
                        empleadosPagina={empleadosPagina}
                        empleadosFiltrados={empleadosFiltrados}
                        fechaSeleccionada={fechaSeleccionada}
                        esAdminUser={esAdmin()}
                        getRecordId={getRecordId}
                        handleOpenEditHour={handleOpenEditHour}
                        handleOpenCreateHour={handleOpenCreateHour}
                        handleOpenHistorial={handleOpenHistorial}
                        handleNovedadClick={handleNovedadClick}
                    />
                </DialogContent>
            </Box>

            <HistorialHorasModal
                open={historialOpen}
                onClose={() => { setHistorialOpen(false); setEmpleadoHistorial(null); }}
                empleado={empleadoHistorial}
                tiendaId={tiendaId}
                todasNovedades={todasNovedades}
                onDayClick={handleDayClick}
            />

            {novedadSeleccionada && (
                <NovedadDetalleModal
                    open={novedadModalOpen}
                    onClose={() => { setNovedadModalOpen(false); setNovedadSeleccionada(null); }}
                    tipo={novedadSeleccionada.tipo}
                    observacion={novedadSeleccionada.observacion}
                    empleadoNombre={novedadSeleccionada.empleadoNombre}
                />
            )}

            {/* MODAL DE EDICIÓN */}
            {editData && (
                <EditHourModal
                    open={editHourOpen}
                    onClose={handleCloseEditHour}
                    employeeName={editData.employeeName}
                    eventName={editData.eventName}
                    initialTimeStr={editData.initialTimeStr}
                    initialObservation={editData.initialObservation}
                    reasons={reasons}
                    initialReasonId={editData.initialReasonId}
                    registros={editData.registros}
                    onConfirm={handleConfirmEdit}
                    motivoRequerido={true}
                />
            )}

            {/* MODAL DE CREACIÓN EXTRAÍDO */}
            {createData && (
                <CreateHourModal
                    open={createHourOpen}
                    onClose={handleCloseCreateHour}
                    employeeName={createData.employeeName}
                    eventName={createData.eventName}
                    onConfirm={handleConfirmCreate}
                />
            )}

            {/* DIÁLOGOS DE CONFIRMACIÓN EXTRAÍDOS */}
            <ConfirmClosedDayDialogs
                confirmClosedModalOpen={confirmClosedModalOpen}
                setConfirmClosedModalOpen={setConfirmClosedModalOpen}
                fechaDisplay={fechaDisplay}
                recordsDiaCount={recordsDia.length}
                guardandoDiaCerrado={guardandoDiaCerrado}
                executeToggleDiaCerrado={executeToggleDiaCerrado}
                confirmMasivoOpen={confirmMasivoOpen}
                setConfirmMasivoOpen={setConfirmMasivoOpen}
                diasSeleccionadosSet={diasSeleccionadosSet}
                tiendaNombre={tiendaNombre}
                registrosPorFechaSeleccionada={registrosPorFechaSeleccionada}
                guardandoMasivo={guardandoMasivo}
                handleGuardarMasivo={handleGuardarMasivo}
            />
        </Dialog>
    );
}