import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
import * as dotenv from 'dotenv';
import { initializeFullDatabase } from './utils/database.js';

// Importar middleware de manejo de errores
import { 
  globalErrorHandler, 
  requestIdMiddleware, 
  timeoutMiddleware,
  rateLimitMiddleware,
  responseValidator
} from './middleware/errorHandler.js';

// Importar rutas
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import taskRoutes from './routes/tasks.js';

// Cargar variables de entorno
dotenv.config();

const app = new Hono();

// Middleware de manejo de errores y seguridad (orden importante)
app.use('*', requestIdMiddleware);
app.use('*', globalErrorHandler);
app.use('*', timeoutMiddleware(30000)); // 30 segundos timeout
app.use('*', rateLimitMiddleware(100, 60000)); // 100 requests por minuto
app.use('*', logger());
app.use('*', cors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));
app.use('*', responseValidator);

// Servir archivos estáticos del frontend
app.use('/static/*', serveStatic({ root: './src/frontend' }));
app.use('/*', serveStatic({ root: './src/frontend' }));

// Ruta principal para servir el HTML
app.get('/app', serveStatic({ path: './src/frontend/index.html' }));

// Rutas de API
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/tasks', taskRoutes);

// Ruta de prueba
app.get('/', (c) => {
    return c.json({ 
        message: 'Sistema de Gestión de Mantenimiento API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            tasks: '/api/tasks',
            health: '/health'
        }
    });
});

// Ruta de health check
app.get('/health', (c) => {
    return c.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

const port = parseInt(process.env.PORT || '3000');

console.log(`🚀 Servidor iniciando en puerto ${port}`);

// Inicializar base de datos antes de iniciar el servidor
async function startServer() {
    try {
        await initializeFullDatabase();
        console.log('✅ Base de datos inicializada');
        
        serve({
            fetch: app.fetch,
            port
        });
        
        console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
    } catch (error) {
        console.error('❌ Error al inicializar el servidor:', error);
        process.exit(1);
    }
}

startServer();

export default app;
