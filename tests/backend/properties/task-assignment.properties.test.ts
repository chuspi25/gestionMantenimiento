import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, CreateUserRequest } from '../../../src/backend/models/index.js';
import { query } from '../../../src/backend/utils/database.js';

describe('Task Assignment and Visibility Properties Tests', () => {
  let taskService: TaskService;
  let userService: UserService;
  let createdTaskIds: string[] = [];
  let createdUserIds: string[] = [];
  let adminUserId: string;
  let supervisorUserId: string;
  let operatorUserId: string;

  beforeEach(async () => {
    // Configurar variables de entorno para tests
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.BCRYPT_SALT_ROUNDS = '4';
    
    taskService = new TaskService();
    userService = new UserService();
    createdTaskIds = [];
    createdUserIds = [];

    // Crear usuarios de prueba con diferentes roles
    const adminData: CreateUserRequest = {
      email: 'admin@tasktest.com',
      name: 'Admin User',
      password: 'password123',
      role: 'admin'
    };
    const adminUser = await userService.createUser(adminData, 'system');
    adminUserId = adminUser.id;
    createdUserIds.push(adminUser.id);

    const supervisorData: CreateUserRequest = {
      email: 'supervisor@tasktest.com',
      name: 'Supervisor User',
      password: 'password123',
      role: 'supervisor'
    };
    const supervisorUser = await userService.createUser(supervisorData, adminUser.id);
    supervisorUserId = supervisorUser.id;
    createdUserIds.push(supervisorUser.id);

    const operatorData: CreateUserRequest = {
      email: 'operator@tasktest.com',
      name: 'Operator User',
      password: 'password123',
      role: 'operator'
    };
    const operatorUser = await userService.createUser(operatorData, adminUser.id);
    operatorUserId = operatorUser.id;
    createdUserIds.push(operatorUser.id);
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
   * **Feature: maintenance-app, Property 5: Task assignment and visibility**
   * For any task assignment operation, the system should correctly assign tasks to users
   * and ensure proper visibility based on user roles and assignments
   * **Validates: Requirements 2.2**
   */
  it('Property 5a: Task assignment should preserve task data and update assignment', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generador para datos de tarea
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('electrical', 'mechanical'),
          priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          location: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
          estimatedDuration: fc.integer({ min: 15, max: 240 }),
          dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
        }),
        // Generador para usuario asignado
        fc.constantFrom(operatorUserId, supervisorUserId, adminUserId),
        async (taskData: CreateTaskRequest, assignedUserId: string) => {
          // Crear tarea sin asignación inicial
          const createdTask = await taskService.createTask(taskData, adminUserId);
          createdTaskIds.push(createdTask.id);

          // Verificar que inicialmente no está asignada
          expect(createdTask.assignedTo).toBeUndefined();

          // Asignar la tarea
          const assignedTask = await taskService.assignTask(createdTask.id, assignedUserId, adminUserId);

          // Verificar que la asignación se realizó correctamente
          expect(assignedTask.assignedTo).toBe(assignedUserId);
          expect(assignedTask.id).toBe(createdTask.id);

          // Verificar que todos los demás datos se preservaron
          expect(assignedTask.title).toBe(createdTask.title);
          expect(assignedTask.description).toBe(createdTask.description);
          expect(assignedTask.type).toBe(createdTask.type);
          expect(assignedTask.priority).toBe(createdTask.priority);
          expect(assignedTask.status).toBe(createdTask.status);
          expect(assignedTask.location).toBe(createdTask.location);
          expect(assignedTask.requiredTools).toEqual(createdTask.requiredTools);
          expect(assignedTask.estimatedDuration).toBe(createdTask.estimatedDuration);
          expect(assignedTask.dueDate.getTime()).toBe(createdTask.dueDate.getTime());
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 5b: Task visibility should be consistent for assigned users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.constant('Test task for visibility'),
          type: fc.constantFrom('electrical', 'mechanical'),
          priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          location: fc.constant('Test Location'),
          requiredTools: fc.constant([]),
          estimatedDuration: fc.constant(60),
          dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
        }),
        async (taskData: CreateTaskRequest) => {
          // Crear tarea y asignar a operador
          const createdTask = await taskService.createTask(taskData, adminUserId);
          createdTaskIds.push(createdTask.id);

          const assignedTask = await taskService.assignTask(createdTask.id, operatorUserId, adminUserId);

          // Obtener tareas del usuario asignado
          const userTasks = await taskService.getTasksByUser(operatorUserId);
          const foundTask = userTasks.find(task => task.id === assignedTask.id);

          // La tarea debe aparecer en las tareas del usuario asignado
          expect(foundTask).toBeDefined();
          expect(foundTask!.assignedTo).toBe(operatorUserId);
          expect(foundTask!.title).toBe(taskData.title.trim());

          // Verificar que otros usuarios no ven la tarea en sus asignaciones
          const supervisorTasks = await taskService.getTasksByUser(supervisorUserId);
          const foundInSupervisor = supervisorTasks.find(task => task.id === assignedTask.id);
          expect(foundInSupervisor).toBeUndefined();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 5c: Task reassignment should update visibility correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.constant('Reassignment Test Task'),
          description: fc.constant('Testing task reassignment'),
          type: fc.constant('mechanical'),
          priority: fc.constant('medium'),
          location: fc.constant('Test Location'),
          requiredTools: fc.constant(['wrench', 'screwdriver']),
          estimatedDuration: fc.constant(90),
          dueDate: fc.constant(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000))
        }),
        // Secuencia de usuarios para reasignación
        fc.shuffledSubarray([operatorUserId, supervisorUserId], { minLength: 2, maxLength: 2 }),
        async (taskData: CreateTaskRequest, [firstUser, secondUser]: string[]) => {
          // Crear tarea
          const createdTask = await taskService.createTask(taskData, adminUserId);
          createdTaskIds.push(createdTask.id);

          // Asignar al primer usuario
          const firstAssignment = await taskService.assignTask(createdTask.id, firstUser, adminUserId);
          expect(firstAssignment.assignedTo).toBe(firstUser);

          // Verificar visibilidad inicial
          const firstUserTasks = await taskService.getTasksByUser(firstUser);
          expect(firstUserTasks.some(task => task.id === createdTask.id)).toBe(true);

          const secondUserTasksBefore = await taskService.getTasksByUser(secondUser);
          expect(secondUserTasksBefore.some(task => task.id === createdTask.id)).toBe(false);

          // Reasignar al segundo usuario
          const secondAssignment = await taskService.assignTask(createdTask.id, secondUser, adminUserId);
          expect(secondAssignment.assignedTo).toBe(secondUser);

          // Verificar nueva visibilidad
          const firstUserTasksAfter = await taskService.getTasksByUser(firstUser);
          expect(firstUserTasksAfter.some(task => task.id === createdTask.id)).toBe(false);

          const secondUserTasksAfter = await taskService.getTasksByUser(secondUser);
          expect(secondUserTasksAfter.some(task => task.id === createdTask.id)).toBe(true);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 5d: Task assignment should handle unassignment correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.constant('Unassignment Test Task'),
          description: fc.constant('Testing task unassignment'),
          type: fc.constant('electrical'),
          priority: fc.constant('high'),
          location: fc.constant('Test Location'),
          requiredTools: fc.constant([]),
          estimatedDuration: fc.constant(45),
          dueDate: fc.constant(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
        }),
        fc.constantFrom(operatorUserId, supervisorUserId),
        async (taskData: CreateTaskRequest, assignedUserId: string) => {
          // Crear y asignar tarea
          const createdTask = await taskService.createTask(taskData, adminUserId);
          createdTaskIds.push(createdTask.id);

          const assignedTask = await taskService.assignTask(createdTask.id, assignedUserId, adminUserId);
          expect(assignedTask.assignedTo).toBe(assignedUserId);

          // Verificar que aparece en las tareas del usuario
          const userTasksBefore = await taskService.getTasksByUser(assignedUserId);
          expect(userTasksBefore.some(task => task.id === createdTask.id)).toBe(true);

          // Desasignar tarea (asignar a null/undefined)
          const unassignedTask = await taskService.updateTask(
            createdTask.id, 
            { assignedTo: undefined }, 
            adminUserId
          );
          expect(unassignedTask.assignedTo).toBeUndefined();

          // Verificar que ya no aparece en las tareas del usuario
          const userTasksAfter = await taskService.getTasksByUser(assignedUserId);
          expect(userTasksAfter.some(task => task.id === createdTask.id)).toBe(false);

          // Verificar que la tarea aún existe
          const retrievedTask = await taskService.getTaskById(createdTask.id);
          expect(retrievedTask).toBeDefined();
          expect(retrievedTask!.assignedTo).toBeUndefined();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 5e: Task assignment should preserve creation metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('electrical', 'mechanical'),
          priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          location: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 3 }),
          estimatedDuration: fc.integer({ min: 30, max: 180 }),
          dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
        }),
        fc.constantFrom(adminUserId, supervisorUserId, operatorUserId),
        async (taskData: CreateTaskRequest, creatorUserId: string) => {
          // Crear tarea
          const createdTask = await taskService.createTask(taskData, creatorUserId);
          createdTaskIds.push(createdTask.id);

          // Asignar a diferentes usuarios
          const assignedTask1 = await taskService.assignTask(createdTask.id, operatorUserId, adminUserId);
          const assignedTask2 = await taskService.assignTask(createdTask.id, supervisorUserId, adminUserId);

          // Verificar que los metadatos de creación se preservan
          expect(assignedTask1.createdBy).toBe(creatorUserId);
          expect(assignedTask1.createdAt.getTime()).toBe(createdTask.createdAt.getTime());
          expect(assignedTask1.id).toBe(createdTask.id);

          expect(assignedTask2.createdBy).toBe(creatorUserId);
          expect(assignedTask2.createdAt.getTime()).toBe(createdTask.createdAt.getTime());
          expect(assignedTask2.id).toBe(createdTask.id);

          // Verificar que solo cambió la asignación
          expect(assignedTask2.assignedTo).toBe(supervisorUserId);
          expect(assignedTask2.assignedTo).not.toBe(assignedTask1.assignedTo);
        }
      ),
      { numRuns: 12 }
    );
  });

  it('Property 5f: Multiple tasks assigned to same user should all be visible', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar múltiples tareas
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            description: fc.constant('Multi-task test'),
            type: fc.constantFrom('electrical', 'mechanical'),
            priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
            location: fc.constant('Test Location'),
            requiredTools: fc.constant([]),
            estimatedDuration: fc.constant(60),
            dueDate: fc.constant(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
          }),
          { minLength: 2, maxLength: 5 }
        ),
        fc.constantFrom(operatorUserId, supervisorUserId),
        async (tasksData: CreateTaskRequest[], assignedUserId: string) => {
          const createdTaskIds: string[] = [];

          // Crear y asignar todas las tareas al mismo usuario
          for (const taskData of tasksData) {
            const createdTask = await taskService.createTask(taskData, adminUserId);
            createdTaskIds.push(createdTask.id);
            this.createdTaskIds.push(createdTask.id);

            await taskService.assignTask(createdTask.id, assignedUserId, adminUserId);
          }

          // Obtener todas las tareas del usuario
          const userTasks = await taskService.getTasksByUser(assignedUserId);
          const assignedTaskIds = userTasks
            .filter(task => createdTaskIds.includes(task.id))
            .map(task => task.id);

          // Verificar que todas las tareas asignadas son visibles
          expect(assignedTaskIds.length).toBe(createdTaskIds.length);
          expect(new Set(assignedTaskIds)).toEqual(new Set(createdTaskIds));

          // Verificar que todas tienen la asignación correcta
          for (const task of userTasks.filter(task => createdTaskIds.includes(task.id))) {
            expect(task.assignedTo).toBe(assignedUserId);
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 5g: Task assignment should reject invalid user IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.constant('Invalid Assignment Test'),
          description: fc.constant('Testing invalid user assignment'),
          type: fc.constant('electrical'),
          priority: fc.constant('medium'),
          location: fc.constant('Test Location'),
          requiredTools: fc.constant([]),
          estimatedDuration: fc.constant(60),
          dueDate: fc.constant(new Date(Date.now() + 24 * 60 * 60 * 1000))
        }),
        // Generar IDs de usuario inválidos
        fc.oneof(
          fc.uuid().filter(id => ![adminUserId, supervisorUserId, operatorUserId].includes(id)),
          fc.constant('invalid-user-id'),
          fc.constant('00000000-0000-0000-0000-000000000000')
        ),
        async (taskData: CreateTaskRequest, invalidUserId: string) => {
          // Crear tarea
          const createdTask = await taskService.createTask(taskData, adminUserId);
          createdTaskIds.push(createdTask.id);

          // Intentar asignar a usuario inválido debe fallar
          await expect(taskService.assignTask(createdTask.id, invalidUserId, adminUserId))
            .rejects.toThrow();

          // Verificar que la tarea no fue asignada
          const unchangedTask = await taskService.getTaskById(createdTask.id);
          expect(unchangedTask!.assignedTo).toBeUndefined();
        }
      ),
      { numRuns: 10 }
    );
  });
});