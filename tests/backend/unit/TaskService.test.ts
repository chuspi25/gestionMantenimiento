import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, CreateTaskNoteRequest } from '../../../src/backend/models/Task.js';
import { CreateUserRequest } from '../../../src/backend/models/User.js';
import { initializeDatabase, closeDatabase } from '../../../src/backend/utils/database.js';

describe('TaskService', () => {
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

  describe('createTask', () => {
    it('should create a new task successfully', async () => {
      const taskData: CreateTaskRequest = {
        title: 'Reparar Motor',
        description: 'Motor principal necesita mantenimiento',
        type: 'mechanical',
        priority: 'high',
        assignedTo: testAssigneeId,
        location: 'Sala de Máquinas A',
        requiredTools: ['Llaves', 'Lubricante'],
        estimatedDuration: 180,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      const task = await taskService.createTask(taskData, testUserId);

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Reparar Motor');
      expect(task.description).toBe('Motor principal necesita mantenimiento');
      expect(task.type).toBe('mechanical');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('pending');
      expect(task.assignedTo).toBe(testAssigneeId);
      expect(task.createdBy).toBe(testUserId);
      expect(task.location).toBe('Sala de Máquinas A');
      expect(task.requiredTools).toEqual(['Llaves', 'Lubricante']);
      expect(task.estimatedDuration).toBe(180);
      expect(task.createdAt).toBeDefined();
      expect(task.startedAt).toBeUndefined();
      expect(task.completedAt).toBeUndefined();
      expect(task.notes).toEqual([]);
      expect(task.attachments).toEqual([]);
    });

    it('should create task without assignment', async () => {
      const taskData: CreateTaskRequest = {
        title: 'Inspección General',
        description: 'Inspección rutinaria de equipos',
        type: 'electrical',
        priority: 'low',
        location: 'Planta Baja',
        requiredTools: ['Multímetro'],
        estimatedDuration: 60,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      };

      const task = await taskService.createTask(taskData, testUserId);

      expect(task.assignedTo).toBeUndefined();
      expect(task.status).toBe('pending');
    });

    it('should reject task with invalid assignee', async () => {
      const taskData: CreateTaskRequest = {
        title: 'Tarea Inválida',
        description: 'Esta tarea no debería crearse',
        type: 'electrical',
        priority: 'medium',
        assignedTo: 'invalid-user-id',
        location: 'Oficina',
        requiredTools: [],
        estimatedDuration: 30,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await expect(
        taskService.createTask(taskData, testUserId)
      ).rejects.toThrow('El usuario asignado no existe o está inactivo');
    });

    it('should reject task with past due date', async () => {
      const taskData: CreateTaskRequest = {
        title: 'Tarea Vencida',
        description: 'Esta tarea tiene fecha pasada',
        type: 'mechanical',
        priority: 'urgent',
        location: 'Taller',
        requiredTools: [],
        estimatedDuration: 120,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Ayer
      };

      await expect(
        taskService.createTask(taskData, testUserId)
      ).rejects.toThrow('La fecha de vencimiento no puede ser en el pasado');
    });
  });

  describe('getTaskById', () => {
    it('should retrieve task by ID', async () => {
      const taskData: CreateTaskRequest = {
        title: 'Tarea de Prueba',
        description: 'Descripción de prueba',
        type: 'electrical',
        priority: 'medium',
        location: 'Laboratorio',
        requiredTools: ['Osciloscopio'],
        estimatedDuration: 90,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      };

      const createdTask = await taskService.createTask(taskData, testUserId);
      const retrievedTask = await taskService.getTaskById(createdTask.id);

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask!.id).toBe(createdTask.id);
      expect(retrievedTask!.title).toBe('Tarea de Prueba');
    });

    it('should return null for non-existent task', async () => {
      const task = await taskService.getTaskById('non-existent-id');
      expect(task).toBeNull();
    });
  });

  describe('listTasks', () => {
    beforeEach(async () => {
      // Crear varias tareas para pruebas de listado
      const tasks = [
        {
          title: 'Tarea Eléctrica 1',
          description: 'Primera tarea eléctrica',
          type: 'electrical' as const,
          priority: 'high' as const,
          assignedTo: testAssigneeId,
          location: 'Sector A',
          requiredTools: ['Multímetro'],
          estimatedDuration: 60,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        {
          title: 'Tarea Mecánica 1',
          description: 'Primera tarea mecánica',
          type: 'mechanical' as const,
          priority: 'medium' as const,
          location: 'Sector B',
          requiredTools: ['Llaves'],
          estimatedDuration: 120,
          dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
        },
        {
          title: 'Tarea Urgente',
          description: 'Tarea de alta prioridad',
          type: 'electrical' as const,
          priority: 'urgent' as const,
          assignedTo: testAssigneeId,
          location: 'Sector C',
          requiredTools: [],
          estimatedDuration: 30,
          dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000)
        }
      ];

      for (const taskData of tasks) {
        await taskService.createTask(taskData, testUserId);
      }
    });

    it('should list all tasks with pagination', async () => {
      const result = await taskService.listTasks({}, { page: 1, limit: 10 });

      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBeGreaterThan(0);
    });

    it('should filter tasks by type', async () => {
      const result = await taskService.listTasks(
        { type: 'electrical' },
        { page: 1, limit: 10 }
      );

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach(task => {
        expect(task.type).toBe('electrical');
      });
    });

    it('should filter tasks by status', async () => {
      const result = await taskService.listTasks(
        { status: 'pending' },
        { page: 1, limit: 10 }
      );

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach(task => {
        expect(task.status).toBe('pending');
      });
    });

    it('should filter tasks by assigned user', async () => {
      const result = await taskService.listTasks(
        { assignedTo: testAssigneeId },
        { page: 1, limit: 10 }
      );

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach(task => {
        expect(task.assignedTo).toBe(testAssigneeId);
      });
    });

    it('should sort tasks by priority', async () => {
      const result = await taskService.listTasks(
        {},
        { page: 1, limit: 10, sortBy: 'priority', sortOrder: 'desc' }
      );

      expect(result.items.length).toBeGreaterThan(0);
      
      // Verificar que las tareas urgentes aparecen primero
      const urgentTasks = result.items.filter(task => task.priority === 'urgent');
      if (urgentTasks.length > 0) {
        expect(result.items[0].priority).toBe('urgent');
      }
    });
  });

  describe('updateTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const taskData: CreateTaskRequest = {
        title: 'Tarea Original',
        description: 'Descripción original',
        type: 'electrical',
        priority: 'low',
        assignedTo: testAssigneeId,
        location: 'Ubicación Original',
        requiredTools: ['Herramienta 1'],
        estimatedDuration: 60,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const task = await taskService.createTask(taskData, testUserId);
      taskId = task.id;
    });

    it('should update task fields', async () => {
      const updateData = {
        title: 'Tarea Actualizada',
        priority: 'high' as const,
        estimatedDuration: 120
      };

      const updatedTask = await taskService.updateTask(taskId, updateData, testUserId);

      expect(updatedTask.title).toBe('Tarea Actualizada');
      expect(updatedTask.priority).toBe('high');
      expect(updatedTask.estimatedDuration).toBe(120);
      expect(updatedTask.description).toBe('Descripción original'); // No cambiado
    });

    it('should update task status with timestamps', async () => {
      // Cambiar a in_progress
      const inProgressTask = await taskService.updateTask(
        taskId,
        { status: 'in_progress' },
        testUserId
      );

      expect(inProgressTask.status).toBe('in_progress');
      expect(inProgressTask.startedAt).toBeDefined();
      expect(inProgressTask.completedAt).toBeUndefined();

      // Cambiar a completed
      const completedTask = await taskService.updateTask(
        taskId,
        { status: 'completed' },
        testUserId
      );

      expect(completedTask.status).toBe('completed');
      expect(completedTask.startedAt).toBeDefined();
      expect(completedTask.completedAt).toBeDefined();
      expect(completedTask.completedAt!.getTime()).toBeGreaterThan(
        completedTask.startedAt!.getTime()
      );
    });

    it('should reject update of non-existent task', async () => {
      await expect(
        taskService.updateTask('non-existent-id', { title: 'New Title' }, testUserId)
      ).rejects.toThrow('Tarea no encontrada');
    });

    it('should validate updated fields', async () => {
      await expect(
        taskService.updateTask(taskId, { title: '' }, testUserId)
      ).rejects.toThrow('El título no puede estar vacío');

      await expect(
        taskService.updateTask(taskId, { estimatedDuration: -10 }, testUserId)
      ).rejects.toThrow('La duración estimada debe ser mayor a 0');
    });
  });

  describe('assignTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const taskData: CreateTaskRequest = {
        title: 'Tarea Sin Asignar',
        description: 'Esta tarea será asignada',
        type: 'mechanical',
        priority: 'medium',
        location: 'Taller',
        requiredTools: [],
        estimatedDuration: 90,
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };

      const task = await taskService.createTask(taskData, testUserId);
      taskId = task.id;
    });

    it('should assign task to user', async () => {
      const assignedTask = await taskService.assignTask(taskId, testAssigneeId, testUserId);

      expect(assignedTask.assignedTo).toBe(testAssigneeId);
    });

    it('should reject assignment to invalid user', async () => {
      await expect(
        taskService.assignTask(taskId, 'invalid-user-id', testUserId)
      ).rejects.toThrow('El usuario asignado no existe o está inactivo');
    });
  });

  describe('addTaskNote', () => {
    let taskId: string;

    beforeEach(async () => {
      const taskData: CreateTaskRequest = {
        title: 'Tarea con Notas',
        description: 'Esta tarea tendrá notas',
        type: 'electrical',
        priority: 'medium',
        location: 'Laboratorio',
        requiredTools: [],
        estimatedDuration: 60,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const task = await taskService.createTask(taskData, testUserId);
      taskId = task.id;
    });

    it('should add note to task', async () => {
      const noteData: CreateTaskNoteRequest = {
        taskId,
        content: 'Esta es una nota de prueba'
      };

      const note = await taskService.addTaskNote(noteData, testUserId);

      expect(note.id).toBeDefined();
      expect(note.taskId).toBe(taskId);
      expect(note.userId).toBe(testUserId);
      expect(note.content).toBe('Esta es una nota de prueba');
      expect(note.createdAt).toBeDefined();
    });

    it('should reject note for non-existent task', async () => {
      const noteData: CreateTaskNoteRequest = {
        taskId: 'non-existent-id',
        content: 'Nota para tarea inexistente'
      };

      await expect(
        taskService.addTaskNote(noteData, testUserId)
      ).rejects.toThrow('Tarea no encontrada');
    });
  });

  describe('addTaskAttachment', () => {
    let taskId: string;

    beforeEach(async () => {
      const taskData: CreateTaskRequest = {
        title: 'Tarea con Adjuntos',
        description: 'Esta tarea tendrá archivos adjuntos',
        type: 'mechanical',
        priority: 'high',
        location: 'Taller',
        requiredTools: [],
        estimatedDuration: 120,
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };

      const task = await taskService.createTask(taskData, testUserId);
      taskId = task.id;
    });

    it('should add attachment to task', async () => {
      const attachment = await taskService.addTaskAttachment(
        taskId,
        'manual.pdf',
        '/uploads/manual.pdf',
        'application/pdf',
        testUserId
      );

      expect(attachment.id).toBeDefined();
      expect(attachment.taskId).toBe(taskId);
      expect(attachment.fileName).toBe('manual.pdf');
      expect(attachment.fileUrl).toBe('/uploads/manual.pdf');
      expect(attachment.fileType).toBe('application/pdf');
      expect(attachment.uploadedBy).toBe(testUserId);
      expect(attachment.uploadedAt).toBeDefined();
    });

    it('should reject attachment for non-existent task', async () => {
      await expect(
        taskService.addTaskAttachment(
          'non-existent-id',
          'file.jpg',
          '/uploads/file.jpg',
          'image/jpeg',
          testUserId
        )
      ).rejects.toThrow('Tarea no encontrada');
    });
  });

  describe('getTaskStats', () => {
    beforeEach(async () => {
      // Crear tareas con diferentes estados y tipos para estadísticas
      const tasks = [
        {
          title: 'Tarea Completada 1',
          type: 'electrical' as const,
          priority: 'high' as const,
          status: 'completed' as const
        },
        {
          title: 'Tarea Completada 2',
          type: 'mechanical' as const,
          priority: 'medium' as const,
          status: 'completed' as const
        },
        {
          title: 'Tarea En Progreso',
          type: 'electrical' as const,
          priority: 'urgent' as const,
          status: 'in_progress' as const
        },
        {
          title: 'Tarea Pendiente',
          type: 'mechanical' as const,
          priority: 'low' as const,
          status: 'pending' as const
        }
      ];

      for (const taskData of tasks) {
        const fullTaskData: CreateTaskRequest = {
          ...taskData,
          description: `Descripción de ${taskData.title}`,
          location: 'Ubicación de prueba',
          requiredTools: [],
          estimatedDuration: 60,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };

        const task = await taskService.createTask(fullTaskData, testUserId);
        
        if (taskData.status !== 'pending') {
          await taskService.updateTaskStatus(task.id, taskData.status, testUserId);
        }
      }
    });

    it('should return comprehensive task statistics', async () => {
      const stats = await taskService.getTaskStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byStatus).toHaveProperty('pending');
      expect(stats.byStatus).toHaveProperty('in_progress');
      expect(stats.byStatus).toHaveProperty('completed');
      expect(stats.byStatus).toHaveProperty('cancelled');
      expect(stats.byType).toHaveProperty('electrical');
      expect(stats.byType).toHaveProperty('mechanical');
      expect(stats.byPriority).toHaveProperty('low');
      expect(stats.byPriority).toHaveProperty('medium');
      expect(stats.byPriority).toHaveProperty('high');
      expect(stats.byPriority).toHaveProperty('urgent');
      expect(typeof stats.overdue).toBe('number');
      expect(typeof stats.completedThisWeek).toBe('number');
      expect(typeof stats.averageCompletionTime).toBe('number');
    });
  });

  describe('getTasksByUser', () => {
    beforeEach(async () => {
      // Crear tareas asignadas a diferentes usuarios
      const taskData1: CreateTaskRequest = {
        title: 'Tarea del Assignee',
        description: 'Tarea asignada al assignee',
        type: 'electrical',
        priority: 'medium',
        assignedTo: testAssigneeId,
        location: 'Sector A',
        requiredTools: [],
        estimatedDuration: 60,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const taskData2: CreateTaskRequest = {
        title: 'Tarea del Creator',
        description: 'Tarea asignada al creator',
        type: 'mechanical',
        priority: 'high',
        assignedTo: testUserId,
        location: 'Sector B',
        requiredTools: [],
        estimatedDuration: 90,
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };

      await taskService.createTask(taskData1, testUserId);
      await taskService.createTask(taskData2, testUserId);
    });

    it('should return tasks assigned to specific user', async () => {
      const userTasks = await taskService.getTasksByUser(testAssigneeId);

      expect(userTasks.length).toBeGreaterThan(0);
      userTasks.forEach(task => {
        expect(task.assignedTo).toBe(testAssigneeId);
      });
    });

    it('should return empty array for user with no tasks', async () => {
      // Crear un nuevo usuario sin tareas
      const newUserData: CreateUserRequest = {
        username: 'no-tasks-user',
        email: 'notasks@test.com',
        password: 'password123',
        fullName: 'No Tasks User',
        role: 'operator'
      };

      const newUser = await userService.createUser(newUserData);
      const userTasks = await taskService.getTasksByUser(newUser.id);

      expect(userTasks).toEqual([]);
    });
  });
});