import { query } from '../utils/database.js';

// Tipos de reportes disponibles
export type ReportType = 'productivity' | 'performance' | 'maintenance' | 'user_activity' | 'task_analysis';

// Formatos de exportación
export type ExportFormat = 'json' | 'csv' | 'pdf';

// Filtros para reportes
export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  taskType?: 'electrical' | 'mechanical';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  department?: string;
}

// Configuración de reporte
export interface ReportConfig {
  type: ReportType;
  title: string;
  description: string;
  filters: ReportFilters;
  format: ExportFormat;
  includeCharts: boolean;
  groupBy?: 'day' | 'week' | 'month' | 'user' | 'type' | 'priority';
}

// Datos del reporte de productividad
export interface ProductivityReport {
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    averageCompletionTime: number;
    onTimeCompletionRate: number;
  };
  trends: {
    daily: DailyTrend[];
    weekly: WeeklyTrend[];
    monthly: MonthlyTrend[];
  };
  breakdown: {
    byType: TypeBreakdown[];
    byPriority: PriorityBreakdown[];
    byUser: UserBreakdown[];
  };
  insights: string[];
}

// Datos del reporte de rendimiento
export interface PerformanceReport {
  summary: {
    totalUsers: number;
    activeUsers: number;
    averageTasksPerUser: number;
    topPerformerUserId: string;
    topPerformerName: string;
  };
  userMetrics: UserMetrics[];
  teamComparison: TeamComparison[];
  efficiency: {
    averageResponseTime: number;
    averageResolutionTime: number;
    firstTimeFixRate: number;
  };
  recommendations: string[];
}

// Datos del reporte de mantenimiento
export interface MaintenanceReport {
  summary: {
    totalMaintenanceTasks: number;
    preventiveTasks: number;
    correctiveTasks: number;
    emergencyTasks: number;
    maintenanceCost: number;
  };
  equipment: {
    mostMaintained: EquipmentStats[];
    leastMaintained: EquipmentStats[];
    criticalEquipment: EquipmentStats[];
  };
  trends: {
    maintenanceFrequency: FrequencyTrend[];
    costTrends: CostTrend[];
    downtimeTrends: DowntimeTrend[];
  };
  predictions: MaintenancePrediction[];
}

// Interfaces auxiliares
export interface DailyTrend {
  date: Date;
  tasksCreated: number;
  tasksCompleted: number;
  completionRate: number;
}

export interface WeeklyTrend {
  weekStart: Date;
  weekEnd: Date;
  tasksCreated: number;
  tasksCompleted: number;
  completionRate: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  tasksCreated: number;
  tasksCompleted: number;
  completionRate: number;
}

export interface TypeBreakdown {
  type: 'electrical' | 'mechanical';
  count: number;
  percentage: number;
  averageCompletionTime: number;
}

export interface PriorityBreakdown {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  count: number;
  percentage: number;
  averageCompletionTime: number;
}

export interface UserBreakdown {
  userId: string;
  userName: string;
  tasksAssigned: number;
  tasksCompleted: number;
  completionRate: number;
  averageCompletionTime: number;
}

export interface UserMetrics {
  userId: string;
  userName: string;
  tasksCompleted: number;
  averageCompletionTime: number;
  onTimeRate: number;
  qualityScore: number;
  efficiency: number;
}

export interface TeamComparison {
  teamName: string;
  memberCount: number;
  totalTasks: number;
  completionRate: number;
  averageResponseTime: number;
}

export interface EquipmentStats {
  equipmentId: string;
  equipmentName: string;
  location: string;
  maintenanceCount: number;
  lastMaintenanceDate: Date;
  nextScheduledMaintenance: Date;
  criticalityScore: number;
}

export interface FrequencyTrend {
  period: string;
  frequency: number;
  type: 'preventive' | 'corrective' | 'emergency';
}

export interface CostTrend {
  period: string;
  cost: number;
  budgetVariance: number;
}

export interface DowntimeTrend {
  period: string;
  downtimeHours: number;
  impactScore: number;
}

export interface MaintenancePrediction {
  equipmentId: string;
  equipmentName: string;
  predictedFailureDate: Date;
  confidence: number;
  recommendedAction: string;
}

export class ReportService {
  // Generar reporte de productividad
  async generateProductivityReport(filters: ReportFilters): Promise<ProductivityReport> {
    try {
      const { startDate, endDate, userId, taskType, priority } = filters;
      
      // Construir condiciones WHERE
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate);
      }

      if (userId) {
        conditions.push(`assigned_to = $${paramIndex++}`);
        params.push(userId);
      }

      if (taskType) {
        conditions.push(`type = $${paramIndex++}`);
        params.push(taskType);
      }

      if (priority) {
        conditions.push(`priority = $${paramIndex++}`);
        params.push(priority);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Resumen general
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as completion_rate,
          AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END) as avg_completion_time,
          COUNT(CASE WHEN status = 'completed' AND completed_at <= due_date THEN 1 END)::float / 
          NULLIF(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0) * 100 as on_time_rate
        FROM tasks ${whereClause}
      `;

      const summaryResult = await query(summaryQuery, params);
      const summary = summaryResult.rows[0];

      // Tendencias diarias
      const dailyTrendsQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as tasks_created,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as tasks_completed,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as completion_rate
        FROM tasks ${whereClause}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) DESC
        LIMIT 30
      `;

      const dailyTrendsResult = await query(dailyTrendsQuery, params);
      const dailyTrends: DailyTrend[] = dailyTrendsResult.rows.map((row: any) => ({
        date: new Date(row.date),
        tasksCreated: parseInt(row.tasks_created),
        tasksCompleted: parseInt(row.tasks_completed),
        completionRate: Math.round(parseFloat(row.completion_rate || '0'))
      }));

      // Desglose por tipo
      const typeBreakdownQuery = `
        SELECT 
          type,
          COUNT(*) as count,
          COUNT(*)::float / (SELECT COUNT(*) FROM tasks ${whereClause}) * 100 as percentage,
          AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END) as avg_completion_time
        FROM tasks ${whereClause}
        GROUP BY type
      `;

      const typeBreakdownResult = await query(typeBreakdownQuery, params);
      const byType: TypeBreakdown[] = typeBreakdownResult.rows.map((row: any) => ({
        type: row.type,
        count: parseInt(row.count),
        percentage: Math.round(parseFloat(row.percentage)),
        averageCompletionTime: Math.round(parseFloat(row.avg_completion_time || '0') * 100) / 100
      }));

      // Desglose por prioridad
      const priorityBreakdownQuery = `
        SELECT 
          priority,
          COUNT(*) as count,
          COUNT(*)::float / (SELECT COUNT(*) FROM tasks ${whereClause}) * 100 as percentage,
          AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END) as avg_completion_time
        FROM tasks ${whereClause}
        GROUP BY priority
      `;

      const priorityBreakdownResult = await query(priorityBreakdownQuery, params);
      const byPriority: PriorityBreakdown[] = priorityBreakdownResult.rows.map((row: any) => ({
        priority: row.priority,
        count: parseInt(row.count),
        percentage: Math.round(parseFloat(row.percentage)),
        averageCompletionTime: Math.round(parseFloat(row.avg_completion_time || '0') * 100) / 100
      }));

      // Desglose por usuario
      const userBreakdownQuery = `
        SELECT 
          u.id as user_id,
          u.name as user_name,
          COUNT(*) as tasks_assigned,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as tasks_completed,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as completion_rate,
          AVG(CASE WHEN t.status = 'completed' AND t.completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600 END) as avg_completion_time
        FROM tasks t
        JOIN users u ON t.assigned_to = u.id
        ${whereClause}
        GROUP BY u.id, u.name
        HAVING COUNT(*) > 0
        ORDER BY completion_rate DESC, tasks_completed DESC
      `;

      const userBreakdownResult = await query(userBreakdownQuery, params);
      const byUser: UserBreakdown[] = userBreakdownResult.rows.map((row: any) => ({
        userId: row.user_id,
        userName: row.user_name,
        tasksAssigned: parseInt(row.tasks_assigned),
        tasksCompleted: parseInt(row.tasks_completed),
        completionRate: Math.round(parseFloat(row.completion_rate || '0')),
        averageCompletionTime: Math.round(parseFloat(row.avg_completion_time || '0') * 100) / 100
      }));

      // Generar insights
      const insights = this.generateProductivityInsights({
        totalTasks: parseInt(summary.total_tasks),
        completedTasks: parseInt(summary.completed_tasks),
        completionRate: Math.round(parseFloat(summary.completion_rate || '0')),
        averageCompletionTime: Math.round(parseFloat(summary.avg_completion_time || '0') * 100) / 100,
        onTimeCompletionRate: Math.round(parseFloat(summary.on_time_rate || '0'))
      }, byType, byPriority, byUser);

      return {
        summary: {
          totalTasks: parseInt(summary.total_tasks),
          completedTasks: parseInt(summary.completed_tasks),
          completionRate: Math.round(parseFloat(summary.completion_rate || '0')),
          averageCompletionTime: Math.round(parseFloat(summary.avg_completion_time || '0') * 100) / 100,
          onTimeCompletionRate: Math.round(parseFloat(summary.on_time_rate || '0'))
        },
        trends: {
          daily: dailyTrends,
          weekly: [], // Se podría implementar
          monthly: [] // Se podría implementar
        },
        breakdown: {
          byType,
          byPriority,
          byUser
        },
        insights
      };
    } catch (error) {
      console.error('Error generando reporte de productividad:', error);
      throw error;
    }
  }

  // Generar reporte de rendimiento
  async generatePerformanceReport(filters: ReportFilters): Promise<PerformanceReport> {
    try {
      const { startDate, endDate } = filters;
      
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        conditions.push(`t.created_at >= $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`t.created_at <= $${paramIndex++}`);
        params.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Resumen de usuarios
      const userSummaryQuery = `
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN t.assigned_to IS NOT NULL THEN u.id END) as active_users,
          COUNT(t.id)::float / NULLIF(COUNT(DISTINCT u.id), 0) as avg_tasks_per_user
        FROM users u
        LEFT JOIN tasks t ON u.id = t.assigned_to ${whereClause.replace('WHERE', 'AND')}
        WHERE u.is_active = true
      `;

      const userSummaryResult = await query(userSummaryQuery, params);
      const userSummary = userSummaryResult.rows[0];

      // Métricas por usuario
      const userMetricsQuery = `
        SELECT 
          u.id as user_id,
          u.name as user_name,
          COUNT(t.id) as tasks_completed,
          AVG(CASE WHEN t.status = 'completed' AND t.completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600 END) as avg_completion_time,
          COUNT(CASE WHEN t.status = 'completed' AND t.completed_at <= t.due_date THEN 1 END)::float / 
          NULLIF(COUNT(CASE WHEN t.status = 'completed' THEN 1 END), 0) * 100 as on_time_rate,
          85 as quality_score, -- Placeholder
          90 as efficiency -- Placeholder
        FROM users u
        LEFT JOIN tasks t ON u.id = t.assigned_to AND t.status = 'completed' ${whereClause.replace('WHERE', 'AND')}
        WHERE u.is_active = true
        GROUP BY u.id, u.name
        HAVING COUNT(t.id) > 0
        ORDER BY tasks_completed DESC
      `;

      const userMetricsResult = await query(userMetricsQuery, params);
      const userMetrics: UserMetrics[] = userMetricsResult.rows.map((row: any) => ({
        userId: row.user_id,
        userName: row.user_name,
        tasksCompleted: parseInt(row.tasks_completed),
        averageCompletionTime: Math.round(parseFloat(row.avg_completion_time || '0') * 100) / 100,
        onTimeRate: Math.round(parseFloat(row.on_time_rate || '0')),
        qualityScore: parseInt(row.quality_score),
        efficiency: parseInt(row.efficiency)
      }));

      // Top performer
      const topPerformer = userMetrics.length > 0 ? userMetrics[0] : null;

      const recommendations = this.generatePerformanceRecommendations(userMetrics);

      return {
        summary: {
          totalUsers: parseInt(userSummary.total_users),
          activeUsers: parseInt(userSummary.active_users),
          averageTasksPerUser: Math.round(parseFloat(userSummary.avg_tasks_per_user || '0') * 100) / 100,
          topPerformerUserId: topPerformer?.userId || '',
          topPerformerName: topPerformer?.userName || ''
        },
        userMetrics,
        teamComparison: [], // Se podría implementar
        efficiency: {
          averageResponseTime: 2.5, // Placeholder
          averageResolutionTime: 8.3, // Placeholder
          firstTimeFixRate: 78 // Placeholder
        },
        recommendations
      };
    } catch (error) {
      console.error('Error generando reporte de rendimiento:', error);
      throw error;
    }
  }

  // Exportar reporte en formato específico
  async exportReport(reportData: any, format: ExportFormat, title: string): Promise<string> {
    try {
      switch (format) {
        case 'json':
          return JSON.stringify(reportData, null, 2);
        
        case 'csv':
          return this.convertToCSV(reportData, title);
        
        case 'pdf':
          // Placeholder - se implementaría con una librería como puppeteer
          return `PDF export not implemented yet for: ${title}`;
        
        default:
          throw new Error(`Formato de exportación no soportado: ${format}`);
      }
    } catch (error) {
      console.error('Error exportando reporte:', error);
      throw error;
    }
  }

  // Obtener métricas de productividad rápidas
  async getProductivityMetrics(filters: ReportFilters): Promise<{
    tasksCompleted: number;
    averageCompletionTime: number;
    onTimeRate: number;
    productivityTrend: number;
  }> {
    try {
      const { startDate, endDate, userId } = filters;
      
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate);
      }

      if (userId) {
        conditions.push(`assigned_to = $${paramIndex++}`);
        params.push(userId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const metricsQuery = `
        SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as tasks_completed,
          AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END) as avg_completion_time,
          COUNT(CASE WHEN status = 'completed' AND completed_at <= due_date THEN 1 END)::float / 
          NULLIF(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0) * 100 as on_time_rate
        FROM tasks ${whereClause}
      `;

      const result = await query(metricsQuery, params);
      const metrics = result.rows[0];

      return {
        tasksCompleted: parseInt(metrics.tasks_completed || '0'),
        averageCompletionTime: Math.round(parseFloat(metrics.avg_completion_time || '0') * 100) / 100,
        onTimeRate: Math.round(parseFloat(metrics.on_time_rate || '0')),
        productivityTrend: 5 // Placeholder - se calcularía comparando períodos
      };
    } catch (error) {
      console.error('Error obteniendo métricas de productividad:', error);
      throw error;
    }
  }

  // Métodos privados auxiliares
  private generateProductivityInsights(
    summary: any,
    byType: TypeBreakdown[],
    _byPriority: PriorityBreakdown[],
    byUser: UserBreakdown[]
  ): string[] {
    const insights: string[] = [];

    // Insight sobre tasa de completación
    if (summary.completionRate > 80) {
      insights.push('Excelente tasa de completación de tareas (>80%)');
    } else if (summary.completionRate > 60) {
      insights.push('Tasa de completación moderada, hay oportunidades de mejora');
    } else {
      insights.push('Tasa de completación baja, requiere atención inmediata');
    }

    // Insight sobre tiempo de completación
    if (summary.averageCompletionTime < 4) {
      insights.push('Tiempo de completación eficiente (<4 horas promedio)');
    } else if (summary.averageCompletionTime > 8) {
      insights.push('Tiempo de completación alto, considerar optimización de procesos');
    }

    // Insight sobre tipos de tarea
    const electricalTasks = byType.find(t => t.type === 'electrical');
    const mechanicalTasks = byType.find(t => t.type === 'mechanical');
    
    if (electricalTasks && mechanicalTasks) {
      if (electricalTasks.averageCompletionTime > mechanicalTasks.averageCompletionTime * 1.5) {
        insights.push('Las tareas eléctricas toman significativamente más tiempo que las mecánicas');
      }
    }

    // Insight sobre usuarios
    if (byUser.length > 0) {
      const topUser = byUser[0];
      if (topUser.completionRate > 90) {
        insights.push(`${topUser.userName} muestra un rendimiento excepcional (${topUser.completionRate}% completación)`);
      }
    }

    return insights;
  }

  private generatePerformanceRecommendations(userMetrics: UserMetrics[]): string[] {
    const recommendations: string[] = [];

    if (userMetrics.length === 0) {
      recommendations.push('No hay datos suficientes para generar recomendaciones');
      return recommendations;
    }

    // Analizar distribución de carga de trabajo
    const avgTasks = userMetrics.reduce((sum, user) => sum + user.tasksCompleted, 0) / userMetrics.length;
    const overloadedUsers = userMetrics.filter(user => user.tasksCompleted > avgTasks * 1.5);
    const underutilizedUsers = userMetrics.filter(user => user.tasksCompleted < avgTasks * 0.5);

    if (overloadedUsers.length > 0) {
      recommendations.push(`Considerar redistribuir carga de trabajo de usuarios sobrecargados: ${overloadedUsers.map(u => u.userName).join(', ')}`);
    }

    if (underutilizedUsers.length > 0) {
      recommendations.push(`Usuarios con capacidad disponible: ${underutilizedUsers.map(u => u.userName).join(', ')}`);
    }

    // Analizar tiempos de completación
    const slowUsers = userMetrics.filter(user => user.averageCompletionTime > avgTasks * 1.3);
    if (slowUsers.length > 0) {
      recommendations.push(`Proporcionar entrenamiento adicional a usuarios con tiempos de completación altos`);
    }

    // Analizar tasas de puntualidad
    const lateUsers = userMetrics.filter(user => user.onTimeRate < 70);
    if (lateUsers.length > 0) {
      recommendations.push(`Revisar planificación y asignación de fechas límite para mejorar puntualidad`);
    }

    return recommendations;
  }

  private convertToCSV(data: any, title: string): string {
    // Implementación básica de conversión a CSV
    let csv = `${title}\n\n`;
    
    if (data.summary) {
      csv += 'Resumen\n';
      Object.entries(data.summary).forEach(([key, value]) => {
        csv += `${key},${value}\n`;
      });
      csv += '\n';
    }

    if (data.breakdown?.byUser) {
      csv += 'Desglose por Usuario\n';
      csv += 'Usuario,Tareas Asignadas,Tareas Completadas,Tasa de Completación,Tiempo Promedio\n';
      data.breakdown.byUser.forEach((user: UserBreakdown) => {
        csv += `${user.userName},${user.tasksAssigned},${user.tasksCompleted},${user.completionRate}%,${user.averageCompletionTime}h\n`;
      });
    }

    return csv;
  }
}
