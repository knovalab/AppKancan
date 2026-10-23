require('dotenv').config({
	path: require('path').resolve(__dirname, '../.env'),
});

const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar rutas
const informeVentasRoutes = require('./routes/informeVentas');
const contabilizacionRoutes = require('./routes/contabilizacion');

// Importar utilidades
const { dbConfig } = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 11000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check (público)
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas (protegidas)
app.use('/api', informeVentasRoutes);
app.use('/api', contabilizacionRoutes);
const ruletaRoutes = require('./routes/ruleta');
app.use('/api', ruletaRoutes);

const DIST_PATH = path.resolve(process.cwd(), 'dist');

// Servir archivos estáticos del frontend
app.use(express.static(DIST_PATH));

// Para cualquier ruta que no sea API, servir index.html (SPA)
app.get('*', (req, res) => {
	if (req.path.startsWith('/api')) {
		return res.status(404).json({ error: 'Endpoint no encontrado' });
	}

	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.setHeader('Pragma', 'no-cache');
	res.setHeader('Expires', '0');
	res.sendFile(path.join(DIST_PATH, 'index.html'));
});

// Iniciar servidor log
app.listen(PORT, () => {
	console.log(`Servidor iniciado en puerto ${PORT}`);
	console.log(`Conectando a MySQL: ${dbConfig.host}`);
});

module.exports = app;
