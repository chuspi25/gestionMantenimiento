import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, CreateUserRequest, TaskPriority } from '../../../src/backend/models/index.js';
import { query } from '../../../src/backend/utils/database.js';

describe('Task Ordering Properties Tests', () => {
  let taskService: TaskService;
  let userService: UserService;
  let createdTaskIds: string[] = [];
  let createdUserIds: string[] = [];
  let testUserId: string;

  beforeEach(async () => {
    // Configurar variables de entorno para tests
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.BCRYPT_SALT_ROUNDS = '4';
    
    taskService = new TaskService();
    userService = new UserService();
    createdTaskIds = [];
    createdUserIds = [];

    // Crear usuario de prueba
    const userData: CreateUserRequest = {
      email: 'ordering@test.com',
      name: 'Ordering Test User',
      password: 'password123',
      role: 'admin'
    };
    const testUser = await userService.createUser(userData, 'system');
    testUserId = testUser.id;
    createdUserIds.push(testUser.id);
  });

  afterEach(async () => {
    // Limpiar tareas creadas durante los tests
    for (const taskId of createdTaskIds) {
      try {
        await query('DELETE FROM task_notes WHERE task_id = $1', [taskId]);
        await query('DELETE FROM task_attachments WHERE task_id = $1', [taskId]);
        await query('DELETE FROM tasks WHERE id = $1', [taskId]);
      } catch (error) {
        console.warn(`Error limpiando tarea ${taskId}:`, error);
      }
    }

    // Limpiar usuarios creados durante los tests
    for (const userId of createdUserIds) {
      try {
        await query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (error) {
        console.warn(`Error limpiando usuario ${userId}:`, error);
      }
    }

    createdTaskIds = [];
    createdUserIds = [];
  });

  /**
   * **Feature: maintenance-app, Property 7: Task ordering by priority and date**
   * For any task ordering operation, the system should correctly sort tasks by priority
   * (urgent > high > medium > low) and by date fields maintaining consistent ordering
   * **Validates: Requirements 2.4**
   */
  it('Property 7a: Task ordering by priority should follow correct hierarchy', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar tareas con diferentes prioridades
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            description: fc.constant('Priority ordering test'),
            type: fc.constantFrom('electrical', 'mechanical'),
            priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
            location: fc.constant('Test Location'),
            requiredTools: fc.constant([]),
            estimatedDuration: fc.constant(60),
            dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
          }),
          { minLength: 8, maxLength: 12 }
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of tasksData) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Obtener tareas ordenadas por prioridad descendente
          const orderedTasks = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'priority',
            sortOrder: 'desc'
          });

          const testTasks = orderedTasks.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar que el orden de prioridad es correcto
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          
          for (let i = 0; i < testTasks.length - 1; i++) {
            const currentPriority = priorityOrder[testTasks[i].priority];
            const nextPriority = priorityOrder[testTasks[i + 1].priority];
            
            // La prioridad actual debe ser mayor o igual que la siguiente
            expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
          }

          // Verificar orden ascendente
          const orderedTasksAsc = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'priority',
            sortOrder: 'asc'
          });

          const testTasksAsc = orderedTasksAsc.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          for (let i = 0; i < testTasksAsc.length - 1; i++) {
            const currentPriority = priorityOrder[testTasksAsc[i].priority];
            const nextPriority = priorityOrder[testTasksAsc[i + 1].priority];
            
            // La prioridad actual debe ser menor o igual que la siguiente
            expect(currentPriority).toBeLessThanOrEqual(nextPriority);
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 7b: Task ordering by due date should be chronologically correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar tareas con diferentes fechas de vencimiento
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            description: fc.constant('Date ordering test'),
            type: fc.constant('electrical'),
            priority: fc.constant('medium'),
            location: fc.constant('Test Location'),
            requiredTools: fc.constant([]),
            estimatedDuration: fc.constant(60),
            dueDate: fc.date({ 
              min: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 día en el futuro
              max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días en el futuro
            })
          }),
          { minLength: 5, maxLength: 8 }
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];

          // Crear todas las tareas con un pequeño delay para asegurar diferentes timestamps
          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
            
            // Pequeño delay para asegurar diferentes created_at
            if (i < tasksData.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }

          // Obtener tareas ordenadas por fecha de vencimiento ascendente
          const orderedByDueDateAsc = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'dueDate',
            sortOrder: 'asc'
          });

          const testTasksAsc = orderedByDueDateAsc.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar orden ascendente por fecha de vencimiento
          for (let i = 0; i < testTasksAsc.length - 1; i++) {
            const currentDate = testTasksAsc[i].dueDate.getTime();
            const nextDate = testTasksAsc[i + 1].dueDate.getTime();
            expect(currentDate).toBeLessThanOrEqual(nextDate);
          }

          // Obtener tareas ordenadas por fecha de vencimiento descendente
          const orderedByDueDateDesc = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'dueDate',
            sortOrder: 'desc'
          });

          const testTasksDesc = orderedByDueDateDesc.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar orden descendente por fecha de vencimiento
          for (let i = 0; i < testTasksDesc.length - 1; i++) {
            const currentDate = testTasksDesc[i].dueDate.getTime();
            const nextDate = testTasksDesc[i + 1].dueDate.getTime();
            expect(currentDate).toBeGreaterThanOrEqual(nextDate);
          }
        }
      ),
      { numRuns: 6 }
    );
  });

  it('Property 7c: Task ordering by creation date should be chronologically correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            description: fc.constant('Creation date ordering test'),
            type: fc.constant('mechanical'),
            priority: fc.constant('high'),
            location: fc.constant('Test Location'),
            requiredTools: fc.constant([]),
            estimatedDuration: fc.constant(90),
            dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
          }),
          { minLength: 4, maxLength: 6 }
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];

          // Crear tareas con delay para asegurar diferentes created_at
          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
            
            // Delay más largo para asegurar diferencias en created_at
            if (i < tasksData.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          // Obtener tareas ordenadas por fecha de creación descendente (más recientes primero)
          const orderedByCreatedDesc = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'createdAt',
            sortOrder: 'desc'
          });

          const testTasksDesc = orderedByCreatedDesc.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar orden descendente por fecha de creación
          for (let i = 0; i < testTasksDesc.length - 1; i++) {
            const currentDate = testTasksDesc[i].createdAt.getTime();
            const nextDate = testTasksDesc[i + 1].createdAt.getTime();
            expect(currentDate).toBeGreaterThanOrEqual(nextDate);
          }

          // Obtener tareas ordenadas por fecha de creación ascendente
          const orderedByCreatedAsc = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'createdAt',
            sortOrder: 'asc'
          });

          const testTasksAsc = orderedByCreatedAsc.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar orden ascendente por fecha de creación
          for (let i = 0; i < testTasksAsc.length - 1; i++) {
            const currentDate = testTasksAsc[i].createdAt.getTime();
            const nextDate = testTasksAsc[i + 1].createdAt.getTime();
            expect(currentDate).toBeLessThanOrEqual(nextDate);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('Property 7d: Task ordering by title should be alphabetically correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar tareas con títulos diferentes
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            description: fc.constant('Title ordering test'),
            type: fc.constant('electrical'),
            priority: fc.constant('medium'),
            location: fc.constant('Test Location'),
            requiredTools: fc.constant([]),
            estimatedDuration: fc.constant(60),
            dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
          }),
          { minLength: 4, maxLength: 7 }
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of tasksData) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Obtener tareas ordenadas por título ascendente
          const orderedByTitleAsc = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'title',
            sortOrder: 'asc'
          });

          const testTasksAsc = orderedByTitleAsc.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar orden alfabético ascendente
          for (let i = 0; i < testTasksAsc.length - 1; i++) {
            const currentTitle = testTasksAsc[i].title.toLowerCase();
            const nextTitle = testTasksAsc[i + 1].title.toLowerCase();
            expect(currentTitle.localeCompare(nextTitle)).toBeLessThanOrEqual(0);
          }

          // Obtener tareas ordenadas por título descendente
          const orderedByTitleDesc = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'title',
            sortOrder: 'desc'
          });

          const testTasksDesc = orderedByTitleDesc.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar orden alfabético descendente
          for (let i = 0; i < testTasksDesc.length - 1; i++) {
            const currentTitle = testTasksDesc[i].title.toLowerCase();
            const nextTitle = testTasksDesc[i + 1].title.toLowerCase();
            expect(currentTitle.localeCompare(nextTitle)).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 6 }
    );
  });

  it('Property 7e: Task ordering should be stable and consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar tareas con la misma prioridad para probar estabilidad
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            description: fc.constant('Stability test'),
            type: fc.constant('electrical'),
            priority: fc.constant('medium'), // Misma prioridad para todas
            location: fc.constant('Test Location'),
            requiredTools: fc.constant([]),
            estimatedDuration: fc.constant(60),
            dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
          }),
          { minLength: 3, maxLength: 5 }
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];

          // Crear tareas con delay para diferentes created_at
          for (let i = 0; i < tasksData.length; i++) {
            const taskData = tasksData[i];
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
            
            if (i < tasksData.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 20));
            }
          }

          // Realizar múltiples consultas con el mismo ordenamiento
          const query1 = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'priority',
            sortOrder: 'desc'
          });

          const query2 = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'priority',
            sortOrder: 'desc'
          });

          const query3 = await taskService.listTasks({}, {
            page: 1,
            limit: 100,
            sortBy: 'priority',
            sortOrder: 'desc'
          });

          const tasks1 = query1.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );
          const tasks2 = query2.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );
          const tasks3 = query3.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // El orden debe ser consistente entre consultas
          expect(tasks1.length).toBe(tasks2.length);
          expect(tasks2.length).toBe(tasks3.length);

          for (let i = 0; i < tasks1.length; i++) {
            expect(tasks1[i].id).toBe(tasks2[i].id);
            expect(tasks2[i].id).toBe(tasks3[i].id);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('Property 7f: Task ordering should handle mixed priority scenarios correctly', async () => {
    // Crear un conjunto específico de tareas con prioridades conocidas
    const specificTasks: CreateTaskRequest[] = [
      {
        title: 'Urgent Task',
        description: 'This is urgent',
        type: 'electrical',
        priority: 'urgent',
        location: 'Location A',
        requiredTools: [],
        estimatedDuration: 30,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
      },
      {
        title: 'Low Task',
        description: 'This is low priority',
        type: 'mechanical',
        priority: 'low',
        location: 'Location B',
        requiredTools: [],
        estimatedDuration: 120,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      },
      {
        title: 'High Task',
        description: 'This is high priority',
        type: 'electrical',
        priority: 'high',
        location: 'Location C',
        requiredTools: [],
        estimatedDuration: 60,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      },
      {
        title: 'Medium Task',
        description: 'This is medium priority',
        type: 'mechanical',
        priority: 'medium',
        location: 'Location D',
        requiredTools: [],
        estimatedDuration: 90,
        dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
      }
    ];

    const createdTasks = [];

    // Crear las tareas
    for (const taskData of specificTasks) {
      const createdTask = await taskService.createTask(taskData, testUserId);
      createdTasks.push(createdTask);
      createdTaskIds.push(createdTask.id);
    }

    // Obtener tareas ordenadas por prioridad descendente
    const orderedTasks = await taskService.listTasks({}, {
      page: 1,
      limit: 100,
      sortBy: 'priority',
      sortOrder: 'desc'
    });

    const testTasks = orderedTasks.items.filter(task => 
      createdTasks.some(ct => ct.id === task.id)
    );

    // Verificar el orden específico esperado: urgent, high, medium, low
    const expectedOrder = ['urgent', 'high', 'medium', 'low'];
    const actualOrder = testTasks.map(task => task.priority);

    expect(actualOrder).toEqual(expectedOrder);

    // Verificar que los títulos corresponden a las prioridades correctas
    expect(testTasks[0].title).toBe('Urgent Task');
    expect(testTasks[1].title).toBe('High Task');
    expect(testTasks[2].title).toBe('Medium Task');
    expect(testTasks[3].title).toBe('Low Task');
  });
});