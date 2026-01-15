import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { DashboardService } from '../services/DashboardService.js';
import { ReportService, ReportFilters, ExportFormat } from '../services/ReportService.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const dashboardRoutes = new Hono();
const dashboardService = new DashboardService();
const reportService = new ReportService();

// Middleware de autenticación para todas las rutas
dashboardRoutes.use('*', authMiddleware);

/**
 * GET /dashboard
 * Obtener datos completos del dashboard
 * Operadores ven solo sus datos, supervisores y admins ven datos generales
 */
dashboardRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    
    // Los operadores solo ven sus propios datos
    const userId = user.role === 'operator' ? user.userId : undefined;
    
    const dashboardData = await dashboardService.getDashboardData(userId);

    return c.json({
      success: true,
      data: dashboardData,
      message: 'Datos del dashboard obtenidos exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo datos del dashboard:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /dashboard/summary
 * Obtener resumen rápido del dashboard
 */
dashboardRoutes.get('/summary', async (c) => {
  try {
    const user = c.get('user');
    const userId = user.role === 'operator' ? user.userId : undefined;
    
    const summary = await dashboardService.getQuickSummary(userId);

    return c.json({
      success: true,
      data: summary,
      message: 'Resumen del dashboard obtenido exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo resumen del dashboard:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /dashboard/tasks
 * Obtener resumen de tareas para el dashboard
 */
dashboardRoutes.get('/tasks', async (c) => {
  try {
    const user = c.get('user');
    const userId = user.role === 'operator' ? user.userId : undefined;
    
    const taskSummary = await dashboardService.getTaskSummary(userId);

    return c.json({
      success: true,
      data: taskSummary,
      message: 'Resumen de tareas obtenido exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo resumen de tareas:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /dashboard/activity
 * Obtener actividad reciente
 */
dashboardRoutes.get('/activity', async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '10');
    
    const userId = user.role === 'operator' ? user.userId : undefined;
    
    const recentActivity = await dashboardService.getRecentActivity(userId, Math.min(limit, 50));

    return c.json({
      success: true,
      data: recentActivity,
      message: 'Actividad reciente obtenida exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo actividad reciente:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /dashboard/upcoming
 * Obtener tareas próximas
 */
dashboardRoutes.get('/upcoming', async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '5');
    
    const userId = user.role === 'operator' ? user.userId : undefined;
    
    const upcomingTasks = await dashboardService.getUpcomingTasks(userId, Math.min(limit, 20));

    return c.json({
      success: true,
      data: upcomingTasks,
      message: 'Tareas próximas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo tareas próximas:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /dashboard/performance
 * Obtener métricas de rendimiento
 * Requiere rol: supervisor o admin
 */
dashboardRoutes.get('/performance', requireRole('supervisor'), async (c) => {
  try {
    const user = c.get('user');
    const userId = user.role === 'supervisor' ? user.userId : undefined;
    
    const performanceMetrics = await dashboardService.getPerformanceMetrics(userId);

    return c.json({
      success: true,
      data: performanceMetrics,
      message: 'Métricas de rendimiento obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo métricas de rendimiento:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /dashboard/alerts
 * Obtener alertas del sistema
 */
dashboardRoutes.get('/alerts', async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '10');
    
    const userId = user.role === 'operator' ? user.userId : undefined;
    
    const alerts = await dashboardService.getAlerts(userId, Math.min(limit, 50));

    return c.json({
      success: true,
      data: alerts,
      message: 'Alertas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /reports/productivity
 * Generar reporte de productividad
 * Requiere rol: supervisor o admin
 */
dashboardRoutes.get('/reports/productivity', requireRole('supervisor'), async (c) => {
  try {
    // User available for future use
    
    // Obtener parámetros de filtro
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const userId = c.req.query('userId');
    const taskType = c.req.query('taskType') as 'electrical' | 'mechanical' | undefined;
    const priority = c.req.query('priority') as 'low' | 'medium' | 'high' | 'urgent' | undefined;
    const status = c.req.query('status') as 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined;

    // Construir filtros
    const filters: ReportFilters = {};
    
    if (startDate) {
      const date = new Date(startDate);
      if (!isNaN(date.getTime())) {
        filters.startDate = date;
      }
    }
    
    if (endDate) {
      const date = new Date(endDate);
      if (!isNaN(date.getTime())) {
        filters.endDate = date;
      }
    }
    
    if (userId) {
      filters.userId = userId;
    }
    
    if (taskType && ['electrical', 'mechanical'].includes(taskType)) {
      filters.taskType = taskType;
    }
    
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      filters.priority = priority;
    }
    
    if (status && ['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      filters.status = status;
    }

    const report = await reportService.generateProductivityReport(filters);

    return c.json({
      success: true,
      data: report,
      message: 'Reporte de productividad generado exitosamente'
    });
  } catch (error) {
    console.error('Error generando reporte de productividad:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /reports/performance
 * Generar reporte de rendimiento
 * Requiere rol: supervisor o admin
 */
dashboardRoutes.get('/reports/performance', requireRole('supervisor'), async (c) => {
  try {
    // Obtener parámetros de filtro
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const filters: ReportFilters = {};
    
    if (startDate) {
      const date = new Date(startDate);
      if (!isNaN(date.getTime())) {
        filters.startDate = date;
      }
    }
    
    if (endDate) {
      const date = new Date(endDate);
      if (!isNaN(date.getTime())) {
        filters.endDate = date;
      }
    }

    const report = await reportService.generatePerformanceReport(filters);

    return c.json({
      success: true,
      data: report,
      message: 'Reporte de rendimiento generado exitosamente'
    });
  } catch (error) {
    console.error('Error generando reporte de rendimiento:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /reports/export
 * Exportar reporte en formato específico
 * Requiere rol: supervisor o admin
 */
dashboardRoutes.post('/reports/export', requireRole('supervisor'), async (c) => {
  try {
    const body = await c.req.json();
    const { reportType, format, filters, title } = body;

    // Validar parámetros
    if (!reportType || !['productivity', 'performance'].includes(reportType)) {
      throw new HTTPException(400, { message: 'Tipo de reporte inválido' });
    }

    if (!format || !['json', 'csv', 'pdf'].includes(format)) {
      throw new HTTPException(400, { message: 'Formato de exportación inválido' });
    }

    // Generar el reporte según el tipo
    let reportData;
    if (reportType === 'productivity') {
      reportData = await reportService.generateProductivityReport(filters || {});
    } else if (reportType === 'performance') {
      reportData = await reportService.generatePerformanceReport(filters || {});
    }

    // Exportar en el formato solicitado
    const exportedData = await reportService.exportReport(
      reportData,
      format as ExportFormat,
      title || `Reporte de ${reportType}`
    );

    // Configurar headers según el formato
    let contentType = 'text/plain';
    let filename = `reporte_${reportType}_${new Date().toISOString().split('T')[0]}`;

    switch (format) {
      case 'json':
        contentType = 'application/json';
        filename += '.json';
        break;
      case 'csv':
        contentType = 'text/csv';
        filename += '.csv';
        break;
      case 'pdf':
        contentType = 'application/pdf';
        filename += '.pdf';
        break;
    }

    c.header('Content-Type', contentType);
    c.header('Content-Disposition', `attachment; filename="${filename}"`);

    return c.text(exportedData);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('Error exportando reporte:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /reports/metrics
 * Obtener métricas rápidas de productividad
 * Requiere rol: supervisor o admin
 */
dashboardRoutes.get('/reports/metrics', requireRole('supervisor'), async (c) => {
  try {
    // Obtener parámetros de filtro
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const userId = c.req.query('userId');

    const filters: ReportFilters = {};
    
    if (startDate) {
      const date = new Date(startDate);
      if (!isNaN(date.getTime())) {
        filters.startDate = date;
      }
    }
    
    if (endDate) {
      const date = new Date(endDate);
      if (!isNaN(date.getTime())) {
        filters.endDate = date;
      }
    }
    
    if (userId) {
      filters.userId = userId;
    }

    const metrics = await reportService.getProductivityMetrics(filters);

    return c.json({
      success: true,
      data: metrics,
      message: 'Métricas de productividad obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo métricas de productividad:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /reports/types
 * Obtener tipos de reportes disponibles
 * Requiere rol: supervisor o admin
 */
dashboardRoutes.get('/reports/types', requireRole('supervisor'), async (c) => {
  try {
    const reportTypes = [
      {
        type: 'productivity',
        name: 'Reporte de Productividad',
        description: 'Análisis de tareas completadas, tiempos de completación y tendencias',
        formats: ['json', 'csv', 'pdf'],
        filters: ['startDate', 'endDate', 'userId', 'taskType', 'priority', 'status']
      },
      {
        type: 'performance',
        name: 'Reporte de Rendimiento',
        description: 'Métricas de rendimiento por usuario y comparaciones de equipo',
        formats: ['json', 'csv', 'pdf'],
        filters: ['startDate', 'endDate']
      }
    ];

    return c.json({
      success: true,
      data: reportTypes,
      message: 'Tipos de reportes obtenidos exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo tipos de reportes:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

export default dashboardRoutes;
