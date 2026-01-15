import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, CreateUserRequest, TaskType, TaskPriority } from '../../../src/backend/models/index.js';
import { query } from '../../../src/backend/utils/database.js';

describe('Task Categorization Properties Tests', () => {
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
      email: 'categorization@test.com',
      name: 'Categorization Test User',
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
   * **Feature: maintenance-app, Property 6: Task categorization consistency**
   * For any task categorization by maintenance type, the system should consistently
   * group and filter tasks maintaining data integrity and accurate categorization
   * **Validates: Requirements 2.3**
   */
  it('Property 6a: Task categorization by type should be consistent and complete', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar tareas con diferentes tipos
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            description: fc.constant('Categorization test task'),
            type: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
            priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
            location: fc.constant('Test Location'),
            requiredTools: fc.constant([]),
            estimatedDuration: fc.constant(60),
            dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
          }),
          { minLength: 4, maxLength: 10 }
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of tasksData) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Contar tareas por tipo en los datos originales
          const electricalCount = tasksData.filter(task => task.type === 'electrical').length;
          const mechanicalCount = tasksData.filter(task => task.type === 'mechanical').length;

          // Filtrar tareas eléctricas
          const electricalTasks = await taskService.listTasks({ type: 'electrical' });
          const electricalTasksFromTest = electricalTasks.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Filtrar tareas mecánicas
          const mechanicalTasks = await taskService.listTasks({ type: 'mechanical' });
          const mechanicalTasksFromTest = mechanicalTasks.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar que la categorización es correcta
          expect(electricalTasksFromTest.length).toBe(electricalCount);
          expect(mechanicalTasksFromTest.length).toBe(mechanicalCount);

          // Verificar que todas las tareas eléctricas son realmente eléctricas
          electricalTasksFromTest.forEach(task => {
            expect(task.type).toBe('electrical');
          });

          // Verificar que todas las tareas mecánicas son realmente mecánicas
          mechanicalTasksFromTest.forEach(task => {
            expect(task.type).toBe('mechanical');
          });

          // Verificar que no hay solapamiento
          const electricalIds = new Set(electricalTasksFromTest.map(t => t.id));
          const mechanicalIds = new Set(mechanicalTasksFromTest.map(t => t.id));
          const intersection = new Set([...electricalIds].filter(id => mechanicalIds.has(id)));
          expect(intersection.size).toBe(0);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 6b: Task categorization should preserve all task properties', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
          priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
          location: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
          estimatedDuration: fc.integer({ min: 15, max: 300 }),
          dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
        }),
        async (taskData: CreateTaskRequest) => {
          // Crear tarea
          const createdTask = await taskService.createTask(taskData, testUserId);
          createdTaskIds.push(createdTask.id);

          // Obtener tarea a través de filtro de categorización
          const filteredTasks = await taskService.listTasks({ type: taskData.type });
          const foundTask = filteredTasks.items.find(task => task.id === createdTask.id);

          // Verificar que la tarea se encontró
          expect(foundTask).toBeDefined();

          // Verificar que todas las propiedades se preservaron
          expect(foundTask!.title).toBe(taskData.title.trim());
          expect(foundTask!.description).toBe(taskData.description.trim());
          expect(foundTask!.type).toBe(taskData.type);
          expect(foundTask!.priority).toBe(taskData.priority);
          expect(foundTask!.location).toBe(taskData.location.trim());
          expect(foundTask!.requiredTools).toEqual(taskData.requiredTools);
          expect(foundTask!.estimatedDuration).toBe(taskData.estimatedDuration);
          expect(foundTask!.dueDate.getTime()).toBe(taskData.dueDate.getTime());
          expect(foundTask!.createdBy).toBe(testUserId);
          expect(foundTask!.status).toBe('pending');
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 6c: Multiple categorization filters should work together correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar tareas con combinaciones específicas
        fc.record({
          electricalHigh: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Electrical high priority task'),
              type: fc.constant('electrical') as fc.Arbitrary<TaskType>,
              priority: fc.constant('high') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Test Location'),
              requiredTools: fc.constant([]),
              estimatedDuration: fc.constant(120),
              dueDate: fc.constant(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
            }),
            { minLength: 1, maxLength: 3 }
          ),
          mechanicalLow: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Mechanical low priority task'),
              type: fc.constant('mechanical') as fc.Arbitrary<TaskType>,
              priority: fc.constant('low') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Test Location'),
              requiredTools: fc.constant([]),
              estimatedDuration: fc.constant(60),
              dueDate: fc.constant(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000))
            }),
            { minLength: 1, maxLength: 3 }
          ),
          electricalMedium: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Electrical medium priority task'),
              type: fc.constant('electrical') as fc.Arbitrary<TaskType>,
              priority: fc.constant('medium') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Test Location'),
              requiredTools: fc.constant([]),
              estimatedDuration: fc.constant(90),
              dueDate: fc.constant(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000))
            }),
            { minLength: 1, maxLength: 2 }
          )
        }),
        async ({ electricalHigh, mechanicalLow, electricalMedium }) => {
          const allTasks = [...electricalHigh, ...mechanicalLow, ...electricalMedium];
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of allTasks) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Filtrar por tipo eléctrico
          const electricalTasks = await taskService.listTasks({ type: 'electrical' });
          const electricalFromTest = electricalTasks.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Filtrar por tipo eléctrico Y prioridad alta
          const electricalHighTasks = await taskService.listTasks({ 
            type: 'electrical', 
            priority: 'high' 
          });
          const electricalHighFromTest = electricalHighTasks.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Filtrar por tipo mecánico Y prioridad baja
          const mechanicalLowTasks = await taskService.listTasks({ 
            type: 'mechanical', 
            priority: 'low' 
          });
          const mechanicalLowFromTest = mechanicalLowTasks.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar conteos
          expect(electricalFromTest.length).toBe(electricalHigh.length + electricalMedium.length);
          expect(electricalHighFromTest.length).toBe(electricalHigh.length);
          expect(mechanicalLowFromTest.length).toBe(mechanicalLow.length);

          // Verificar que los filtros combinados funcionan correctamente
          electricalHighFromTest.forEach(task => {
            expect(task.type).toBe('electrical');
            expect(task.priority).toBe('high');
          });

          mechanicalLowFromTest.forEach(task => {
            expect(task.type).toBe('mechanical');
            expect(task.priority).toBe('low');
          });
        }
      ),
      { numRuns: 6 }
    );
  });

  it('Property 6d: Task categorization should handle empty results correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Crear tareas de un solo tipo
        fc.record({
          taskType: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
          tasks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Single type task'),
              location: fc.constant('Test Location'),
              requiredTools: fc.constant([]),
              estimatedDuration: fc.constant(60),
              dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
            }),
            { minLength: 1, maxLength: 3 }
          )
        }),
        async ({ taskType, tasks }) => {
          const createdTasks = [];

          // Crear tareas del tipo especificado
          for (const taskData of tasks) {
            const fullTaskData: CreateTaskRequest = {
              ...taskData,
              type: taskType,
              priority: 'medium'
            };
            const createdTask = await taskService.createTask(fullTaskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Filtrar por el tipo opuesto (debería estar vacío)
          const oppositeType: TaskType = taskType === 'electrical' ? 'mechanical' : 'electrical';
          const oppositeTasks = await taskService.listTasks({ type: oppositeType });
          const oppositeFromTest = oppositeTasks.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Filtrar por el tipo correcto (debería tener resultados)
          const correctTasks = await taskService.listTasks({ type: taskType });
          const correctFromTest = correctTasks.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar resultados
          expect(oppositeFromTest.length).toBe(0);
          expect(correctFromTest.length).toBe(tasks.length);

          // Verificar que todas las tareas del tipo correcto son del tipo esperado
          correctFromTest.forEach(task => {
            expect(task.type).toBe(taskType);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 6e: Task categorization should be stable across multiple queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            description: fc.constant('Stability test task'),
            type: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
            priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
            location: fc.constant('Test Location'),
            requiredTools: fc.constant([]),
            estimatedDuration: fc.constant(90),
            dueDate: fc.constant(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000))
          }),
          { minLength: 3, maxLength: 6 }
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of tasksData) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Realizar múltiples consultas del mismo filtro
          const query1 = await taskService.listTasks({ type: 'electrical' });
          const query2 = await taskService.listTasks({ type: 'electrical' });
          const query3 = await taskService.listTasks({ type: 'electrical' });

          const electrical1 = query1.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );
          const electrical2 = query2.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );
          const electrical3 = query3.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Los resultados deben ser idénticos
          expect(electrical1.length).toBe(electrical2.length);
          expect(electrical2.length).toBe(electrical3.length);

          // Verificar que los IDs son los mismos
          const ids1 = new Set(electrical1.map(t => t.id));
          const ids2 = new Set(electrical2.map(t => t.id));
          const ids3 = new Set(electrical3.map(t => t.id));

          expect(ids1).toEqual(ids2);
          expect(ids2).toEqual(ids3);

          // Verificar que los datos son idénticos
          electrical1.forEach((task, index) => {
            expect(task).toEqual(electrical2[index]);
            expect(task).toEqual(electrical3[index]);
          });
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 6f: Task categorization should handle all valid type combinations', async () => {
    const allTypes: TaskType[] = ['electrical', 'mechanical'];
    const allPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

    await fc.assert(
      fc.asyncProperty(
        // Generar al menos una tarea para cada combinación tipo-prioridad
        fc.constant(
          allTypes.flatMap(type =>
            allPriorities.map(priority => ({
              title: `${type}-${priority}-task`,
              description: `Task of type ${type} with priority ${priority}`,
              type,
              priority,
              location: 'Test Location',
              requiredTools: [],
              estimatedDuration: 60,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }))
          )
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of tasksData) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Verificar cada combinación de filtros
          for (const type of allTypes) {
            for (const priority of allPriorities) {
              const filteredTasks = await taskService.listTasks({ type, priority });
              const matchingTasks = filteredTasks.items.filter(task => 
                createdTasks.some(ct => ct.id === task.id)
              );

              // Debe haber exactamente una tarea para cada combinación
              expect(matchingTasks.length).toBe(1);
              
              const task = matchingTasks[0];
              expect(task.type).toBe(type);
              expect(task.priority).toBe(priority);
              expect(task.title).toBe(`${type}-${priority}-task`);
            }
          }
        }
      ),
      { numRuns: 3 }
    );
  });
});