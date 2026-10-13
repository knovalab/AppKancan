import React from 'react';
import {
  Box, Container, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Avatar, Chip, CircularProgress,
  IconButton, Tooltip, TextField, Pagination
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  Storefront as StorefrontIcon,
  Warning as WarningIcon,
  AddCircle as AddCircleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import { FestivoDay } from '../../components/FestivoDay';
import { LOG_TYPE } from '../../domain/registro';

interface DetallePlanillaTablaProps {
  fechaSeleccionada: Dayjs;
  handleFechaChange: (newDate: Dayjs | null) => void;
  setCalendarYear: (year: number) => void;
  festivosMap: Record<string, string>;
  CustomActionBar: React.ComponentType<any>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isLoading: boolean;
  filasPagina: any[];
  recordsPorTienda: Record<number, any[]>;
  esAdmin: boolean;
  isAreaMgr: boolean;
  handleOpenEditHour: (fila: any, label: string, recordId: number, hora: string | null) => void;
  handleOpenCreateHour: (employeeId: string, nombre: string, label: string, tiendaId: number) => void;
  filasFiltradasLength: number;
  rowsPerPage: number;
  page: number;
  setPage: (p: number) => void;
}

export const DetallePlanillaTabla: React.FC<DetallePlanillaTablaProps> = React.memo(({
  fechaSeleccionada,
  handleFechaChange,
  setCalendarYear,
  festivosMap,
  CustomActionBar,
  searchTerm,
  setSearchTerm,
  isLoading,
  filasPagina,
  recordsPorTienda,
  esAdmin,
  isAreaMgr,
  handleOpenEditHour,
  handleOpenCreateHour,
  filasFiltradasLength,
  rowsPerPage,
  page,
  setPage,
}) => {
  return (
    <Box sx={{ backgroundColor: '#f5f7fa', pt: 0.5, pb: 1.5 }}>
      <Container maxWidth="xl">
        <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, mb: 1.5, borderRadius: 3, border: '1px solid #e0e0e0', bgcolor: 'transparent' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="h5" fontWeight={700} color="#0a1929" sx={{ textTransform: 'uppercase', fontSize: { xs: '1rem', sm: '1.3rem' } }}>
              EDITAR REGISTROS
            </Typography>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, borderRadius: 3, border: '1px solid #e0e0e0', bgcolor: 'transparent' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <DatePicker
                label="Seleccionar día"
                value={fechaSeleccionada}
                onChange={(value) => handleFechaChange(value as Dayjs | null)}
                onMonthChange={(m: any) => setCalendarYear(dayjs(m).year())}
                onYearChange={(y: any) => setCalendarYear(dayjs(y).year())}
                slotProps={{
                  day: { holidays: festivosMap } as any,
                  textField: {
                    size: 'small',
                    sx: { width: { xs: '100%', sm: 300 } },
                  },
                  actionBar: {
                    actions: [],
                  },
                  layout: {
                    sx: {
                      display: 'flex',
                      flexDirection: 'row-reverse',
                    }
                  }
                }}
                slots={{
                  day: FestivoDay,
                  actionBar: CustomActionBar,
                }}
              />
            </LocalizationProvider>

            <TextField
              size="small"
              placeholder="Buscar empleado..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              sx={{ width: 520 }}
            />

            <Typography variant="body2" fontWeight={600} color="#64748b" sx={{ fontSize: '0.9rem' }}>
              {fechaSeleccionada.format('dddd, D [de] MMMM [de] YYYY')}
            </Typography>
          </Box>
        </Paper>

        <TableContainer 
          component={Paper} 
          elevation={0} 
          sx={{ 
            borderRadius: 3, 
            border: '1px solid #e0e0e0', 
            overflowX: 'auto',
            bgcolor: 'transparent',
          }}
        >
          <Table size="medium" sx={{ minWidth: { xs: 700, md: '80%' } }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#546e7a', whiteSpace: 'nowrap' }}>TIENDA</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#546e7a', whiteSpace: 'nowrap' }}>EMPLEADO</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#546e7a', whiteSpace: 'nowrap' }}>CARGO</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#004680', bgcolor: '#e3f2fd', whiteSpace: 'nowrap' }}>INICIO JORNADA</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#004680', bgcolor: '#e3f2fd', whiteSpace: 'nowrap' }}>INICIO ALMUERZO</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#004680', bgcolor: '#e3f2fd', whiteSpace: 'nowrap' }}>FIN ALMUERZO</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#004680', bgcolor: '#e3f2fd', whiteSpace: 'nowrap' }}>FIN JORNADA</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#546e7a', whiteSpace: 'nowrap' }}>TOTAL HORAS</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#546e7a', whiteSpace: 'nowrap' }}>NOVEDADES</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress sx={{ color: '#004680' }} /></TableCell></TableRow>
              ) : filasPagina.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>{searchTerm ? 'No hay empleados con ese nombre.' : 'No hay registros para este día.'}</TableCell></TableRow>
              ) : (
                filasPagina.map((fila, idx) => {
                  const eventosHoras = [
                    { key: 'inicioJornada', label: LOG_TYPE.inicioJornada, hora: fila.inicioJornada, recordId: fila.recordIdInicioJornada },
                    { key: 'inicioAlmuerzo', label: LOG_TYPE.inicioAlmuerzo, hora: fila.inicioAlmuerzo, recordId: fila.recordIdInicioAlmuerzo },
                    { key: 'finAlmuerzo', label: LOG_TYPE.finAlmuerzo, hora: fila.finAlmuerzo, recordId: fila.recordIdFinAlmuerzo },
                    { key: 'finJornada', label: LOG_TYPE.finJornada, hora: fila.finJornada, recordId: fila.recordIdFinJornada },
                  ];

                  const employeeId = fila.id.includes('_') ? fila.id.split('_')[1] : fila.id;
                  const recordsTienda = recordsPorTienda[fila.tiendaId] || [];

                  return (
                    <TableRow key={fila.id} hover sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <StorefrontIcon sx={{ color: '#004680', fontSize: 16 }} />
                          <Typography variant="body2" fontWeight={600} noWrap>{fila.tienda}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: '#004680', fontSize: '0.7rem' }}>{fila.nombre.charAt(0)}</Avatar>
                          <Typography variant="body2" fontWeight={600} noWrap>{fila.nombre}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" noWrap>{fila.cargo}</Typography></TableCell>

                      {eventosHoras.map((evento) => {
                        const esHoraExistente = !!evento.hora;
                        const esNoAplica = !esHoraExistente && fila.tieneNovedad;
                        const puedeEditar = esAdmin || isAreaMgr;
                        
                        const record = recordsTienda.find(r => r.id === evento.recordId);
                        const observacion = record?.observations || '';

                        const tooltipTitle = esHoraExistente
                          ? (observacion ? `Observación: ${observacion}` : 'Sin observación')
                          : esNoAplica
                          ? `No aplica (${fila.novedadTipo || 'Novedad'})`
                          : 'Sin observación registrada';

                        return (
                          <TableCell key={evento.key} align="center">
                            <Tooltip title={tooltipTitle} arrow>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.3 }}>
                                {esHoraExistente ? (
                                  <Chip
                                    size="small"
                                    icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                                    label={evento.hora}
                                    sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600, height: 24, fontSize: '0.7rem' }}
                                  />
                                ) : esNoAplica ? (
                                  <Chip
                                    size="small"
                                    label="No Aplica"
                                    sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 600, height: 24, fontSize: '0.7rem' }}
                                  />
                                ) : (
                                  <Chip
                                    size="small"
                                    icon={<AccessTimeIcon sx={{ fontSize: 12 }} />}
                                    label="Pendiente"
                                    sx={{ bgcolor: '#f5f5f5', color: '#757575', fontWeight: 600, height: 24, fontSize: '0.7rem' }}
                                  />
                                )}
                                {puedeEditar && !esNoAplica && (
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      if (esHoraExistente && evento.recordId) {
                                        handleOpenEditHour(fila, evento.label, evento.recordId, evento.hora);
                                      } else {
                                        handleOpenCreateHour(
                                          employeeId,
                                          fila.nombre,
                                          evento.label,
                                          fila.tiendaId
                                        );
                                      }
                                    }}
                                    sx={{ p: 0.2, color: '#004680' }}
                                  >
                                    {esHoraExistente ? <EditIcon fontSize="small" /> : <AddCircleIcon fontSize="small" />}
                                  </IconButton>
                                )}
                              </Box>
                            </Tooltip>
                          </TableCell>
                        );
                      })}

                      <TableCell align="center"><Typography variant="body2" fontWeight={600}>{fila.horasDia}</Typography></TableCell>
                      
                      <TableCell align="center">
                        {fila.tieneNovedad ? (
                          <Chip size="small" icon={<WarningIcon sx={{ fontSize: 12 }} />} label={fila.novedadTipo || 'Novedad'} sx={{ bgcolor: '#ffebee', color: '#c62828', fontWeight: 600, height: 24, fontSize: '0.7rem' }} />
                        ) : (
                          <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 12 }} />} label="Sin novedad" sx={{ bgcolor: '#f5f5f5', color: '#757575', height: 24, fontSize: '0.7rem' }} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {!isLoading && filasFiltradasLength > rowsPerPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Pagination
                count={Math.ceil(filasFiltradasLength / rowsPerPage)}
                page={page + 1}
                onChange={(_, newPage) => setPage(newPage - 1)}
                color="primary"
                shape="rounded"
                size="small"
              />
            </Box>
          )}
        </TableContainer>
      </Container>
    </Box>
  );
});
