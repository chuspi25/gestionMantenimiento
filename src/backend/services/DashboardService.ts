import { query } from '../utils/database.js';

// Interfaz para datos del dashboard
export interface DashboardData {
  taskSummary: TaskSummary;
  recentActivity: RecentActivity[];
  upcomingTasks: UpcomingTask[];
  performanceMetrics: PerformanceMetrics;
  alerts: Alert[];
}

// Resumen de tareas
export interface TaskSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  averageCompletionTime: number; // en horas
  byPriority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: {
    electrical: number;
    mechanical: number;
  };
}

// Actividad reciente
export interface RecentActivity {
  id: string;
  type: 'task_created' | 'task_assigned' | 'task_completed' | 'task_updated' | 'note_added';
  taskId: string;
  taskTitle: string;
  userId: string;
  userName: string;
  description: string;
  timestamp: Date;
}

// Tareas próximas
export interface UpcomingTask {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: Date;
  assignedTo?: string;
  assignedToName?: string;
  daysUntilDue: number;
  isOverdue: boolean;
}

// Métricas de rendimiento
export interface PerformanceMetrics {
  tasksCompletedThisWeek: number;
  tasksCompletedLastWeek: number;
  weeklyCompletionTrend: number; // porcentaje de cambio
  averageTasksPerDay: number;
  onTimeCompletionRate: number; // porcentaje
  mostProductiveDay: string;
  mostProductiveHour: number;
  topPerformers: TopPerformer[];
}

// Mejores ejecutores
export interface TopPerformer {
  userId: string;
  userName: string;
  tasksCompleted: number;
  averageCompletionTime: number;
  onTimeRate: number;
}

// Alertas
export interface Alert {
  id: string;
  type: 'overdue' | 'due_soon' | 'high_priority' | 'unassigned' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  taskId?: string;
  userId?: string;
  timestamp: Date;
  isRead: boolean;
}

export class DashboardService {
  constructor() {
    // TaskService available for future use
  }

  // Obtener datos completos del dashboard
  async getDashboardData(userId?: string): Promise<DashboardData> {
    try {
      const [
        taskSummary,
        recentActivity,
        upcomingTasks,
        performanceMetrics,
        alerts
      ] = await Promise.all([
        this.getTaskSummary(userId),
        this.getRecentActivity(userId),
        this.getUpcomingTasks(userId),
        this.getPerformanceMetrics(userId),
        this.getAlerts(userId)
      ]);

      return {
        taskSummary,
        recentActivity,
        upcomingTasks,
        performanceMetrics,
        alerts
      };
    } catch (error) {
      console.error('Error obteniendo datos del dashboard:', error);
      throw error;
    }
  }

  // Obtener resumen de tareas
  async getTaskSummary(userId?: string): Promise<TaskSummary> {
    try {
      const whereClause = userId ? 'WHERE assigned_to = $1' : '';
      const params = userId ? [userId] : [];

      // Estadísticas básicas
      const basicStatsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN due_date < NOW() AND status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue,
          COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as low,
          COUNT(CASE WHEN type = 'electrical' THEN 1 END) as electrical,
          COUNT(CASE WHEN type = 'mechanical' THEN 1 END) as mechanical
        FROM tasks ${whereClause}
      `;

      const basicStats = await query(basicStatsQuery, params);
      const stats = basicStats.rows[0];

      // Tareas completadas por período
      const completionStatsQuery = `
        SELECT 
          COUNT(CASE WHEN completed_at >= CURRENT_DATE THEN 1 END) as completed_today,
          COUNT(CASE WHEN completed_at >= DATE_TRUNC('week', NOW()) THEN 1 END) as completed_this_week,
          COUNT(CASE WHEN completed_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as completed_this_month,
          AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_completion_time
        FROM tasks 
        WHERE status = 'completed' AND completed_at IS NOT NULL
        ${userId ? 'AND assigned_to = $1' : ''}
      `;

      const completionStats = await query(completionStatsQuery, params);
      const completion = completionStats.rows[0];

      return {
        total: parseInt(stats.total),
        pending: parseInt(stats.pending),
        inProgress: parseInt(stats.in_progress),
        completed: parseInt(stats.completed),
        overdue: parseInt(stats.overdue),
        completedToday: parseInt(completion.completed_today || '0'),
        completedThisWeek: parseInt(completion.completed_this_week || '0'),
        completedThisMonth: parseInt(completion.completed_this_month || '0'),
        averageCompletionTime: Math.round((parseFloat(completion.avg_completion_time || '0')) * 100) / 100,
        byPriority: {
          urgent: parseInt(stats.urgent),
          high: parseInt(stats.high),
          medium: parseInt(stats.medium),
          low: parseInt(stats.low)
        },
        byType: {
          electrical: parseInt(stats.electrical),
          mechanical: parseInt(stats.mechanical)
        }
      };
    } catch (error) {
      console.error('Error obteniendo resumen de tareas:', error);
      throw error;
    }
  }

  // Obtener actividad reciente
  async getRecentActivity(userId?: string, limit: number = 10): Promise<RecentActivity[]> {
    try {
      // Consulta para obtener actividad reciente basada en cambios en las tareas
      const activityQuery = `
        SELECT 
          t.id as task_id,
          t.title as task_title,
          t.created_by as user_id,
          u.name as user_name,
          t.created_at as timestamp,
          'task_created' as activity_type,
          'Tarea creada' as description
        FROM tasks t
        JOIN users u ON t.created_by = u.id
        ${userId ? 'WHERE t.assigned_to = $1 OR t.created_by = $1' : ''}
        
        UNION ALL
        
        SELECT 
          t.id as task_id,
          t.title as task_title,
          t.created_by as user_id,
          u.name as user_name,
          t.completed_at as timestamp,
          'task_completed' as activity_type,
          'Tarea completada' as description
        FROM tasks t
        JOIN users u ON t.created_by = u.id
        WHERE t.status = 'completed' AND t.completed_at IS NOT NULL
        ${userId ? 'AND (t.assigned_to = $1 OR t.created_by = $1)' : ''}
        
        UNION ALL
        
        SELECT 
          tn.task_id,
          t.title as task_title,
          tn.user_id,
          u.name as user_name,
          tn.created_at as timestamp,
          'note_added' as activity_type,
          'Nota agregada: ' || LEFT(tn.content, 50) || '...' as description
        FROM task_notes tn
        JOIN tasks t ON tn.task_id = t.id
        JOIN users u ON tn.user_id = u.id
        ${userId ? 'WHERE t.assigned_to = $1 OR tn.user_id = $1' : ''}
        
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;

      const params = userId ? [userId] : [];
      const result = await query(activityQuery, params);

      return result.rows.map((row: any) => ({
        id: `${row.activity_type}_${row.task_id}_${row.timestamp}`,
        type: row.activity_type as RecentActivity['type'],
        taskId: row.task_id,
        taskTitle: row.task_title,
        userId: row.user_id,
        userName: row.user_name,
        description: row.description,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      console.error('Error obteniendo actividad reciente:', error);
      throw error;
    }
  }

  // Obtener tareas próximas
  async getUpcomingTasks(userId?: string, limit: number = 5): Promise<UpcomingTask[]> {
    try {
      const upcomingQuery = `
        SELECT 
          t.id,
          t.title,
          t.priority,
          t.due_date,
          t.assigned_to,
          u.name as assigned_to_name,
          EXTRACT(DAYS FROM (t.due_date - NOW())) as days_until_due
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.status NOT IN ('completed', 'cancelled')
        ${userId ? 'AND (t.assigned_to = $1 OR t.created_by = $1)' : ''}
        ORDER BY t.due_date ASC
        LIMIT ${limit}
      `;

      const params = userId ? [userId] : [];
      const result = await query(upcomingQuery, params);

      return result.rows.map((row: any) => {
        const daysUntilDue = Math.floor(parseFloat(row.days_until_due));
        return {
          id: row.id,
          title: row.title,
          priority: row.priority,
          dueDate: new Date(row.due_date),
          assignedTo: row.assigned_to,
          assignedToName: row.assigned_to_name,
          daysUntilDue,
          isOverdue: daysUntilDue < 0
        };
      });
    } catch (error) {
      console.error('Error obteniendo tareas próximas:', error);
      throw error;
    }
  }

  // Obtener métricas de rendimiento
  async getPerformanceMetrics(userId?: string): Promise<PerformanceMetrics> {
    try {
      // Tareas completadas esta semana vs semana pasada
      const weeklyComparisonQuery = `
        SELECT 
          COUNT(CASE WHEN completed_at >= DATE_TRUNC('week', NOW()) THEN 1 END) as this_week,
          COUNT(CASE WHEN completed_at >= DATE_TRUNC('week', NOW()) - INTERVAL '1 week' 
                     AND completed_at < DATE_TRUNC('week', NOW()) THEN 1 END) as last_week
        FROM tasks 
        WHERE status = 'completed' AND completed_at IS NOT NULL
        ${userId ? 'AND assigned_to = $1' : ''}
      `;

      const params = userId ? [userId] : [];
      const weeklyComparison = await query(weeklyComparisonQuery, params);
      const weekly = weeklyComparison.rows[0];

      const thisWeek = parseInt(weekly.this_week);
      const lastWeek = parseInt(weekly.last_week);
      const weeklyTrend = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

      // Promedio de tareas por día
      const avgTasksQuery = `
        SELECT 
          COUNT(*)::float / NULLIF(COUNT(DISTINCT DATE(completed_at)), 0) as avg_per_day
        FROM tasks 
        WHERE status = 'completed' 
        AND completed_at >= NOW() - INTERVAL '30 days'
        ${userId ? 'AND assigned_to = $1' : ''}
      `;

      const avgTasks = await query(avgTasksQuery, params);
      const averageTasksPerDay = Math.round((parseFloat(avgTasks.rows[0]?.avg_per_day || '0')) * 100) / 100;

      // Tasa de completación a tiempo
      const onTimeQuery = `
        SELECT 
          COUNT(CASE WHEN completed_at <= due_date THEN 1 END)::float / 
          NULLIF(COUNT(*), 0) * 100 as on_time_rate
        FROM tasks 
        WHERE status = 'completed' AND completed_at IS NOT NULL
        ${userId ? 'AND assigned_to = $1' : ''}
      `;

      const onTime = await query(onTimeQuery, params);
      const onTimeRate = Math.round(parseFloat(onTime.rows[0]?.on_time_rate || '0'));

      // Top performers (solo si no es para un usuario específico)
      let topPerformers: TopPerformer[] = [];
      if (!userId) {
        const topPerformersQuery = `
          SELECT 
            u.id as user_id,
            u.name as user_name,
            COUNT(*) as tasks_completed,
            AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600) as avg_completion_time,
            COUNT(CASE WHEN t.completed_at <= t.due_date THEN 1 END)::float / 
            NULLIF(COUNT(*), 0) * 100 as on_time_rate
          FROM tasks t
          JOIN users u ON t.assigned_to = u.id
          WHERE t.status = 'completed' 
          AND t.completed_at >= NOW() - INTERVAL '30 days'
          GROUP BY u.id, u.name
          HAVING COUNT(*) >= 3
          ORDER BY tasks_completed DESC, on_time_rate DESC
          LIMIT 5
        `;

        const topPerformersResult = await query(topPerformersQuery);
        topPerformers = topPerformersResult.rows.map((row: any) => ({
          userId: row.user_id,
          userName: row.user_name,
          tasksCompleted: parseInt(row.tasks_completed),
          averageCompletionTime: Math.round(parseFloat(row.avg_completion_time || '0') * 100) / 100,
          onTimeRate: Math.round(parseFloat(row.on_time_rate || '0'))
        }));
      }

      return {
        tasksCompletedThisWeek: thisWeek,
        tasksCompletedLastWeek: lastWeek,
        weeklyCompletionTrend: Math.round(weeklyTrend),
        averageTasksPerDay,
        onTimeCompletionRate: onTimeRate,
        mostProductiveDay: 'Lunes', // Placeholder - se podría calcular
        mostProductiveHour: 10, // Placeholder - se podría calcular
        topPerformers
      };
    } catch (error) {
      console.error('Error obteniendo métricas de rendimiento:', error);
      throw error;
    }
  }

  // Obtener alertas
  async getAlerts(userId?: string, limit: number = 10): Promise<Alert[]> {
    try {
      const alerts: Alert[] = [];

      // Alertas de tareas vencidas
      const overdueQuery = `
        SELECT id, title, due_date, assigned_to
        FROM tasks 
        WHERE due_date < NOW() 
        AND status NOT IN ('completed', 'cancelled')
        ${userId ? 'AND (assigned_to = $1 OR created_by = $1)' : ''}
        ORDER BY due_date ASC
        LIMIT 5
      `;

      const params = userId ? [userId] : [];
      const overdueResult = await query(overdueQuery, params);

      overdueResult.rows.forEach((task: any) => {
        const daysOverdue = Math.floor((Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `overdue_${task.id}`,
          type: 'overdue',
          severity: daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium',
          title: 'Tarea Vencida',
          message: `"${task.title}" venció hace ${daysOverdue} día(s)`,
          taskId: task.id,
          userId: task.assigned_to,
          timestamp: new Date(task.due_date),
          isRead: false
        });
      });

      // Alertas de tareas próximas a vencer
      const dueSoonQuery = `
        SELECT id, title, due_date, assigned_to
        FROM tasks 
        WHERE due_date BETWEEN NOW() AND NOW() + INTERVAL '2 days'
        AND status NOT IN ('completed', 'cancelled')
        ${userId ? 'AND (assigned_to = $1 OR created_by = $1)' : ''}
        ORDER BY due_date ASC
        LIMIT 5
      `;

      const dueSoonResult = await query(dueSoonQuery, params);

      dueSoonResult.rows.forEach((task: any) => {
        const hoursUntilDue = Math.floor((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60));
        alerts.push({
          id: `due_soon_${task.id}`,
          type: 'due_soon',
          severity: hoursUntilDue < 24 ? 'high' : 'medium',
          title: 'Tarea Próxima a Vencer',
          message: `"${task.title}" vence en ${hoursUntilDue} hora(s)`,
          taskId: task.id,
          userId: task.assigned_to,
          timestamp: new Date(),
          isRead: false
        });
      });

      // Alertas de tareas de alta prioridad sin asignar
      if (!userId) {
        const unassignedHighPriorityQuery = `
          SELECT id, title, priority, created_at
          FROM tasks 
          WHERE assigned_to IS NULL 
          AND priority IN ('urgent', 'high')
          AND status = 'pending'
          ORDER BY created_at DESC
          LIMIT 3
        `;

        const unassignedResult = await query(unassignedHighPriorityQuery);

        unassignedResult.rows.forEach((task: any) => {
          alerts.push({
            id: `unassigned_${task.id}`,
            type: 'unassigned',
            severity: task.priority === 'urgent' ? 'critical' : 'high',
            title: 'Tarea Sin Asignar',
            message: `Tarea de prioridad ${task.priority}: "${task.title}"`,
            taskId: task.id,
            timestamp: new Date(task.created_at),
            isRead: false
          });
        });
      }

      // Ordenar por severidad y timestamp
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return alerts
        .sort((a, b) => {
          const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
          if (severityDiff !== 0) return severityDiff;
          return b.timestamp.getTime() - a.timestamp.getTime();
        })
        .slice(0, limit);
    } catch (error) {
      console.error('Error obteniendo alertas:', error);
      throw error;
    }
  }

  // Obtener resumen rápido para widgets
  async getQuickSummary(userId?: string): Promise<{
    totalTasks: number;
    completedToday: number;
    overdueTasks: number;
    highPriorityTasks: number;
  }> {
    try {
      const whereClause = userId ? 'WHERE assigned_to = $1' : '';
      const params = userId ? [userId] : [];

      const summaryQuery = `
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' AND completed_at >= CURRENT_DATE THEN 1 END) as completed_today,
          COUNT(CASE WHEN due_date < NOW() AND status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue_tasks,
          COUNT(CASE WHEN priority IN ('urgent', 'high') AND status NOT IN ('completed', 'cancelled') THEN 1 END) as high_priority_tasks
        FROM tasks ${whereClause}
      `;

      const result = await query(summaryQuery, params);
      const summary = result.rows[0];

      return {
        totalTasks: parseInt(summary.total_tasks),
        completedToday: parseInt(summary.completed_today),
        overdueTasks: parseInt(summary.overdue_tasks),
        highPriorityTasks: parseInt(summary.high_priority_tasks)
      };
    } catch (error) {
      console.error('Error obteniendo resumen rápido:', error);
      throw error;
    }
  }
}
