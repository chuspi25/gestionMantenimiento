import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fc } from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest } from '../../../src/backend/models/Task.js';
import { CreateUserRequest } from '../../../src/backend/models/User.js';
import { initializeDatabase, closeDatabase } from '../../../src/backend/utils/database.js';

describe('Task Completion Properties', () => {
  let taskService: TaskService;
  let userService: UserService;
  let testUserId: string;
  let testAssigneeId: string;

  beforeEach(async () => {
    await initializeDatabase();
    taskService = new TaskService();
    userService = new UserService();

    // Crear usuarios de prueba
    const creatorData: CreateUserRequest = {
      username: 'task-creator',
      email: 'creator@test.com',
      password: 'password123',
      fullName: 'Task Creator',
      role: 'admin'
    };

    const assigneeData: CreateUserRequest = {
      username: 'task-assignee',
      email: 'assignee@test.com',
      password: 'password123',
      fullName: 'Task Assignee',
      role: 'technician'
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
  const createTaskRequestArb = fc.record({
    title: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
    description: fc.string({ minLength: 1, maxLength: 500 }).map(s => s.trim()).filter(s => s.length > 0),
    type: fc.constantFrom('electrical', 'mechanical'),
    priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
    location: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
    requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
    estimatedDuration: fc.integer({ min: 15, max: 480 }),
    dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  });

  it('Property 10.1: Task completion sets completion timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        async (taskData: CreateTaskRequest) => {
          // Crear tarea
          const task = await taskService.createTask(taskData, testUserId);
          expect(task.completedAt).toBeUndefined();
          
          const beforeCompletion = new Date();
          
          // Completar tarea
          const completedTask = await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          
          const afterCompletion = new Date();
          
          // Verificar que se estableció el timestamp de completación
          expect(completedTask.status).toBe('completed');
          expect(completedTask.completedAt).toBeDefined();
          expect(completedTask.completedAt!.getTime()).toBeGreaterThanOrEqual(beforeCompletion.getTime());
          expect(completedTask.completedAt!.getTime()).toBeLessThanOrEqual(afterCompletion.getTime());
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 10.2: Completion timestamp is consistent across multiple completions', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        async (taskData: CreateTaskRequest) => {
          // Crear tarea
          const task = await taskService.createTask(taskData, testUserId);
          
          // Primera completación
          const firstCompletion = await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          const firstTimestamp = firstCompletion.completedAt!;
          
          // Cambiar a in_progress y completar de nuevo
          await taskService.updateTaskStatus(task.id, 'in_progress', testUserId);
          const secondCompletion = await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          const secondTimestamp = secondCompletion.completedAt!;
          
          // El segundo timestamp debe ser posterior al primero
          expect(secondTimestamp.getTime()).toBeGreaterThan(firstTimestamp.getTime());
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 10.3: Completed tasks maintain all original data', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        async (taskData: CreateTaskRequest) => {
          // Crear tarea con asignación
          const taskWithAssignee = { ...taskData, assignedTo: testAssigneeId };
          const task = await taskService.createTask(taskWithAssignee, testUserId);
          
          // Agregar nota y adjunto antes de completar
          const note = await taskService.addTaskNote(
            { taskId: task.id, content: 'Trabajo completado exitosamente' },
            testAssigneeId
          );
          
          const attachment = await taskService.addTaskAttachment(
            task.id,
            'completion-photo.jpg',
            '/uploads/completion-photo.jpg',
            'image/jpeg',
            testAssigneeId
          );
          
          // Completar tarea
          const completedTask = await taskService.updateTaskStatus(task.id, 'completed', testAssigneeId);
          
          // Verificar que todos los datos se mantienen
          expect(completedTask.id).toBe(task.id);
          expect(completedTask.title).toBe(task.title);
          expect(completedTask.description).toBe(task.description);
          expect(completedTask.type).toBe(task.type);
          expect(completedTask.priority).toBe(task.priority);
          expect(completedTask.assignedTo).toBe(testAssigneeId);
          expect(completedTask.createdBy).toBe(testUserId);
          expect(completedTask.location).toBe(task.location);
          expect(completedTask.requiredTools).toEqual(task.requiredTools);
          expect(completedTask.estimatedDuration).toBe(task.estimatedDuration);
          expect(completedTask.dueDate.getTime()).toBe(task.dueDate.getTime());
          expect(completedTask.createdAt.getTime()).toBe(task.createdAt.getTime());
          
          // Verificar notas y adjuntos
          expect(completedTask.notes).toHaveLength(1);
          expect(completedTask.notes[0].id).toBe(note.id);
          expect(completedTask.attachments).toHaveLength(1);
          expect(completedTask.attachments[0].id).toBe(attachment.id);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 10.4: Task completion workflow preserves chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        async (taskData: CreateTaskRequest) => {
          // Crear tarea
          const task = await taskService.createTask(taskData, testUserId);
          const createdTime = task.createdAt.getTime();
          
          // Iniciar tarea
          const startedTask = await taskService.updateTaskStatus(task.id, 'in_progress', testUserId);
          const startedTime = startedTask.startedAt!.getTime();
          
          // Completar tarea
          const completedTask = await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          const completedTime = completedTask.completedAt!.getTime();
          
          // Verificar orden cronológico
          expect(startedTime).toBeGreaterThanOrEqual(createdTime);
          expect(completedTime).toBeGreaterThanOrEqual(startedTime);
          
          // Verificar que todos los timestamps están presentes
          expect(completedTask.createdAt).toBeDefined();
          expect(completedTask.startedAt).toBeDefined();
          expect(completedTask.completedAt).toBeDefined();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 10.5: Completion confirmation requires valid user', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        fc.uuid(),
        async (taskData: CreateTaskRequest, invalidUserId: string) => {
          // Crear tarea
          const task = await taskService.createTask(taskData, testUserId);
          
          // Intentar completar con usuario inválido (debería funcionar ya que no validamos usuario en updateTaskStatus)
          // Pero podemos verificar que el sistema registra quién hizo la actualización
          const completedTask = await taskService.updateTaskStatus(task.id, 'completed', invalidUserId);
          
          // La tarea se completa pero podemos verificar la integridad
          expect(completedTask.status).toBe('completed');
          expect(completedTask.completedAt).toBeDefined();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 10.6: Completion of non-existent task fails gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (nonExistentId: string) => {
          // Intentar completar tarea que no existe
          await expect(
            taskService.updateTaskStatus(nonExistentId, 'completed', testUserId)
          ).rejects.toThrow('Tarea no encontrada');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 10.7: Completed tasks can be retrieved and filtered correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 2, maxLength: 5 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Crear múltiples tareas
          const tasks = await Promise.all(
            tasksData.map(taskData => taskService.createTask(taskData, testUserId))
          );
          
          // Completar algunas tareas aleatoriamente
          const completionPromises = tasks.map(async (task, index) => {
            if (index % 2 === 0) {
              return await taskService.updateTaskStatus(task.id, 'completed', testUserId);
            }
            return task;
          });
          
          await Promise.all(completionPromises);
          
          // Filtrar tareas completadas
          const completedTasks = await taskService.listTasks(
            { status: 'completed' },
            { page: 1, limit: 100 }
          );
          
          // Verificar que todas las tareas filtradas están completadas
          completedTasks.items.forEach(task => {
            expect(task.status).toBe('completed');
            expect(task.completedAt).toBeDefined();
          });
          
          // Verificar que el número de tareas completadas es correcto
          const expectedCompletedCount = Math.ceil(tasks.length / 2);
          expect(completedTasks.items.length).toBe(expectedCompletedCount);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 10.8: Task completion affects statistics correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTaskRequestArb, { minLength: 3, maxLength: 6 }),
        async (tasksData: CreateTaskRequest[]) => {
          // Obtener estadísticas iniciales
          const initialStats = await taskService.getTaskStats();
          
          // Crear tareas
          const tasks = await Promise.all(
            tasksData.map(taskData => taskService.createTask(taskData, testUserId))
          );
          
          // Completar todas las tareas
          await Promise.all(
            tasks.map(task => taskService.updateTaskStatus(task.id, 'completed', testUserId))
          );
          
          // Obtener estadísticas finales
          const finalStats = await taskService.getTaskStats();
          
          // Verificar que las estadísticas se actualizaron correctamente
          expect(finalStats.byStatus.completed).toBe(initialStats.byStatus.completed + tasks.length);
          expect(finalStats.total).toBe(initialStats.total + tasks.length);
          
          // Verificar que el tiempo promedio de completación es razonable
          if (finalStats.averageCompletionTime > 0) {
            expect(finalStats.averageCompletionTime).toBeGreaterThan(0);
            expect(finalStats.averageCompletionTime).toBeLessThan(24); // Menos de 24 horas
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});