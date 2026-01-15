import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fc } from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, TaskStatus } from '../../../src/backend/models/Task.js';
import { CreateUserRequest } from '../../../src/backend/models/User.js';
import { initializeDatabase, closeDatabase } from '../../../src/backend/utils/database.js';

describe('Task Status Updates Properties', () => {
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
  const taskStatusArb = fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled');
  
  const createTaskRequestArb = fc.record({
    title: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
    description: fc.string({ minLength: 1, maxLength: 500 }).map(s => s.trim()).filter(s => s.length > 0),
    type: fc.constantFrom('electrical', 'mechanical'),
    priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
    location: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
    requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
    estimatedDuration: fc.integer({ min: 15, max: 480 }),
    dueDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000) }) // Al menos 1 día en el futuro
  });

  it('Property 9.1: Status updates preserve task data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        taskStatusArb,
        async (taskData: CreateTaskRequest, newStatus: TaskStatus) => {
          // Crear tarea
          const task = await taskService.createTask(taskData, testUserId);
          
          // Actualizar estado
          const updatedTask = await taskService.updateTaskStatus(task.id, newStatus, testUserId);
          
          // Verificar que los datos básicos se mantienen
          expect(updatedTask.id).toBe(task.id);
          expect(updatedTask.title).toBe(task.title);
          expect(updatedTask.description).toBe(task.description);
          expect(updatedTask.type).toBe(task.type);
          expect(updatedTask.priority).toBe(task.priority);
          expect(updatedTask.createdBy).toBe(task.createdBy);
          expect(updatedTask.location).toBe(task.location);
          expect(updatedTask.estimatedDuration).toBe(task.estimatedDuration);
          
          // Verificar que el estado se actualizó
          expect(updatedTask.status).toBe(newStatus);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 9.2: Status transitions update appropriate timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        async (taskData: CreateTaskRequest) => {
          // Crear tarea (estado inicial: pending)
          const task = await taskService.createTask(taskData, testUserId);
          expect(task.status).toBe('pending');
          expect(task.startedAt).toBeUndefined();
          expect(task.completedAt).toBeUndefined();
          
          const createdTime = task.createdAt.getTime();
          
          // Cambiar a in_progress
          const inProgressTask = await taskService.updateTaskStatus(task.id, 'in_progress', testUserId);
          expect(inProgressTask.status).toBe('in_progress');
          expect(inProgressTask.startedAt).toBeDefined();
          expect(inProgressTask.startedAt!.getTime()).toBeGreaterThan(createdTime);
          expect(inProgressTask.completedAt).toBeUndefined();
          
          const startedTime = inProgressTask.startedAt!.getTime();
          
          // Cambiar a completed
          const completedTask = await taskService.updateTaskStatus(task.id, 'completed', testUserId);
          expect(completedTask.status).toBe('completed');
          expect(completedTask.startedAt).toBeDefined();
          expect(completedTask.completedAt).toBeDefined();
          expect(completedTask.completedAt!.getTime()).toBeGreaterThan(startedTime);
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 9.3: Multiple status updates maintain timestamp consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        fc.array(taskStatusArb, { minLength: 2, maxLength: 5 }),
        async (taskData: CreateTaskRequest, statusSequence: TaskStatus[]) => {
          // Crear tarea
          const task = await taskService.createTask(taskData, testUserId);
          let currentTask = task;
          let previousTimestamp = task.createdAt.getTime();
          
          for (const status of statusSequence) {
            currentTask = await taskService.updateTaskStatus(currentTask.id, status, testUserId);
            
            // Verificar que los timestamps son consistentes
            expect(currentTask.createdAt.getTime()).toBe(task.createdAt.getTime());
            
            if (status === 'in_progress' && currentTask.startedAt) {
              expect(currentTask.startedAt.getTime()).toBeGreaterThanOrEqual(previousTimestamp);
            }
            
            if (status === 'completed' && currentTask.completedAt) {
              expect(currentTask.completedAt.getTime()).toBeGreaterThanOrEqual(previousTimestamp);
              if (currentTask.startedAt) {
                expect(currentTask.completedAt.getTime()).toBeGreaterThanOrEqual(currentTask.startedAt.getTime());
              }
            }
            
            // Actualizar timestamp de referencia
            if (status === 'in_progress' && currentTask.startedAt) {
              previousTimestamp = currentTask.startedAt.getTime();
            } else if (status === 'completed' && currentTask.completedAt) {
              previousTimestamp = currentTask.completedAt.getTime();
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 9.4: Status updates are atomic operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        taskStatusArb,
        async (taskData: CreateTaskRequest, newStatus: TaskStatus) => {
          // Crear tarea
          const task = await taskService.createTask(taskData, testUserId);
          
          // Simular múltiples actualizaciones concurrentes
          const updatePromises = Array.from({ length: 3 }, (_, i) => 
            taskService.updateTaskStatus(task.id, newStatus, testUserId)
          );
          
          const results = await Promise.all(updatePromises);
          
          // Todas las actualizaciones deben resultar en el mismo estado
          results.forEach(result => {
            expect(result.status).toBe(newStatus);
            expect(result.id).toBe(task.id);
          });
          
          // Verificar que la tarea final tiene el estado correcto
          const finalTask = await taskService.getTaskById(task.id);
          expect(finalTask).toBeDefined();
          expect(finalTask!.status).toBe(newStatus);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 9.5: Invalid status transitions are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        async (taskData: CreateTaskRequest) => {
          // Crear tarea
          const task = await taskService.createTask(taskData, testUserId);
          
          // Intentar actualizar con estado inválido
          await expect(
            taskService.updateTaskStatus(task.id, 'invalid_status' as TaskStatus, testUserId)
          ).rejects.toThrow();
          
          // Verificar que la tarea no cambió
          const unchangedTask = await taskService.getTaskById(task.id);
          expect(unchangedTask).toBeDefined();
          expect(unchangedTask!.status).toBe('pending');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 9.6: Status updates on non-existent tasks fail gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        taskStatusArb,
        async (nonExistentId: string, status: TaskStatus) => {
          // Intentar actualizar tarea que no existe
          await expect(
            taskService.updateTaskStatus(nonExistentId, status, testUserId)
          ).rejects.toThrow('Tarea no encontrada');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 9.7: Status updates preserve task relationships', async () => {
    await fc.assert(
      fc.asyncProperty(
        createTaskRequestArb,
        taskStatusArb,
        async (taskData: CreateTaskRequest, newStatus: TaskStatus) => {
          // Crear tarea asignada
          const taskWithAssignee = { ...taskData, assignedTo: testAssigneeId };
          const task = await taskService.createTask(taskWithAssignee, testUserId);
          
          // Agregar nota y adjunto
          const note = await taskService.addTaskNote(
            { taskId: task.id, content: 'Test note' },
            testUserId
          );
          
          const attachment = await taskService.addTaskAttachment(
            task.id,
            'test.pdf',
            '/uploads/test.pdf',
            'application/pdf',
            testUserId
          );
          
          // Actualizar estado
          const updatedTask = await taskService.updateTaskStatus(task.id, newStatus, testUserId);
          
          // Verificar que las relaciones se mantienen
          expect(updatedTask.assignedTo).toBe(testAssigneeId);
          expect(updatedTask.notes).toHaveLength(1);
          expect(updatedTask.notes[0].id).toBe(note.id);
          expect(updatedTask.attachments).toHaveLength(1);
          expect(updatedTask.attachments[0].id).toBe(attachment.id);
        }
      ),
      { numRuns: 10 }
    );
  });
});