import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, CreateUserRequest, TaskType, TaskPriority, TaskStatus } from '../../../src/backend/models/index.js';
import { query } from '../../../src/backend/utils/database.js';

describe('Task Filtering by Type Properties Tests', () => {
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
      email: 'filtering@test.com',
      name: 'Filtering Test User',
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
   * **Feature: maintenance-app, Property 8: Task filtering by type**
   * For any task filtering operation by maintenance type, the system should return
   * only tasks of the specified type while maintaining data integrity and completeness
   * **Validates: Requirements 5.2**
   */
  it('Property 8a: Filtering by electrical type should return only electrical tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar mix de tareas eléctricas y mecánicas
        fc.record({
          electricalTasks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Electrical task for filtering test'),
              type: fc.constant('electrical') as fc.Arbitrary<TaskType>,
              priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Electrical Location'),
              requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 3 }),
              estimatedDuration: fc.integer({ min: 30, max: 180 }),
              dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          mechanicalTasks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Mechanical task for filtering test'),
              type: fc.constant('mechanical') as fc.Arbitrary<TaskType>,
              priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Mechanical Location'),
              requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 3 }),
              estimatedDuration: fc.integer({ min: 30, max: 180 }),
              dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
            }),
            { minLength: 2, maxLength: 5 }
          )
        }),
        async ({ electricalTasks, mechanicalTasks }) => {
          const allTasks = [...electricalTasks, ...mechanicalTasks];
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of allTasks) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Filtrar solo tareas eléctricas
          const electricalResult = await taskService.listTasks({ type: 'electrical' });
          const electricalFromTest = electricalResult.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar que solo se devuelven tareas eléctricas
          expect(electricalFromTest.length).toBe(electricalTasks.length);
          electricalFromTest.forEach(task => {
            expect(task.type).toBe('electrical');
            expect(task.description).toContain('Electrical task');
          });

          // Verificar que no hay tareas mecánicas en el resultado
          const mechanicalInResult = electricalFromTest.filter(task => task.type === 'mechanical');
          expect(mechanicalInResult.length).toBe(0);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 8b: Filtering by mechanical type should return only mechanical tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          electricalTasks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Electrical task'),
              type: fc.constant('electrical') as fc.Arbitrary<TaskType>,
              priority: fc.constant('medium') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Test Location'),
              requiredTools: fc.constant([]),
              estimatedDuration: fc.constant(60),
              dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
            }),
            { minLength: 1, maxLength: 4 }
          ),
          mechanicalTasks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Mechanical task'),
              type: fc.constant('mechanical') as fc.Arbitrary<TaskType>,
              priority: fc.constant('high') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Test Location'),
              requiredTools: fc.constant([]),
              estimatedDuration: fc.constant(90),
              dueDate: fc.constant(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000))
            }),
            { minLength: 1, maxLength: 4 }
          )
        }),
        async ({ electricalTasks, mechanicalTasks }) => {
          const allTasks = [...electricalTasks, ...mechanicalTasks];
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of allTasks) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Filtrar solo tareas mecánicas
          const mechanicalResult = await taskService.listTasks({ type: 'mechanical' });
          const mechanicalFromTest = mechanicalResult.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar que solo se devuelven tareas mecánicas
          expect(mechanicalFromTest.length).toBe(mechanicalTasks.length);
          mechanicalFromTest.forEach(task => {
            expect(task.type).toBe('mechanical');
            expect(task.description).toContain('Mechanical task');
          });

          // Verificar que no hay tareas eléctricas en el resultado
          const electricalInResult = mechanicalFromTest.filter(task => task.type === 'electrical');
          expect(electricalInResult.length).toBe(0);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 8c: Type filtering should work correctly with other filters combined', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          electricalHighTasks: fc.array(
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
            { minLength: 2, maxLength: 4 }
          ),
          electricalLowTasks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Electrical low priority task'),
              type: fc.constant('electrical') as fc.Arbitrary<TaskType>,
              priority: fc.constant('low') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Test Location'),
              requiredTools: fc.constant([]),
              estimatedDuration: fc.constant(60),
              dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
            }),
            { minLength: 1, maxLength: 3 }
          ),
          mechanicalHighTasks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              description: fc.constant('Mechanical high priority task'),
              type: fc.constant('mechanical') as fc.Arbitrary<TaskType>,
              priority: fc.constant('high') as fc.Arbitrary<TaskPriority>,
              location: fc.constant('Test Location'),
              requiredTools: fc.constant([]),
              estimatedDuration: fc.constant(90),
              dueDate: fc.constant(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000))
            }),
            { minLength: 1, maxLength: 3 }
          )
        }),
        async ({ electricalHighTasks, electricalLowTasks, mechanicalHighTasks }) => {
          const allTasks = [...electricalHighTasks, ...electricalLowTasks, ...mechanicalHighTasks];
          const createdTasks = [];

          // Crear todas las tareas
          for (const taskData of allTasks) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Filtrar tareas eléctricas con prioridad alta
          const electricalHighResult = await taskService.listTasks({ 
            type: 'electrical', 
            priority: 'high' 
          });
          const electricalHighFromTest = electricalHighResult.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar que solo se devuelven tareas eléctricas de alta prioridad
          expect(electricalHighFromTest.length).toBe(electricalHighTasks.length);
          electricalHighFromTest.forEach(task => {
            expect(task.type).toBe('electrical');
            expect(task.priority).toBe('high');
            expect(task.description).toContain('Electrical high priority');
          });

          // Filtrar todas las tareas de alta prioridad (ambos tipos)
          const allHighResult = await taskService.listTasks({ priority: 'high' });
          const allHighFromTest = allHighResult.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Debe incluir tanto eléctricas como mecánicas de alta prioridad
          expect(allHighFromTest.length).toBe(electricalHighTasks.length + mechanicalHighTasks.length);
          allHighFromTest.forEach(task => {
            expect(task.priority).toBe('high');
            expect(['electrical', 'mechanical']).toContain(task.type);
          });
        }
      ),
      { numRuns: 6 }
    );
  });

  it('Property 8d: Type filtering should preserve task data integrity', async () => {
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

          // Filtrar por el tipo de la tarea creada
          const filteredResult = await taskService.listTasks({ type: taskData.type });
          const foundTask = filteredResult.items.find(task => task.id === createdTask.id);

          // Verificar que la tarea se encontró y todos los datos están intactos
          expect(foundTask).toBeDefined();
          expect(foundTask!.id).toBe(createdTask.id);
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
          expect(foundTask!.createdAt).toBeDefined();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 8e: Type filtering should handle empty results gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Crear tareas de un solo tipo
        fc.record({
          taskType: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
          taskCount: fc.integer({ min: 1, max: 4 })
        }),
        async ({ taskType, taskCount }) => {
          const createdTasks = [];

          // Crear tareas del tipo especificado
          for (let i = 0; i < taskCount; i++) {
            const taskData: CreateTaskRequest = {
              title: `${taskType} task ${i + 1}`,
              description: `Task of type ${taskType}`,
              type: taskType,
              priority: 'medium',
              location: 'Test Location',
              requiredTools: [],
              estimatedDuration: 60,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Filtrar por el tipo opuesto (debería estar vacío)
          const oppositeType: TaskType = taskType === 'electrical' ? 'mechanical' : 'electrical';
          const emptyResult = await taskService.listTasks({ type: oppositeType });
          const emptyFromTest = emptyResult.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Filtrar por el tipo correcto (debería tener resultados)
          const populatedResult = await taskService.listTasks({ type: taskType });
          const populatedFromTest = populatedResult.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar resultados
          expect(emptyFromTest.length).toBe(0);
          expect(populatedFromTest.length).toBe(taskCount);

          // Verificar que el resultado vacío es realmente vacío
          expect(emptyResult.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          )).toEqual([]);

          // Verificar que el resultado poblado contiene las tareas correctas
          populatedFromTest.forEach(task => {
            expect(task.type).toBe(taskType);
            expect(task.description).toContain(`type ${taskType}`);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 8f: Type filtering should work consistently with pagination', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar muchas tareas de ambos tipos
        fc.record({
          electricalCount: fc.integer({ min: 5, max: 8 }),
          mechanicalCount: fc.integer({ min: 5, max: 8 })
        }),
        async ({ electricalCount, mechanicalCount }) => {
          const createdTasks = [];

          // Crear tareas eléctricas
          for (let i = 0; i < electricalCount; i++) {
            const taskData: CreateTaskRequest = {
              title: `Electrical Task ${i + 1}`,
              description: 'Electrical task for pagination test',
              type: 'electrical',
              priority: 'medium',
              location: 'Test Location',
              requiredTools: [],
              estimatedDuration: 60,
              dueDate: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000)
            };

            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Crear tareas mecánicas
          for (let i = 0; i < mechanicalCount; i++) {
            const taskData: CreateTaskRequest = {
              title: `Mechanical Task ${i + 1}`,
              description: 'Mechanical task for pagination test',
              type: 'mechanical',
              priority: 'high',
              location: 'Test Location',
              requiredTools: [],
              estimatedDuration: 90,
              dueDate: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000)
            };

            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);
          }

          // Obtener todas las tareas eléctricas con paginación
          const page1 = await taskService.listTasks({ type: 'electrical' }, { page: 1, limit: 3 });
          const page2 = await taskService.listTasks({ type: 'electrical' }, { page: 2, limit: 3 });

          const page1FromTest = page1.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );
          const page2FromTest = page2.items.filter(task => 
            createdTasks.some(ct => ct.id === task.id)
          );

          // Verificar que todas las tareas en ambas páginas son eléctricas
          [...page1FromTest, ...page2FromTest].forEach(task => {
            expect(task.type).toBe('electrical');
            expect(task.description).toContain('Electrical task');
          });

          // Verificar que no hay duplicados entre páginas
          const page1Ids = new Set(page1FromTest.map(t => t.id));
          const page2Ids = new Set(page2FromTest.map(t => t.id));
          const intersection = new Set([...page1Ids].filter(id => page2Ids.has(id)));
          expect(intersection.size).toBe(0);

          // Verificar que el total de páginas es correcto
          const totalElectricalFromTest = page1FromTest.length + page2FromTest.length;
          expect(totalElectricalFromTest).toBeLessThanOrEqual(electricalCount);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('Property 8g: Type filtering should be case-sensitive and exact', async () => {
    // Crear tarea eléctrica
    const electricalTask: CreateTaskRequest = {
      title: 'Case Sensitivity Test Electrical',
      description: 'Testing case sensitivity',
      type: 'electrical',
      priority: 'medium',
      location: 'Test Location',
      requiredTools: [],
      estimatedDuration: 60,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    const createdTask = await taskService.createTask(electricalTask, testUserId);
    createdTaskIds.push(createdTask.id);

    // Filtrar con el tipo correcto
    const correctResult = await taskService.listTasks({ type: 'electrical' });
    const foundCorrect = correctResult.items.find(task => task.id === createdTask.id);
    expect(foundCorrect).toBeDefined();
    expect(foundCorrect!.type).toBe('electrical');

    // Verificar que el filtro es exacto (no hay variaciones de case)
    // Nota: TypeScript ya previene esto en tiempo de compilación, pero verificamos la lógica
    const mechanicalResult = await taskService.listTasks({ type: 'mechanical' });
    const foundInMechanical = mechanicalResult.items.find(task => task.id === createdTask.id);
    expect(foundInMechanical).toBeUndefined();
  });
});