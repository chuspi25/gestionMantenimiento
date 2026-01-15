import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fc } from 'fast-check';
import { ReportService, ReportFilters } from '../../../src/backend/services/ReportService.js';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest } from '../../../src/backend/models/Task.js';
import { CreateUserRequest } from '../../../src/backend/models/User.js';
import { initializeDatabase, closeDatabase } from '../../../src/backend/utils/database.js';

describe('Report Generation Properties', () => {
  let reportService: ReportService;
  let taskService: TaskService;
  let userService: UserService;
  let testUserId: string;
  let testAssigneeId: string;

  beforeEach(async () => {
    await initializeDatabase();
    reportService = new ReportService();
    taskService = new TaskService();
    userService = new UserService();

    // Crear usuarios de prueba
    const creatorData: CreateUserRequest = {
      username: 'report-creator',
      email: 'creator@report.com',
      password: 'password123',
      fullName: 'Report Creator',
      role: 'admin'
    };

    const assigneeData: CreateUserRequest = {
      username: 'report-assignee',
      email: 'assignee@report.com',
      password: 'password123',
      fullName: 'Report Assignee',
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
  const taskTypeArb = fc.constantFrom('electrical', 'mechanical');
  const taskPriorityArb = fc.constantFrom('low', 'medium', 'high', 'urgent');
  const taskStatusArb = fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled');

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

  const reportFiltersArb = fc.record({
    startDate: fc.option(fc.date({ min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })),
    endDate: fc.option(fc.date({ min: new Date() })),
    taskType: fc.option(taskTypeArb),
    priority: fc.option(taskPriorityArb),
    status: fc.option(taskStatusArb)
  });

  it('Property 16.1: Productivity report totals are mathematically consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 5, maxLength: 15 }),
        reportFiltersArb,
        async (tasksData: CreateTaskRequest[], filters: ReportFilters) => {
          // Crear tareas
          const createdTasks = [];
          for (const taskData of tasksData) {
            const task = await taskService.createTask(taskData, testUserId);
            createdTasks.push(task);
          }

          // Completar algunas tareas aleatoriamente
          const tasksToComplete = createdTasks.slice(0, Math.floor(createdTasks.length / 2));
          for (const task of tasksToComplete) {
            await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          }

          // Generar reporte de productividad
          const report = await reportService.generateProductivityReport(filters);

          // Verificar consistencia matemática
          expect(report.summary.totalTasks).toBeGreaterThanOrEqual(0);
          expect(report.summary.completedTasks).toBeGreaterThanOrEqual(0);
          expect(report.summary.completedTasks).toBeLessThanOrEqual(report.summary.totalTasks);

          // Tasa de completación debe ser consistente
          if (report.summary.totalTasks > 0) {
            const expectedCompletionRate = Math.round((report.summary.completedTasks / report.summary.totalTasks) * 100);
            expect(Math.abs(report.summary.completionRate - expectedCompletionRate)).toBeLessThanOrEqual(1);
          } else {
            expect(report.summary.completionRate).toBe(0);
          }

          // Tiempo promedio debe ser positivo si hay tareas completadas
          if (report.summary.completedTasks > 0) {
            expect(report.summary.averageCompletionTime).toBeGreaterThanOrEqual(0);
          }

          // Tasa de puntualidad debe estar entre 0 y 100
          expect(report.summary.onTimeCompletionRate).toBeGreaterThanOrEqual(0);
          expect(report.summary.onTimeCompletionRate).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 16.2: Report breakdown percentages sum to 100%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 4, maxLength: 10 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas con diferentes tipos y prioridades
          for (const taskData of tasksData) {
            await taskService.createTask(taskData, testUserId);
          }

          const report = await reportService.generateProductivityReport({});

          // Verificar que los porcentajes por tipo suman 100%
          if (report.breakdown.byType.length > 0) {
            const typePercentageSum = report.breakdown.byType.reduce((sum, item) => sum + item.percentage, 0);
            expect(Math.abs(typePercentageSum - 100)).toBeLessThanOrEqual(1); // Tolerancia de redondeo
          }

          // Verificar que los porcentajes por prioridad suman 100%
          if (report.breakdown.byPriority.length > 0) {
            const priorityPercentageSum = report.breakdown.byPriority.reduce((sum, item) => sum + item.percentage, 0);
            expect(Math.abs(priorityPercentageSum - 100)).toBeLessThanOrEqual(1); // Tolerancia de redondeo
          }

          // Verificar que los conteos por tipo suman el total
          if (report.breakdown.byType.length > 0) {
            const typeCountSum = report.breakdown.byType.reduce((sum, item) => sum + item.count, 0);
            expect(typeCountSum).toBe(report.summary.totalTasks);
          }

          // Verificar que los conteos por prioridad suman el total
          if (report.breakdown.byPriority.length > 0) {
            const priorityCountSum = report.breakdown.byPriority.reduce((sum, item) => sum + item.count, 0);
            expect(priorityCountSum).toBe(report.summary.totalTasks);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 16.3: Performance report user metrics are consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 8 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas asignadas al usuario de prueba
          const createdTasks = [];
          for (const taskData of tasksData) {
            const task = await taskService.createTask({ ...taskData, assignedTo: testAssigneeId }, testUserId);
            createdTasks.push(task);
          }

          // Completar algunas tareas
          const tasksToComplete = createdTasks.slice(0, Math.ceil(createdTasks.length / 2));
          for (const task of tasksToComplete) {
            await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          }

          const report = await reportService.generatePerformanceReport({});

          // Verificar métricas de usuario
          report.userMetrics.forEach(userMetric => {
            // Tareas completadas debe ser no negativo
            expect(userMetric.tasksCompleted).toBeGreaterThanOrEqual(0);

            // Tiempo promedio debe ser positivo si hay tareas completadas
            if (userMetric.tasksCompleted > 0) {
              expect(userMetric.averageCompletionTime).toBeGreaterThanOrEqual(0);
            }

            // Tasa de puntualidad debe estar entre 0 y 100
            expect(userMetric.onTimeRate).toBeGreaterThanOrEqual(0);
            expect(userMetric.onTimeRate).toBeLessThanOrEqual(100);

            // Puntuación de calidad debe estar entre 0 y 100
            expect(userMetric.qualityScore).toBeGreaterThanOrEqual(0);
            expect(userMetric.qualityScore).toBeLessThanOrEqual(100);

            // Eficiencia debe estar entre 0 y 100
            expect(userMetric.efficiency).toBeGreaterThanOrEqual(0);
            expect(userMetric.efficiency).toBeLessThanOrEqual(100);

            // Campos requeridos deben estar presentes
            expect(userMetric.userId).toBeDefined();
            expect(userMetric.userName).toBeDefined();
            expect(typeof userMetric.userName).toBe('string');
          });

          // Verificar resumen
          expect(report.summary.totalUsers).toBeGreaterThanOrEqual(0);
          expect(report.summary.activeUsers).toBeGreaterThanOrEqual(0);
          expect(report.summary.activeUsers).toBeLessThanOrEqual(report.summary.totalUsers);
          expect(report.summary.averageTasksPerUser).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 16.4: Report filters correctly limit data scope', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 6, maxLength: 12 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas con diferentes tipos
          const electricalTasks = [];
          const mechanicalTasks = [];

          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            const type = i % 2 === 0 ? 'electrical' : 'mechanical';
            const task = await taskService.createTask({ ...taskData, type }, testUserId);
            
            if (type === 'electrical') {
              electricalTasks.push(task);
            } else {
              mechanicalTasks.push(task);
            }
          }

          // Generar reporte sin filtros
          const fullReport = await reportService.generateProductivityReport({});

          // Generar reporte filtrado por tipo eléctrico
          const electricalReport = await reportService.generateProductivityReport({ taskType: 'electrical' });

          // Generar reporte filtrado por tipo mecánico
          const mechanicalReport = await reportService.generateProductivityReport({ taskType: 'mechanical' });

          // Verificar que los filtros funcionan correctamente
          expect(electricalReport.summary.totalTasks).toBeLessThanOrEqual(fullReport.summary.totalTasks);
          expect(mechanicalReport.summary.totalTasks).toBeLessThanOrEqual(fullReport.summary.totalTasks);

          // Verificar que el desglose por tipo refleja el filtro
          if (electricalReport.breakdown.byType.length > 0) {
            const electricalTypeBreakdown = electricalReport.breakdown.byType.find(t => t.type === 'electrical');
            if (electricalTypeBreakdown) {
              expect(electricalTypeBreakdown.count).toBe(electricalReport.summary.totalTasks);
            }
          }

          if (mechanicalReport.breakdown.byType.length > 0) {
            const mechanicalTypeBreakdown = mechanicalReport.breakdown.byType.find(t => t.type === 'mechanical');
            if (mechanicalTypeBreakdown) {
              expect(mechanicalTypeBreakdown.count).toBe(mechanicalReport.summary.totalTasks);
            }
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 16.5: Productivity metrics are consistent across different calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 6 }),
        reportFiltersArb,
        async (tasksData: CreateTaskRequest[], filters: ReportFilters) => {
          // Crear tareas
          for (const taskData of tasksData) {
            await taskService.createTask(taskData, testUserId);
          }

          // Obtener métricas múltiples veces
          const metrics1 = await reportService.getProductivityMetrics(filters);
          const metrics2 = await reportService.getProductivityMetrics(filters);

          // Las métricas deben ser consistentes entre llamadas
          expect(metrics1.tasksCompleted).toBe(metrics2.tasksCompleted);
          expect(metrics1.averageCompletionTime).toBe(metrics2.averageCompletionTime);
          expect(metrics1.onTimeRate).toBe(metrics2.onTimeRate);
          expect(metrics1.productivityTrend).toBe(metrics2.productivityTrend);

          // Verificar que las métricas son válidas
          expect(metrics1.tasksCompleted).toBeGreaterThanOrEqual(0);
          expect(metrics1.averageCompletionTime).toBeGreaterThanOrEqual(0);
          expect(metrics1.onTimeRate).toBeGreaterThanOrEqual(0);
          expect(metrics1.onTimeRate).toBeLessThanOrEqual(100);
          expect(typeof metrics1.productivityTrend).toBe('number');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 16.6: Report export maintains data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 2, maxLength: 5 }),
        fc.constantFrom('json', 'csv'),
        async (tasksData: CreateTaskRequest[], format: 'json' | 'csv') => {
          // Crear tareas
          for (const taskData of tasksData) {
            await taskService.createTask(taskData, testUserId);
          }

          const report = await reportService.generateProductivityReport({});
          const exportedData = await reportService.exportReport(report, format, 'Test Report');

          // Verificar que la exportación no está vacía
          expect(exportedData).toBeDefined();
          expect(typeof exportedData).toBe('string');
          expect(exportedData.length).toBeGreaterThan(0);

          if (format === 'json') {
            // Verificar que es JSON válido
            expect(() => JSON.parse(exportedData)).not.toThrow();
            
            const parsedData = JSON.parse(exportedData);
            
            // Verificar que mantiene la estructura del reporte
            expect(parsedData.summary).toBeDefined();
            expect(parsedData.breakdown).toBeDefined();
            expect(parsedData.trends).toBeDefined();
            expect(parsedData.insights).toBeDefined();
            
            // Verificar que los datos numéricos se mantienen
            expect(parsedData.summary.totalTasks).toBe(report.summary.totalTasks);
            expect(parsedData.summary.completedTasks).toBe(report.summary.completedTasks);
          }

          if (format === 'csv') {
            // Verificar que contiene el título del reporte
            expect(exportedData).toContain('Test Report');
            
            // Verificar que contiene datos del resumen
            expect(exportedData).toContain('Resumen');
            
            // Verificar que tiene estructura de CSV básica
            const lines = exportedData.split('\n');
            expect(lines.length).toBeGreaterThan(1);
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 16.7: Report insights are generated based on actual data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 4, maxLength: 8 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas y completar la mayoría para generar insights positivos
          const createdTasks = [];
          for (const taskData of tasksData) {
            const task = await taskService.createTask({ ...taskData, assignedTo: testAssigneeId }, testUserId);
            createdTasks.push(task);
          }

          // Completar la mayoría de las tareas
          const tasksToComplete = createdTasks.slice(0, Math.floor(createdTasks.length * 0.8));
          for (const task of tasksToComplete) {
            await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          }

          const report = await reportService.generateProductivityReport({});

          // Verificar que se generan insights
          expect(report.insights).toBeDefined();
          expect(Array.isArray(report.insights)).toBe(true);

          // Si hay una alta tasa de completación, debe haber insights positivos
          if (report.summary.completionRate > 80) {
            const hasPositiveInsight = report.insights.some(insight => 
              insight.toLowerCase().includes('excelente') || 
              insight.toLowerCase().includes('eficiente')
            );
            expect(hasPositiveInsight).toBe(true);
          }

          // Cada insight debe ser una cadena no vacía
          report.insights.forEach(insight => {
            expect(typeof insight).toBe('string');
            expect(insight.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 16.8: Performance report recommendations are relevant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 6 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas asignadas a diferentes usuarios
          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            const assignTo = i % 2 === 0 ? testAssigneeId : testUserId;
            await taskService.createTask({ ...taskData, assignedTo: assignTo }, testUserId);
          }

          const report = await reportService.generatePerformanceReport({});

          // Verificar que se generan recomendaciones
          expect(report.recommendations).toBeDefined();
          expect(Array.isArray(report.recommendations)).toBe(true);

          // Cada recomendación debe ser una cadena no vacía
          report.recommendations.forEach(recommendation => {
            expect(typeof recommendation).toBe('string');
            expect(recommendation.length).toBeGreaterThan(0);
          });

          // Si no hay datos suficientes, debe haber una recomendación específica
          if (report.userMetrics.length === 0) {
            expect(report.recommendations).toContain('No hay datos suficientes para generar recomendaciones');
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 16.9: Report data is temporally consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 6 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear tareas en diferentes momentos (simulado con fechas)
          const now = new Date();
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

          for (const taskData of tasksData) {
            await taskService.createTask(taskData, testUserId);
          }

          // Generar reportes con diferentes filtros de fecha
          const allTimeReport = await reportService.generateProductivityReport({});
          const recentReport = await reportService.generateProductivityReport({
            startDate: yesterday,
            endDate: tomorrow
          });

          // El reporte reciente debe tener menos o igual tareas que el de todo el tiempo
          expect(recentReport.summary.totalTasks).toBeLessThanOrEqual(allTimeReport.summary.totalTasks);
          expect(recentReport.summary.completedTasks).toBeLessThanOrEqual(allTimeReport.summary.completedTasks);

          // Las tendencias diarias deben estar ordenadas cronológicamente
          if (allTimeReport.trends.daily.length > 1) {
            for (let i = 1; i < allTimeReport.trends.daily.length; i++) {
              expect(allTimeReport.trends.daily[i-1].date.getTime()).toBeGreaterThanOrEqual(
                allTimeReport.trends.daily[i].date.getTime()
              );
            }
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 16.10: Report generation handles edge cases gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        reportFiltersArb,
        async (filters: ReportFilters) => {
          // Generar reportes sin datos (base de datos vacía excepto usuarios de prueba)
          const productivityReport = await reportService.generateProductivityReport(filters);
          const performanceReport = await reportService.generatePerformanceReport(filters);

          // Los reportes deben generarse sin errores incluso sin datos
          expect(productivityReport).toBeDefined();
          expect(performanceReport).toBeDefined();

          // Los totales deben ser cero o valores por defecto válidos
          expect(productivityReport.summary.totalTasks).toBe(0);
          expect(productivityReport.summary.completedTasks).toBe(0);
          expect(productivityReport.summary.completionRate).toBe(0);

          // Las estructuras de datos deben estar presentes
          expect(Array.isArray(productivityReport.breakdown.byType)).toBe(true);
          expect(Array.isArray(productivityReport.breakdown.byPriority)).toBe(true);
          expect(Array.isArray(productivityReport.breakdown.byUser)).toBe(true);
          expect(Array.isArray(productivityReport.trends.daily)).toBe(true);
          expect(Array.isArray(productivityReport.insights)).toBe(true);

          expect(Array.isArray(performanceReport.userMetrics)).toBe(true);
          expect(Array.isArray(performanceReport.recommendations)).toBe(true);

          // Los valores numéricos deben ser válidos (no NaN o infinito)
          expect(isFinite(productivityReport.summary.averageCompletionTime)).toBe(true);
          expect(isFinite(productivityReport.summary.onTimeCompletionRate)).toBe(true);
          expect(isFinite(performanceReport.summary.averageTasksPerUser)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});