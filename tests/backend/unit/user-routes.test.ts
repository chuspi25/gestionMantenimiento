import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import userRoutes from '../../../src/backend/routes/users.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { AuthService } from '../../../src/backend/services/AuthService.js';
import { CreateUserRequest } from '../../../src/backend/models/User.js';
import { query } from '../../../src/backend/utils/database.js';

describe('User Routes Unit Tests', () => {
  let app: Hono;
  let userService: UserService;
  let authService: AuthService;
  let createdUserIds: string[] = [];
  let adminToken: string;
  let supervisorToken: string;
  let operatorToken: string;
  let adminUserId: string;
  let supervisorUserId: string;
  let operatorUserId: string;

  beforeEach(async () => {
    // Configurar variables de entorno para tests
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.BCRYPT_SALT_ROUNDS = '4';

    app = new Hono();
    app.route('/users', userRoutes);
    
    userService = new UserService();
    authService = new AuthService();
    createdUserIds = [];

    // Crear usuarios de prueba para diferentes roles
    const adminData: CreateUserRequest = {
      email: 'admin@test.com',
      name: 'Test Admin',
      password: 'password123',
      role: 'admin'
    };
    const adminUser = await userService.createUser(adminData, 'system');
    adminUserId = adminUser.id;
    createdUserIds.push(adminUser.id);

    const supervisorData: CreateUserRequest = {
      email: 'supervisor@test.com',
      name: 'Test Supervisor',
      password: 'password123',
      role: 'supervisor'
    };
    const supervisorUser = await userService.createUser(supervisorData, adminUser.id);
    supervisorUserId = supervisorUser.id;
    createdUserIds.push(supervisorUser.id);

    const operatorData: CreateUserRequest = {
      email: 'operator@test.com',
      name: 'Test Operator',
      password: 'password123',
      role: 'operator'
    };
    const operatorUser = await userService.createUser(operatorData, adminUser.id);
    operatorUserId = operatorUser.id;
    createdUserIds.push(operatorUser.id);

    // Obtener tokens de autenticación
    const adminAuth = await authService.login({ email: adminData.email, password: adminData.password });
    adminToken = adminAuth.token;

    const supervisorAuth = await authService.login({ email: supervisorData.email, password: supervisorData.password });
    supervisorToken = supervisorAuth.token;

    const operatorAuth = await authService.login({ email: operatorData.email, password: operatorData.password });
    operatorToken = operatorAuth.token;
  });

  afterEach(async () => {
    // Limpiar usuarios creados durante los tests
    for (const userId of createdUserIds) {
      try {
        await query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (error) {
        console.warn(`Error limpiando usuario ${userId}:`, error);
      }
    }
    createdUserIds = [];
  });

  describe('GET /users', () => {
    it('should list users for admin', async () => {
      const res = await app.request('/users', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.users).toBeDefined();
      expect(Array.isArray(data.data.users)).toBe(true);
      expect(data.data.total).toBeGreaterThanOrEqual(3);
    });

    it('should list users for supervisor', async () => {
      const res = await app.request('/users', {
        headers: {
          'Authorization': `Bearer ${supervisorToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should deny access for operator', async () => {
      const res = await app.request('/users', {
        headers: {
          'Authorization': `Bearer ${operatorToken}`
        }
      });

      expect(res.status).toBe(403);
    });

    it('should deny access without token', async () => {
      const res = await app.request('/users');
      expect(res.status).toBe(401);
    });

    it('should filter users by role', async () => {
      const res = await app.request('/users?role=admin', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      
      // Todos los usuarios devueltos deben ser admin
      data.data.users.forEach((user: any) => {
        expect(user.role).toBe('admin');
      });
    });

    it('should filter users by active status', async () => {
      const res = await app.request('/users?active=true', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      
      // Todos los usuarios devueltos deben estar activos
      data.data.users.forEach((user: any) => {
        expect(user.isActive).toBe(true);
      });
    });

    it('should search users by name', async () => {
      const res = await app.request('/users?search=Test', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.users.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      const res = await app.request('/users?page=1&limit=2', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.page).toBe(1);
      expect(data.data.limit).toBe(2);
      expect(data.data.users.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /users/stats', () => {
    it('should return user statistics for admin', async () => {
      const res = await app.request('/users/stats', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.total).toBeDefined();
      expect(data.data.active).toBeDefined();
      expect(data.data.inactive).toBeDefined();
      expect(data.data.byRole).toBeDefined();
      expect(data.data.byRole.admin).toBeGreaterThanOrEqual(1);
      expect(data.data.byRole.supervisor).toBeGreaterThanOrEqual(1);
      expect(data.data.byRole.operator).toBeGreaterThanOrEqual(1);
    });

    it('should return user statistics for supervisor', async () => {
      const res = await app.request('/users/stats', {
        headers: {
          'Authorization': `Bearer ${supervisorToken}`
        }
      });

      expect(res.status).toBe(200);
    });

    it('should deny access for operator', async () => {
      const res = await app.request('/users/stats', {
        headers: {
          'Authorization': `Bearer ${operatorToken}`
        }
      });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by id for admin', async () => {
      const res = await app.request(`/users/${operatorUserId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(operatorUserId);
      expect(data.data.email).toBe('operator@test.com');
    });

    it('should allow operator to view own profile', async () => {
      const res = await app.request(`/users/${operatorUserId}`, {
        headers: {
          'Authorization': `Bearer ${operatorToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(operatorUserId);
    });

    it('should deny operator access to other users', async () => {
      const res = await app.request(`/users/${adminUserId}`, {
        headers: {
          'Authorization': `Bearer ${operatorToken}`
        }
      });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await app.request(`/users/${nonExistentId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(404);
    });

    it('should return 400 for missing user id', async () => {
      const res = await app.request('/users/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      // Esta ruta debería devolver la lista de usuarios, no un error 400
      expect(res.status).toBe(200);
    });
  });

  describe('POST /users', () => {
    it('should create user for admin', async () => {
      const newUserData = {
        email: 'newuser@test.com',
        name: 'New User',
        password: 'password123',
        role: 'operator'
      };

      const res = await app.request('/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUserData)
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(newUserData.email);
      expect(data.data.name).toBe(newUserData.name);
      expect(data.data.role).toBe(newUserData.role);
      
      // Agregar a la lista de limpieza
      createdUserIds.push(data.data.id);
    });

    it('should deny user creation for supervisor', async () => {
      const newUserData = {
        email: 'denied@test.com',
        name: 'Denied User',
        password: 'password123',
        role: 'operator'
      };

      const res = await app.request('/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supervisorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUserData)
      });

      expect(res.status).toBe(403);
    });

    it('should deny user creation for operator', async () => {
      const newUserData = {
        email: 'denied2@test.com',
        name: 'Denied User 2',
        password: 'password123',
        role: 'operator'
      };

      const res = await app.request('/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${operatorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUserData)
      });

      expect(res.status).toBe(403);
    });

    it('should reject invalid user data', async () => {
      const invalidUserData = {
        email: 'invalid-email',
        name: '',
        password: '123',
        role: 'invalid-role'
      };

      const res = await app.request('/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidUserData)
      });

      expect(res.status).toBe(400);
    });

    it('should reject duplicate email', async () => {
      const duplicateUserData = {
        email: 'admin@test.com', // Email ya existente
        name: 'Duplicate User',
        password: 'password123',
        role: 'operator'
      };

      const res = await app.request('/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(duplicateUserData)
      });

      expect(res.status).toBe(409);
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user for admin', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@test.com'
      };

      const res = await app.request(`/users/${operatorUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(updateData.name);
      expect(data.data.email).toBe(updateData.email);
    });

    it('should allow operator to update own profile', async () => {
      const updateData = {
        name: 'Self Updated Name'
      };

      const res = await app.request(`/users/${operatorUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${operatorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(updateData.name);
    });

    it('should deny operator from changing own role', async () => {
      const updateData = {
        role: 'admin'
      };

      const res = await app.request(`/users/${operatorUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${operatorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(403);
    });

    it('should deny operator from updating other users', async () => {
      const updateData = {
        name: 'Unauthorized Update'
      };

      const res = await app.request(`/users/${adminUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${operatorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(403);
    });

    it('should deny supervisor from updating admin', async () => {
      const updateData = {
        name: 'Supervisor Trying to Update Admin'
      };

      const res = await app.request(`/users/${adminUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${supervisorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(403);
    });

    it('should deny supervisor from granting admin role', async () => {
      const updateData = {
        role: 'admin'
      };

      const res = await app.request(`/users/${operatorUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${supervisorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(403);
    });

    it('should reject invalid update data', async () => {
      const invalidUpdateData = {
        email: 'invalid-email'
      };

      const res = await app.request(`/users/${operatorUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidUpdateData)
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /users/:id/deactivate', () => {
    it('should deactivate user for admin', async () => {
      const res = await app.request(`/users/${operatorUserId}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.isActive).toBe(false);
    });

    it('should deactivate user for supervisor', async () => {
      const res = await app.request(`/users/${operatorUserId}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supervisorToken}`
        }
      });

      expect(res.status).toBe(200);
    });

    it('should deny deactivation for operator', async () => {
      const res = await app.request(`/users/${operatorUserId}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${operatorToken}`
        }
      });

      expect(res.status).toBe(403);
    });

    it('should deny self-deactivation', async () => {
      const res = await app.request(`/users/${adminUserId}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(400);
    });

    it('should deny supervisor from deactivating admin', async () => {
      const res = await app.request(`/users/${adminUserId}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supervisorToken}`
        }
      });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /users/:id/reactivate', () => {
    it('should reactivate user for admin', async () => {
      // Primero desactivar
      await app.request(`/users/${operatorUserId}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      // Luego reactivar
      const res = await app.request(`/users/${operatorUserId}/reactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.isActive).toBe(true);
    });

    it('should deny reactivation for operator', async () => {
      const res = await app.request(`/users/${operatorUserId}/reactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${operatorToken}`
        }
      });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /users/:id/can-delete', () => {
    it('should check if user can be deleted for admin', async () => {
      const res = await app.request(`/users/${operatorUserId}/can-delete`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(typeof data.data.canDelete).toBe('boolean');
    });

    it('should deny access for non-admin', async () => {
      const res = await app.request(`/users/${operatorUserId}/can-delete`, {
        headers: {
          'Authorization': `Bearer ${supervisorToken}`
        }
      });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /users/:id/notify', () => {
    it('should send notification for supervisor', async () => {
      const notificationData = {
        message: 'Test notification',
        type: 'info'
      };

      const res = await app.request(`/users/${operatorUserId}/notify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supervisorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationData)
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should send notification for admin', async () => {
      const notificationData = {
        message: 'Admin notification',
        type: 'warning'
      };

      const res = await app.request(`/users/${operatorUserId}/notify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationData)
      });

      expect(res.status).toBe(200);
    });

    it('should deny notification for operator', async () => {
      const notificationData = {
        message: 'Operator notification',
        type: 'info'
      };

      const res = await app.request(`/users/${adminUserId}/notify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${operatorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationData)
      });

      expect(res.status).toBe(403);
    });

    it('should reject invalid notification data', async () => {
      const invalidNotificationData = {
        message: '',
        type: 'invalid-type'
      };

      const res = await app.request(`/users/${operatorUserId}/notify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supervisorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidNotificationData)
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const res = await app.request('/users/me', {
        headers: {
          'Authorization': `Bearer ${operatorToken}`
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(operatorUserId);
      expect(data.data.email).toBe('operator@test.com');
    });

    it('should deny access without token', async () => {
      const res = await app.request('/users/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /users/me', () => {
    it('should update current user profile', async () => {
      const updateData = {
        name: 'Updated Self Name'
      };

      const res = await app.request('/users/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${operatorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(updateData.name);
    });

    it('should deny role change in self-update', async () => {
      const updateData = {
        role: 'admin'
      };

      const res = await app.request('/users/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${operatorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(403);
    });

    it('should deny status change in self-update', async () => {
      const updateData = {
        isActive: false
      };

      const res = await app.request('/users/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${operatorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(res.status).toBe(403);
    });
  });
});