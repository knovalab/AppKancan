import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

export default function HorariosLayout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'none' }}>
      <Outlet />
    </Box>
  );
}