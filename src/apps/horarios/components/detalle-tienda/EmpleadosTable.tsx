import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Pagination, TextField, InputAdornment, IconButton, Tooltip, Avatar
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HistoryIcon from '@mui/icons-material/History';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { EmpleadoFila, getNovedadIcon } from '../ModalDetalleTiendaUtils';
import { ESTADO, LOG_TYPE } from '../../domain/registro';

interface EmpleadosTableProps {
  loading: boolean;
  search: string;
  setSearch: (val: string) => void;
  page: number;
  setPage: (p: number) => void;
  rowsPerPage: number;
  empleadosPagina: EmpleadoFila[];
  empleadosFiltrados: EmpleadoFila[];
  fechaSeleccionada: string;
  esAdminUser: boolean;
  getRecordId: (empId: string | number, logType: string) => number | null;
  handleOpenEditHour: (empleadoId: string, empleadoNombre: string, evento: string, recordId: number) => void;
  handleOpenCreateHour: (empleadoId: string, empleadoNombre: string, evento: string) => void;
  handleOpenHistorial: (fila: EmpleadoFila) => void;
  handleNovedadClick: (fila: EmpleadoFila) => void;
}

export default function EmpleadosTable({
  loading,
  search,
  setSearch,
  page,
  setPage,
  rowsPerPage,
  empleadosPagina,
  empleadosFiltrados,
  fechaSeleccionada,
  esAdminUser,
  getRecordId,
  handleOpenEditHour,
  handleOpenCreateHour,
  handleOpenHistorial,
  handleNovedadClick
}: EmpleadosTableProps) {
  return (
    <>
      <TextField
        placeholder="Buscar por nombre o documento..."
        size="small"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        fullWidth
        sx={{ mb: 3, bgcolor: '#ffffff', borderRadius: 2 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} /></InputAdornment> } }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: '#004680' }} /></Box>
      ) : (
        <TableContainer
          key={fechaSeleccionada}
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 3,
            border: '1px solid #e0e0e0',
            mb: 2,
            bgcolor: '#ffffff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <Table size="small">
            <TableHead sx={{ bgcolor: '#e8edf3' }}>
              <TableRow>
                {['EMPLEADO', 'INICIO JORNADA', 'INICIO ALMUERZO', 'FIN ALMUERZO', 'FIN JORNADA', 'ESTADO', 'HORAS DÍA', 'HORAS SEMANA', 'NOVEDADES'].map(text => (
                  <TableCell key={text} sx={{ fontWeight: 700, fontSize: '0.75rem' }} align={text === 'NOVEDADES' ? 'center' : 'left'}>{text}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {empleadosPagina.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay registros</TableCell></TableRow>
              ) : (
                empleadosPagina.map((fila, idx) => {
                  const eventos = [
                    { key: 'inicioJornada', label: LOG_TYPE.inicioJornada },
                    { key: 'inicioAlmuerzo', label: LOG_TYPE.inicioAlmuerzo },
                    { key: 'finAlmuerzo', label: LOG_TYPE.finAlmuerzo },
                    { key: 'finJornada', label: LOG_TYPE.finJornada },
                  ];
                  return (
                    <TableRow key={fila.id} hover sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#004680', fontSize: '0.75rem' }}>{fila.nombre.charAt(0)}</Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600} fontSize="0.82rem">{fila.nombre}</Typography>
                            <Typography variant="caption" color="text.secondary" fontSize="0.7rem" display="block">{fila.cargo}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      {eventos.map(({ key, label }) => {
                        const hora = fila[key as keyof EmpleadoFila] as string | null;
                        const recordId = getRecordId(fila.id, label);
                        const isHoraExistente = !!hora;

                        return (
                          <TableCell key={key}>
                            {isHoraExistente ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Chip
                                  size="small"
                                  icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                                  label={hora}
                                  sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600, fontSize: '0.7rem' }}
                                />
                                {esAdminUser && (
                                  <Tooltip title="Editar hora">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        if (recordId) {
                                          handleOpenEditHour(fila.id, fila.nombre, label, recordId);
                                        }
                                      }}
                                      sx={{ p: 0.5, color: '#004680' }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Chip
                                  size="small"
                                  icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                                  label="Pendiente"
                                  sx={{ bgcolor: '#f5f5f5', color: '#757575', fontWeight: 600, fontSize: '0.7rem' }}
                                />
                                {esAdminUser && (
                                  <Tooltip title="Agregar hora">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        handleOpenCreateHour(fila.id, fila.nombre, label);
                                      }}
                                      sx={{ p: 0.5, color: '#004680' }}
                                    >
                                      <AddCircleIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        {(() => {
                          let labelEstado = 'Sin Registro';
                          let colorEstado = '#757575';
                          let bgEstado = '#f5f5f5';

                          if (fila.tieneNovedad) {
                            labelEstado = 'No Aplica';
                            colorEstado = '#0d47a1';
                            bgEstado = '#e3f2fd';
                          } else if (fila.estado === ESTADO.jornadaFinalizada) {
                            labelEstado = 'Finalizado';
                            colorEstado = '#2e7d32';
                            bgEstado = '#e8f5e9';
                          } else if (fila.estado === 'Pendiente') {
                            labelEstado = 'Sin Registro';
                            colorEstado = '#757575';
                            bgEstado = '#f5f5f5';
                          } else {
                            labelEstado = 'En curso';
                            colorEstado = '#856404';
                            bgEstado = '#fff3cd';
                          }

                          return (
                            <Chip
                              size="small"
                              label={labelEstado}
                              sx={{
                                bgcolor: bgEstado,
                                color: colorEstado,
                                fontWeight: 700,
                                fontSize: '0.7rem'
                              }}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="#0a1929">{fila.horasDia}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={700} color="#004680">{fila.horasSemana}</Typography>
                          <IconButton size="small" onClick={() => handleOpenHistorial(fila)} sx={{ color: '#004680', bgcolor: '#e3f2fd', '&:hover': { bgcolor: '#bbdefb' }, p: 0.5 }}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        {fila.tieneNovedad ? (
                          <Chip size="small" label={fila.novedadTipo} onClick={() => handleNovedadClick(fila)} icon={getNovedadIcon(fila.novedadTipo || 'Novedad')} sx={{ bgcolor: '#fde8e8', color: '#b71c1c', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer', '&:hover': { bgcolor: '#fccfcf' } }} />
                        ) : (
                          <Chip size="small" label="Sin novedad" variant="outlined" sx={{ color: '#9e9e9e', fontWeight: 400, fontSize: '0.7rem', borderColor: '#e0e0e0' }} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 1.5, borderTop: '1px solid #e0e0e0', bgcolor: '#fafbfc' }}>
            <Typography variant="caption" color="text.secondary">Mostrando {empleadosPagina.length} de {empleadosFiltrados.length} empleados</Typography>
            {empleadosFiltrados.length > rowsPerPage && (
              <Pagination count={Math.ceil(empleadosFiltrados.length / rowsPerPage)} page={page + 1} onChange={(_, p) => setPage(p - 1)} color="primary" shape="rounded" size="small" />
            )}
          </Box>
        </TableContainer>
      )}
    </>
  );
}
