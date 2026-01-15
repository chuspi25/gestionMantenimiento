import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fc } from 'fast-check';
import { DashboardService } from '../../../src/backend/services/DashboardService.js';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest } from '../../../src/backend/models/Task.js';
import { CreateUserRequest } from '../../../src/backend/models/User.js';
import { initializeDatabase, closeDatabase } from '../../../src/backend/utils/database.js';

describe('Dashboard Summary Properties', () => {
  let dashboardService: DashboardService;
  let taskService: TaskService;
  let userService: UserService;
  let testUserId: string;
  let testAssigneeId: string;

  beforeEach(async () => {
    await initializeDatabase();
    dashboardService = new DashboardService();
    taskService = new TaskService();
    userService = new UserService();

    // Crear usuarios de prueba
    const creatorData: CreateUserRequest = {
      username: 'dashboard-creator',
      email: 'creator@dashboard.com',
      password: 'password123',
      fullName: 'Dashboard Creator',
      role: 'admin'
    };

    const assigneeData: CreateUserRequest = {
      username: 'dashboard-assignee',
      email: 'assignee@dashboard.com',
      password: 'password123',
      fullName: 'Dashboard Assignee',
      role: 'operator'
    };

    const creator = await userService.createUser(creatorData);
    const assignee = await userService.createUser(assigneeData);
    testUserId = creator.id;
    testAssigneeId = assignee.id;
  });

  afterEach(async () => {
    await closeDatabase();
  });

  // Generadores para fast-check
  const taskStatusArb = fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled');
  const taskTypeArb = fc.constantFrom('electrical', 'mechanical');
  const taskPriorityArb = fc.constantFrom('low', 'medium', 'high', 'urgent');

  const createTaskRequestArb = fc.record({
    title: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
    description: fc.string({ minLength: 1, maxLength: 500 }).map(s => s.trim()).filter(s => s.length > 0),
    type: taskTypeArb,
    priority: taskPriorityArb,
    location: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
    requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
    estimatedDuration: fc.integer({ min: 15, max: 480 }),
    dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  });

  it('Property 15.1: Task summary totals match individual counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 10 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas con diferentes estados
          const createdTasks = [];
          for (const taskData of tasksData) {
            const task = await taskService.createTask(taskData, testUserId);
            createdTasks.push(task);
          }

          // Cambiar algunos estados aleatoriamente
          const statusUpdates = createdTasks.slice(0, Math.floor(createdTasks.length / 2));
          for (let i = 0; i < statusUpdates.length; i++) {
            const newStatus = i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in_progress' : 'cancelled';
            await taskService.updateTaskStatus(statusUpdates[i].id, newStatus, testUserId);
          }

          // Obtener resumen del dashboard
          const summary = await dashboardService.getTaskSummary();

          // Verificar que los totales coinciden
          expect(summary.total).toBeGreaterThanOrEqual(tasksData.length);
          expect(summary.pending + summary.inProgress + summary.completed).toBeLessThanOrEqual(summary.total);

          // Verificar que las sumas por prioridad coinciden con el total
          const prioritySum = summary.byPriority.low + summary.byPriority.medium + 
                             summary.byPriority.high + summary.byPriority.urgent;
          expect(prioritySum).toBe(summary.total);

          // Verificar que las sumas por tipo coinciden con el total
          const typeSum = summary.byType.electrical + summary.byType.mechanical;
          expect(typeSum).toBe(summary.total);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 15.2: Dashboard data consistency across multiple calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 2, maxLength: 5 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas
          for (const taskData of tasksData) {
            await taskService.createTask(taskData, testUserId);
          }

          // Obtener datos del dashboard múltiples veces
          const dashboardData1 = await dashboardService.getDashboardData();
          const dashboardData2 = await dashboardService.getDashboardData();

          // Los datos deben ser consistentes entre llamadas
          expect(dashboardData1.taskSummary.total).toBe(dashboardData2.taskSummary.total);
          expect(dashboardData1.taskSummary.pending).toBe(dashboardData2.taskSummary.pending);
          expect(dashboardData1.taskSummary.completed).toBe(dashboardData2.taskSummary.completed);
          expect(dashboardData1.taskSummary.byPriority).toEqual(dashboardData2.taskSummary.byPriority);
          expect(dashboardData1.taskSummary.byType).toEqual(dashboardData2.taskSummary.byType);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 15.3: User-specific dashboard reflects only user tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 4, maxLength: 8 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas - algunas asignadas al usuario, otras no
          let userTaskCount = 0;
          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            const assignTo = i % 2 === 0 ? testAssigneeId : undefined;
            if (assignTo === testAssigneeId) userTaskCount++;
            
            await taskService.createTask({ ...taskData, assignedTo: assignTo }, testUserId);
          }

          // Obtener dashboard general y específico del usuario
          const generalDashboard = await dashboardService.getDashboardData();
          const userDashboard = await dashboardService.getDashboardData(testAssigneeId);

          // El dashboard del usuario debe tener menos o igual tareas que el general
          expect(userDashboard.taskSummary.total).toBeLessThanOrEqual(generalDashboard.taskSummary.total);
          
          // Si hay tareas asignadas al usuario, el dashboard debe reflejarlas
          if (userTaskCount > 0) {
            expect(userDashboard.taskSummary.total).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 15.4: Completed task counts are cumulative and non-decreasing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 6 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas
          const createdTasks = [];
          for (const taskData of tasksData) {
            const task = await taskService.createTask(taskData, testUserId);
            createdTasks.push(task);
          }

          // Obtener conteo inicial
          const initialSummary = await dashboardService.getTaskSummary();
          const initialCompleted = initialSummary.completed;

          // Completar algunas tareas
          const tasksToComplete = createdTasks.slice(0, Math.ceil(createdTasks.length / 2));
          for (const task of tasksToComplete) {
            await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          }

          // Obtener conteo final
          const finalSummary = await dashboardService.getTaskSummary();
          const finalCompleted = finalSummary.completed;

          // El conteo de completadas debe haber aumentado
          expect(finalCompleted).toBeGreaterThanOrEqual(initialCompleted);
          expect(finalCompleted - initialCompleted).toBe(tasksToComplete.length);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 15.5: Overdue task calculation is accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 2, maxLength: 4 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas con fechas de vencimiento en el pasado
          const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Ayer
          let overdueCount = 0;

          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            const dueDate = i % 2 === 0 ? pastDate : taskData.dueDate; // Alternar entre vencidas y no vencidas
            if (dueDate === pastDate) overdueCount++;

            await taskService.createTask({ ...taskData, dueDate }, testUserId);
          }

          const summary = await dashboardService.getTaskSummary();

          // El conteo de vencidas debe coincidir con las tareas creadas con fecha pasada
          expect(summary.overdue).toBeGreaterThanOrEqual(overdueCount);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 15.6: Performance metrics are mathematically consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 5, maxLength: 10 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear y completar tareas
          const createdTasks = [];
          for (const taskData of tasksData) {
            const task = await taskService.createTask(taskData, testUserId);
            createdTasks.push(task);
          }

          // Completar todas las tareas
          for (const task of createdTasks) {
            await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          }

          const metrics = await dashboardService.getPerformanceMetrics();

          // Las métricas deben ser números válidos
          expect(metrics.tasksCompletedThisWeek).toBeGreaterThanOrEqual(0);
          expect(metrics.tasksCompletedLastWeek).toBeGreaterThanOrEqual(0);
          expect(metrics.averageTasksPerDay).toBeGreaterThanOrEqual(0);
          expect(metrics.onTimeCompletionRate).toBeGreaterThanOrEqual(0);
          expect(metrics.onTimeCompletionRate).toBeLessThanOrEqual(100);

          // El trend debe ser un número válido
          expect(typeof metrics.weeklyCompletionTrend).toBe('number');
          expect(isFinite(metrics.weeklyCompletionTrend)).toBe(true);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 15.7: Recent activity reflects actual task operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 2, maxLength: 4 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas
          const createdTasks = [];
          for (const taskData of tasksData) {
            const task = await taskService.createTask(taskData, testUserId);
            createdTasks.push(task);
          }

          // Agregar algunas notas
          for (let i = 0; i < Math.min(2, createdTasks.length); i++) {
            await taskService.addTaskNote(
              { taskId: createdTasks[i].id, content: `Nota de prueba ${i}` },
              testUserId
            );
          }

          const recentActivity = await dashboardService.getRecentActivity();

          // Debe haber actividad registrada
          expect(recentActivity.length).toBeGreaterThan(0);

          // Cada actividad debe tener los campos requeridos
          recentActivity.forEach(activity => {
            expect(activity.id).toBeDefined();
            expect(activity.type).toBeDefined();
            expect(activity.taskId).toBeDefined();
            expect(activity.taskTitle).toBeDefined();
            expect(activity.userId).toBeDefined();
            expect(activity.userName).toBeDefined();
            expect(activity.timestamp).toBeInstanceOf(Date);
          });

          // Las actividades deben estar ordenadas por timestamp (más reciente primero)
          for (let i = 1; i < recentActivity.length; i++) {
            expect(recentActivity[i-1].timestamp.getTime()).toBeGreaterThanOrEqual(
              recentActivity[i].timestamp.getTime()
            );
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 15.8: Upcoming tasks are correctly ordered by due date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 6 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas con diferentes fechas de vencimiento
          const futureDates = [
            new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 día
            new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 días
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
          ];

          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            const dueDate = futureDates[i % futureDates.length];
            await taskService.createTask({ ...taskData, dueDate }, testUserId);
          }

          const upcomingTasks = await dashboardService.getUpcomingTasks();

          // Las tareas deben estar ordenadas por fecha de vencimiento
          for (let i = 1; i < upcomingTasks.length; i++) {
            expect(upcomingTasks[i-1].dueDate.getTime()).toBeLessThanOrEqual(
              upcomingTasks[i].dueDate.getTime()
            );
          }

          // Los días hasta vencimiento deben ser consistentes
          upcomingTasks.forEach(task => {
            const expectedDays = Math.floor((task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            expect(Math.abs(task.daysUntilDue - expectedDays)).toBeLessThanOrEqual(1); // Tolerancia de 1 día
            expect(task.isOverdue).toBe(task.daysUntilDue < 0);
          });
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 15.9: Quick summary is a subset of full summary', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 8 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas con diferentes estados y prioridades
          const createdTasks = [];
          for (const taskData of tasksData) {
            const task = await taskService.createTask(taskData, testUserId);
            createdTasks.push(task);
          }

          // Completar algunas tareas hoy
          const tasksToComplete = createdTasks.slice(0, Math.floor(createdTasks.length / 3));
          for (const task of tasksToComplete) {
            await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          }

          // Obtener resúmenes
          const fullSummary = await dashboardService.getTaskSummary();
          const quickSummary = await dashboardService.getQuickSummary();

          // El resumen rápido debe ser consistente con el completo
          expect(quickSummary.totalTasks).toBe(fullSummary.total);
          expect(quickSummary.completedToday).toBe(fullSummary.completedToday);
          expect(quickSummary.overdueTasks).toBe(fullSummary.overdue);

          // Las tareas de alta prioridad deben ser un subconjunto del total
          expect(quickSummary.highPriorityTasks).toBeLessThanOrEqual(quickSummary.totalTasks);
          expect(quickSummary.completedToday).toBeLessThanOrEqual(quickSummary.totalTasks);
          expect(quickSummary.overdueTasks).toBeLessThanOrEqual(quickSummary.totalTasks);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 15.10: Alerts are properly categorized and prioritized', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 2, maxLength: 5 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas con diferentes escenarios de alerta
          const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 días atrás
          const soonDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 horas

          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            let dueDate = taskData.dueDate;
            let priority = taskData.priority;

            // Crear diferentes tipos de alertas
            if (i === 0) {
              dueDate = pastDate; // Tarea vencida
            } else if (i === 1) {
              dueDate = soonDate; // Tarea próxima a vencer
              priority = 'urgent';
            }

            await taskService.createTask({ 
              ...taskData, 
              dueDate, 
              priority,
              assignedTo: i % 2 === 0 ? testAssigneeId : undefined 
            }, testUserId);
          }

          const alerts = await dashboardService.getAlerts();

          // Debe haber alertas generadas
          expect(alerts.length).toBeGreaterThan(0);

          // Cada alerta debe tener los campos requeridos
          alerts.forEach(alert => {
            expect(alert.id).toBeDefined();
            expect(['overdue', 'due_soon', 'high_priority', 'unassigned', 'system']).toContain(alert.type);
            expect(['low', 'medium', 'high', 'critical']).toContain(alert.severity);
            expect(alert.title).toBeDefined();
            expect(alert.message).toBeDefined();
            expect(alert.timestamp).toBeInstanceOf(Date);
            expect(typeof alert.isRead).toBe('boolean');
          });

          // Las alertas deben estar ordenadas por severidad (críticas primero)
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          for (let i = 1; i < alerts.length; i++) {
            const prevSeverity = severityOrder[alerts[i-1].severity];
            const currSeverity = severityOrder[alerts[i].severity];
            expect(prevSeverity).toBeGreaterThanOrEqual(currSeverity);
          }
        }
      ),
      { numRuns: 8 }
    );
  });
});