import { useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Tabs, Tab, Button, Box, IconButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';

export default function NavbarHorarios() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = location.pathname.split('/').pop() || 'registros';

  return (
    <AppBar position="static" color="inherit" elevation={1} sx={{ borderBottom: '1px solid #e0e0e0' }}>
      <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Tabs 
            value={currentTab} 
            onChange={(_, value) => navigate(value)}
            textColor="primary" 
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': { fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '0.5px' }
            }}
          >
            <Tab label="REGISTROS" value="registros" />
            <Tab label="NOVEDADES" value="novedades" disabled />
            <Tab label="HISTORIAL" value="historial" disabled />
            <Tab label="MALLA HORARIA" value="malla-horaria" disabled />
          </Tabs>

          <Button 
            variant="contained" 
            color="success" 
            startIcon={<RefreshIcon />}
            size="small"
            sx={{ bgcolor: '#2e7d32', fontWeight: 'bold', px: 2 }}
          >
            REFRESCAR
          </Button>
        </Box>

        <IconButton color="default" sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}