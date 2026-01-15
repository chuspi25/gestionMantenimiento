import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import taskRoutes from '../../../src/backend/routes/tasks.js';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { AuthService } from '../../../src/backend/services/AuthService.js';
import { CreateUserRequest } from '../../../src/backend/models/User.js';
import { CreateTaskRequest } from '../../../src/backend/models/Task.js';
import { initializeDatabase, closeDatabase } from '../../../src/backend/utils/database.js';

describe('Task Routes', () => {
  let app: Hono;
  let taskService: TaskService;
  let userService: UserService;
  let authService: AuthService;
  let adminToken: string;
  let supervisorToken: string;
  let operatorToken: string;
  let adminUserId: string;
  let supervisorUserId: string;
  let operatorUserId: string;
  let testTaskId: string;

  beforeEach(async () => {
    await initializeDatabase();
    
    app = new Hono();
    app.route('/api/tasks', taskRoutes);
    
    taskService = new TaskService();
    userService = new UserService();
    authService = new AuthService();

    // Crear usuarios de prueba
    const adminData: CreateUserRequest = {
      username: 'admin-test',
      email: 'admin@test.com',
      password: 'password123',
      fullName: 'Admin Test',
      role: 'admin'
    };

    const supervisorData: CreateUserRequest = {
      username: 'supervisor-test',
      email: 'supervisor@test.com',
      password: 'password123',
      fullName: 'Supervisor Test',
      role: 'supervisor'
    };

    const operatorData: CreateUserRequest = {
      username: 'operator-test',
      email: 'operator@test.com',
      password: 'password123',
      fullName: 'Operator Test',
      role: 'operator'
    };

    const admin = await userService.createUser(adminData);
    const supervisor = await userService.createUser(supervisorData);
    const operator = await userService.createUser(operatorData);

    adminUserId = admin.id;
    supervisorUserId = supervisor.id;
    operatorUserId = operator.id;

    // Obtener tokens de autenticación
    const adminLogin = await authService.login('admin@test.com', 'password123');
    const supervisorLogin = await authService.login('supervisor@test.com', 'password123');
    const operatorLogin = await authService.login('operator@test.com', 'password123');

    adminToken = adminLogin.token;
    supervisorToken = supervisorLogin.token;
    operatorToken = operatorLogin.token;

    // Crear tarea de prueba
    const taskData: CreateTaskRequest = {
      title: 'Tarea de Prueba',
      description: 'Descripción de prueba',
      type: 'electrical',
      priority: 'medium',
      assignedTo: operatorUserId,
      location: 'Sala de Máquinas',
      requiredTools: ['Multímetro', 'Destornilladores'],
      estimatedDuration: 120,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    };

    const task = await taskService.createTask(taskData, supervisorUserId);
    testTaskId = task.id;
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('GET /api/tasks', () => {
    it('should list tasks for admin', async () => {
      const res = await app.request('/api/tasks', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.total).toBeGreaterThan(0);
    });

    it('should list only assigned tasks for operator', async () => {
      const res = await app.request('/api/tasks', {
        headers: { Authorization: `Bearer ${operatorToken}` }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.items).toBeInstanceOf(Array);
      
      // Verificar que todas las tareas están asignadas al operador
      data.data.items.forEach((task: any) => {
        expect(task.assignedTo).toBe(operatorUserId);
      });
    });

    it('should filter tasks by status', async () => {
      const res = await app.request('/api/tasks?status=pending', {
        headers: { Authorization: `Bearer ${supervisorToken}` }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      
      data.data.items.forEach((task: any) => {
        expect(task.status).toBe('pending');
      });
    });

    it('should paginate results', async () => {
      const res = await app.request('/api/tasks?page=1&limit=5', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.page).toBe(1);
      expect(data.data.limit).toBe(5);
      expect(data.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should require authentication', async () => {
      const res = await app.request('/api/tasks');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tasks/stats', () => {
    it('should return task statistics for supervisor', async () => {
      const res = await app.request('/api/tasks/stats', {
        headers: { Authorization: `Bearer ${supervisorToken}` }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('total');
      expect(data.data).toHaveProperty('byStatus');
      expect(data.data).toHaveProperty('byType');
      expect(data.data).toHaveProperty('byPriority');
    });

    it('should deny access to operators', async () => {
      const res = await app.request('/api/tasks/stats', {
        headers: { Authorization: `Bearer ${operatorToken}` }
      });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/tasks/my', () => {
    it('should return tasks assigned to current user', async () => {
      const res = await app.request('/api/tasks/my', {
        headers: { Authorization: `Bearer ${operatorToken}` }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
      
      data.data.forEach((task: any) => {
        expect(task.assignedTo).toBe(operatorUserId);
      });
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return task details for admin', async () => {
      const res = await app.request(`/api/tasks/${testTaskId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testTaskId);
      expect(data.data.title).toBe('Tarea de Prueba');
    });

    it('should allow operator to view assigned task', async () => {
      const res = await app.request(`/api/tasks/${testTaskId}`, {
        headers: { Authorization: `Bearer ${operatorToken}` }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testTaskId);
    });

    it('should return 404 for non-existent task', async () => {
      const res = await app.request('/api/tasks/non-existent-id', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create task as supervisor', async () => {
      const taskData = {
        title: 'Nueva Tarea',
        description: 'Descripción de nueva tarea',
        type: 'mechanical',
        priority: 'high',
        assignedTo: operatorUserId,
        location: 'Taller',
        requiredTools: ['Llaves', 'Martillo'],
        estimatedDuration: 90,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      };

      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisorToken}`
        },
        body: JSON.stringify(taskData)
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Nueva Tarea');
      expect(data.data.type).toBe('mechanical');
    });

    it('should deny task creation to operators', async () => {
      const taskData = {
        title: 'Tarea No Permitida',
        description: 'Esta tarea no debería crearse',
        type: 'electrical',
        priority: 'low',
        location: 'Oficina',
        requiredTools: [],
        estimatedDuration: 60,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify(taskData)
      });

      expect(res.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const invalidTaskData = {
        title: '',
        description: 'Sin título'
      };

      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisorToken}`
        },
        body: JSON.stringify(invalidTaskData)
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update task as supervisor', async () => {
      const updateData = {
        title: 'Tarea Actualizada',
        priority: 'urgent'
      };

      const res = await app.request(`/api/tasks/${testTaskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisorToken}`
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Tarea Actualizada');
      expect(data.data.priority).toBe('urgent');
    });

    it('should allow operator to update assigned task status', async () => {
      const updateData = {
        status: 'in_progress',
        description: 'Trabajo iniciado'
      };

      const res = await app.request(`/api/tasks/${testTaskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('in_progress');
    });

    it('should prevent operator from changing assignment', async () => {
      const updateData = {
        assignedTo: adminUserId
      };

      const res = await app.request(`/api/tasks/${testTaskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/tasks/:id/status', () => {
    it('should update task status', async () => {
      const res = await app.request(`/api/tasks/${testTaskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify({ status: 'completed' })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('completed');
      expect(data.data.completedAt).toBeDefined();
    });

    it('should validate status value', async () => {
      const res = await app.request(`/api/tasks/${testTaskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify({ status: 'invalid_status' })
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id/assign', () => {
    it('should assign task as supervisor', async () => {
      const res = await app.request(`/api/tasks/${testTaskId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisorToken}`
        },
        body: JSON.stringify({ assignedTo: adminUserId })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.assignedTo).toBe(adminUserId);
    });

    it('should deny assignment to operators', async () => {
      const res = await app.request(`/api/tasks/${testTaskId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify({ assignedTo: adminUserId })
      });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/tasks/:id/notes', () => {
    it('should add note to task', async () => {
      const noteData = {
        content: 'Esta es una nota de prueba'
      };

      const res = await app.request(`/api/tasks/${testTaskId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify(noteData)
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.content).toBe('Esta es una nota de prueba');
      expect(data.data.taskId).toBe(testTaskId);
    });

    it('should validate note content', async () => {
      const noteData = {
        content: ''
      };

      const res = await app.request(`/api/tasks/${testTaskId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify(noteData)
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/tasks/:id/attachments', () => {
    it('should add attachment to task', async () => {
      const attachmentData = {
        fileName: 'photo.jpg',
        fileUrl: '/uploads/photo.jpg',
        fileType: 'image/jpeg'
      };

      const res = await app.request(`/api/tasks/${testTaskId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify(attachmentData)
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.fileName).toBe('photo.jpg');
      expect(data.data.taskId).toBe(testTaskId);
    });

    it('should validate attachment data', async () => {
      const attachmentData = {
        fileName: '',
        fileUrl: '/uploads/file.pdf'
      };

      const res = await app.request(`/api/tasks/${testTaskId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`
        },
        body: JSON.stringify(attachmentData)
      });

      expect(res.status).toBe(400);
    });
  });
});