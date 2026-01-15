import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, TaskType, TaskPriority } from '../../../src/backend/models/Task.js';
import { CreateUserRequest } from '../../../src/backend/models/User.js';
import { query } from '../../../src/backend/utils/database.js';

describe('Task Creation Properties Tests', () => {
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
      email: 'tasktest@example.com',
      name: 'Task Test User',
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
   * **Feature: maintenance-app, Property 4: Task creation with unique identifiers**
   * For any valid task creation request, the system should create a task with a unique identifier
   * that can be used to retrieve the exact same task data
   * **Validates: Requirements 2.1**
   */
  it('Property 4a: Task creation should generate unique identifiers', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generador para datos de tarea válidos
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
          priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
          location: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
          estimatedDuration: fc.integer({ min: 15, max: 480 }), // 15 minutos a 8 horas
          dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) }) // Al menos 1 día en el futuro
        }),
        async (taskData: CreateTaskRequest) => {
          // Crear la tarea
          const createdTask = await taskService.createTask(taskData, testUserId);
          createdTaskIds.push(createdTask.id);

          // Verificar que se generó un ID único
          expect(createdTask.id).toBeDefined();
          expect(typeof createdTask.id).toBe('string');
          expect(createdTask.id.length).toBeGreaterThan(0);

          // Verificar que los datos coinciden
          expect(createdTask.title).toBe(taskData.title.trim());
          expect(createdTask.description).toBe(taskData.description.trim());
          expect(createdTask.type).toBe(taskData.type);
          expect(createdTask.priority).toBe(taskData.priority);
          expect(createdTask.location).toBe(taskData.location.trim());
          expect(createdTask.requiredTools).toEqual(taskData.requiredTools);
          expect(createdTask.estimatedDuration).toBe(taskData.estimatedDuration);
          expect(createdTask.dueDate.getTime()).toBe(taskData.dueDate.getTime());

          // Verificar campos automáticos
          expect(createdTask.status).toBe('pending');
          expect(createdTask.createdBy).toBe(testUserId);
          expect(createdTask.createdAt).toBeDefined();
          expect(createdTask.notes).toEqual([]);
          expect(createdTask.attachments).toEqual([]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 4b: Multiple task creation should generate different unique identifiers', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generador para múltiples tareas
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
            type: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
            priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
            location: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
            estimatedDuration: fc.integer({ min: 15, max: 240 }),
            dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (tasksData: CreateTaskRequest[]) => {
          const createdTasks = [];
          const taskIds = new Set<string>();

          // Crear todas las tareas
          for (const taskData of tasksData) {
            const createdTask = await taskService.createTask(taskData, testUserId);
            createdTasks.push(createdTask);
            createdTaskIds.push(createdTask.id);

            // Verificar que el ID es único
            expect(taskIds.has(createdTask.id)).toBe(false);
            taskIds.add(createdTask.id);
          }

          // Verificar que todos los IDs son diferentes
          expect(taskIds.size).toBe(tasksData.length);

          // Verificar que cada tarea puede ser recuperada por su ID único
          for (const createdTask of createdTasks) {
            const retrievedTask = await taskService.getTaskById(createdTask.id);
            expect(retrievedTask).toBeDefined();
            expect(retrievedTask!.id).toBe(createdTask.id);
            expect(retrievedTask!.title).toBe(createdTask.title);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 4c: Task retrieval by ID should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
          priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
          location: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
          estimatedDuration: fc.integer({ min: 15, max: 240 }),
          dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
        }),
        async (taskData: CreateTaskRequest) => {
          // Crear la tarea
          const createdTask = await taskService.createTask(taskData, testUserId);
          createdTaskIds.push(createdTask.id);

          // Recuperar la tarea múltiples veces
          const retrievedTask1 = await taskService.getTaskById(createdTask.id);
          const retrievedTask2 = await taskService.getTaskById(createdTask.id);
          const retrievedTask3 = await taskService.getTaskById(createdTask.id);

          // Todas las recuperaciones deben devolver los mismos datos
          expect(retrievedTask1).toEqual(retrievedTask2);
          expect(retrievedTask2).toEqual(retrievedTask3);
          expect(retrievedTask1).toEqual(createdTask);
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 4d: Task creation should preserve all input data accurately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('electrical', 'mechanical') as fc.Arbitrary<TaskType>,
          priority: fc.constantFrom('low', 'medium', 'high', 'urgent') as fc.Arbitrary<TaskPriority>,
          location: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
          estimatedDuration: fc.integer({ min: 15, max: 480 }),
          dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
        }),
        async (taskData: CreateTaskRequest) => {
          // Crear la tarea
          const createdTask = await taskService.createTask(taskData, testUserId);
          createdTaskIds.push(createdTask.id);

          // Recuperar la tarea de la base de datos
          const retrievedTask = await taskService.getTaskById(createdTask.id);
          expect(retrievedTask).toBeDefined();

          // Verificar que todos los datos se preservaron correctamente
          expect(retrievedTask!.title).toBe(taskData.title.trim());
          expect(retrievedTask!.description).toBe(taskData.description.trim());
          expect(retrievedTask!.type).toBe(taskData.type);
          expect(retrievedTask!.priority).toBe(taskData.priority);
          expect(retrievedTask!.location).toBe(taskData.location.trim());
          expect(retrievedTask!.requiredTools).toEqual(taskData.requiredTools);
          expect(retrievedTask!.estimatedDuration).toBe(taskData.estimatedDuration);
          expect(retrievedTask!.dueDate.getTime()).toBe(taskData.dueDate.getTime());
          expect(retrievedTask!.createdBy).toBe(testUserId);
          expect(retrievedTask!.status).toBe('pending');
        }
      ),
      { numRuns: 25 }
    );
  });

  it('Property 4e: Task creation should handle edge cases in required tools', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.constant('Test Task'),
          description: fc.constant('Test Description'),
          type: fc.constant('electrical') as fc.Arbitrary<TaskType>,
          priority: fc.constant('medium') as fc.Arbitrary<TaskPriority>,
          location: fc.constant('Test Location'),
          requiredTools: fc.oneof(
            fc.constant([]), // Array vacío
            fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 1 }), // Un solo elemento
            fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 10, maxLength: 10 }) // Muchos elementos
          ),
          estimatedDuration: fc.constant(60),
          dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
        }),
        async (taskData: CreateTaskRequest) => {
          // Crear la tarea
          const createdTask = await taskService.createTask(taskData, testUserId);
          createdTaskIds.push(createdTask.id);

          // Verificar que las herramientas requeridas se preservaron correctamente
          expect(createdTask.requiredTools).toEqual(taskData.requiredTools);
          expect(Array.isArray(createdTask.requiredTools)).toBe(true);

          // Recuperar y verificar
          const retrievedTask = await taskService.getTaskById(createdTask.id);
          expect(retrievedTask!.requiredTools).toEqual(taskData.requiredTools);
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 4f: Task creation should reject invalid future dates consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.constant('Test Task'),
          description: fc.constant('Test Description'),
          type: fc.constant('electrical') as fc.Arbitrary<TaskType>,
          priority: fc.constant('medium') as fc.Arbitrary<TaskPriority>,
          location: fc.constant('Test Location'),
          requiredTools: fc.constant([]),
          estimatedDuration: fc.constant(60),
          dueDate: fc.date({ max: new Date(Date.now() - 24 * 60 * 60 * 1000) }) // Fecha en el pasado
        }),
        async (taskData: CreateTaskRequest) => {
          // Intentar crear tarea con fecha en el pasado debe fallar
          await expect(taskService.createTask(taskData, testUserId))
            .rejects.toThrow('La fecha de vencimiento no puede ser en el pasado');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 4g: Task creation should handle whitespace trimming consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }).map(s => `  ${s}  `), // Con espacios
          description: fc.string({ minLength: 1, maxLength: 200 }).map(s => `\t${s}\n`), // Con tabs y saltos
          type: fc.constant('mechanical') as fc.Arbitrary<TaskType>,
          priority: fc.constant('high') as fc.Arbitrary<TaskPriority>,
          location: fc.string({ minLength: 1, maxLength: 50 }).map(s => ` ${s} `), // Con espacios
          requiredTools: fc.constant([]),
          estimatedDuration: fc.constant(120),
          dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
        }),
        async (taskData: CreateTaskRequest) => {
          // Crear la tarea
          const createdTask = await taskService.createTask(taskData, testUserId);
          createdTaskIds.push(createdTask.id);

          // Verificar que los espacios fueron eliminados
          expect(createdTask.title).toBe(taskData.title.trim());
          expect(createdTask.description).toBe(taskData.description.trim());
          expect(createdTask.location).toBe(taskData.location.trim());

          // Verificar que no hay espacios al inicio o final
          expect(createdTask.title.startsWith(' ')).toBe(false);
          expect(createdTask.title.endsWith(' ')).toBe(false);
          expect(createdTask.description.startsWith(' ')).toBe(false);
          expect(createdTask.description.endsWith(' ')).toBe(false);
          expect(createdTask.location.startsWith(' ')).toBe(false);
          expect(createdTask.location.endsWith(' ')).toBe(false);
        }
      ),
      { numRuns: 15 }
    );
  });
});