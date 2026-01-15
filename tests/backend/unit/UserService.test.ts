import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateUserRequest, UpdateUserRequest } from '../../../src/backend/models/User.js';
import { query } from '../../../src/backend/utils/database.js';

describe('UserService Unit Tests', () => {
  let userService: UserService;
  let createdUserIds: string[] = [];

  beforeEach(() => {
    // Configurar variables de entorno para tests
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.BCRYPT_SALT_ROUNDS = '4';
    
    userService = new UserService();
    createdUserIds = [];
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

  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      const userData: CreateUserRequest = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe(userData.email);
      expect(createdUser.name).toBe(userData.name);
      expect(createdUser.role).toBe(userData.role);
      expect(createdUser.isActive).toBe(true);
      expect(createdUser.id).toBeDefined();
      expect(createdUser.createdAt).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const userData: CreateUserRequest = {
        email: 'invalid-email',
        name: 'Test User',
        password: 'password123',
        role: 'operator'
      };

      await expect(userService.createUser(userData, 'admin-test'))
        .rejects.toThrow('Formato de email inválido');
    });

    it('should reject empty name', async () => {
      const userData: CreateUserRequest = {
        email: 'test@example.com',
        name: '',
        password: 'password123',
        role: 'operator'
      };

      await expect(userService.createUser(userData, 'admin-test'))
        .rejects.toThrow('El nombre es requerido');
    });

    it('should reject short password', async () => {
      const userData: CreateUserRequest = {
        email: 'test@example.com',
        name: 'Test User',
        password: '123',
        role: 'operator'
      };

      await expect(userService.createUser(userData, 'admin-test'))
        .rejects.toThrow('La contraseña debe tener al menos 6 caracteres');
    });

    it('should reject duplicate email', async () => {
      const userData: CreateUserRequest = {
        email: 'duplicate@example.com',
        name: 'Test User',
        password: 'password123',
        role: 'operator'
      };

      // Crear primer usuario
      const firstUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(firstUser.id);

      // Intentar crear segundo usuario con mismo email
      await expect(userService.createUser(userData, 'admin-test'))
        .rejects.toThrow('El email ya está registrado');
    });

    it('should convert email to lowercase', async () => {
      const userData: CreateUserRequest = {
        email: 'TEST@EXAMPLE.COM',
        name: 'Test User',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      expect(createdUser.email).toBe('test@example.com');
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const userData: CreateUserRequest = {
        email: 'findme@example.com',
        name: 'Find Me',
        password: 'password123',
        role: 'supervisor'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const foundUser = await userService.getUserById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.email).toBe(userData.email);
      expect(foundUser!.name).toBe(userData.name);
      expect(foundUser!.role).toBe(userData.role);
    });

    it('should return null when user not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const user = await userService.getUserById(nonExistentId);
      expect(user).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found by email', async () => {
      const userData: CreateUserRequest = {
        email: 'findbyme@example.com',
        name: 'Find By Email',
        password: 'password123',
        role: 'admin'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const foundUser = await userService.getUserByEmail(userData.email);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should return null when user not found by email', async () => {
      const user = await userService.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should find user with case-insensitive email', async () => {
      const userData: CreateUserRequest = {
        email: 'case@example.com',
        name: 'Case Test',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const foundUser = await userService.getUserByEmail('CASE@EXAMPLE.COM');
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
    });
  });

  describe('updateUser', () => {
    it('should update user name', async () => {
      const userData: CreateUserRequest = {
        email: 'update@example.com',
        name: 'Original Name',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const updateData: UpdateUserRequest = {
        name: 'Updated Name'
      };

      const updatedUser = await userService.updateUser(createdUser.id, updateData, 'admin-test');

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.email).toBe(userData.email); // No debe cambiar
      expect(updatedUser.role).toBe(userData.role); // No debe cambiar
    });

    it('should update user email', async () => {
      const userData: CreateUserRequest = {
        email: 'original@example.com',
        name: 'Test User',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const updateData: UpdateUserRequest = {
        email: 'updated@example.com'
      };

      const updatedUser = await userService.updateUser(createdUser.id, updateData, 'admin-test');

      expect(updatedUser.email).toBe('updated@example.com');
    });

    it('should update user role', async () => {
      const userData: CreateUserRequest = {
        email: 'role@example.com',
        name: 'Role Test',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const updateData: UpdateUserRequest = {
        role: 'supervisor'
      };

      const updatedUser = await userService.updateUser(createdUser.id, updateData, 'admin-test');

      expect(updatedUser.role).toBe('supervisor');
    });

    it('should reject invalid email in update', async () => {
      const userData: CreateUserRequest = {
        email: 'valid@example.com',
        name: 'Test User',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const updateData: UpdateUserRequest = {
        email: 'invalid-email'
      };

      await expect(userService.updateUser(createdUser.id, updateData, 'admin-test'))
        .rejects.toThrow('Formato de email inválido');
    });

    it('should reject duplicate email in update', async () => {
      // Crear primer usuario
      const userData1: CreateUserRequest = {
        email: 'first@example.com',
        name: 'First User',
        password: 'password123',
        role: 'operator'
      };
      const user1 = await userService.createUser(userData1, 'admin-test');
      createdUserIds.push(user1.id);

      // Crear segundo usuario
      const userData2: CreateUserRequest = {
        email: 'second@example.com',
        name: 'Second User',
        password: 'password123',
        role: 'operator'
      };
      const user2 = await userService.createUser(userData2, 'admin-test');
      createdUserIds.push(user2.id);

      // Intentar actualizar segundo usuario con email del primero
      const updateData: UpdateUserRequest = {
        email: 'first@example.com'
      };

      await expect(userService.updateUser(user2.id, updateData, 'admin-test'))
        .rejects.toThrow('El email ya está en uso por otro usuario');
    });

    it('should reject update with no fields', async () => {
      const userData: CreateUserRequest = {
        email: 'nofields@example.com',
        name: 'No Fields',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const updateData: UpdateUserRequest = {};

      await expect(userService.updateUser(createdUser.id, updateData, 'admin-test'))
        .rejects.toThrow('No hay campos para actualizar');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate active user', async () => {
      const userData: CreateUserRequest = {
        email: 'deactivate@example.com',
        name: 'Deactivate Test',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      expect(createdUser.isActive).toBe(true);

      const deactivatedUser = await userService.deactivateUser(createdUser.id, 'admin-test');

      expect(deactivatedUser.isActive).toBe(false);
      expect(deactivatedUser.id).toBe(createdUser.id);
    });

    it('should reject deactivating already inactive user', async () => {
      const userData: CreateUserRequest = {
        email: 'alreadyinactive@example.com',
        name: 'Already Inactive',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      // Primera desactivación
      await userService.deactivateUser(createdUser.id, 'admin-test');

      // Segunda desactivación debe fallar
      await expect(userService.deactivateUser(createdUser.id, 'admin-test'))
        .rejects.toThrow('El usuario ya está desactivado');
    });
  });

  describe('reactivateUser', () => {
    it('should reactivate inactive user', async () => {
      const userData: CreateUserRequest = {
        email: 'reactivate@example.com',
        name: 'Reactivate Test',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      // Desactivar primero
      await userService.deactivateUser(createdUser.id, 'admin-test');

      // Reactivar
      const reactivatedUser = await userService.reactivateUser(createdUser.id, 'admin-test');

      expect(reactivatedUser.isActive).toBe(true);
      expect(reactivatedUser.id).toBe(createdUser.id);
    });

    it('should reject reactivating already active user', async () => {
      const userData: CreateUserRequest = {
        email: 'alreadyactive@example.com',
        name: 'Already Active',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      // Intentar reactivar usuario ya activo
      await expect(userService.reactivateUser(createdUser.id, 'admin-test'))
        .rejects.toThrow('El usuario ya está activo');
    });
  });

  describe('listUsers', () => {
    it('should list users with default pagination', async () => {
      // Crear algunos usuarios de prueba
      const users = [
        { email: 'list1@example.com', name: 'List User 1', role: 'operator' as const },
        { email: 'list2@example.com', name: 'List User 2', role: 'supervisor' as const },
        { email: 'list3@example.com', name: 'List User 3', role: 'admin' as const }
      ];

      for (const userData of users) {
        const user = await userService.createUser({
          ...userData,
          password: 'password123'
        }, 'admin-test');
        createdUserIds.push(user.id);
      }

      const result = await userService.listUsers();

      expect(result.users.length).toBeGreaterThanOrEqual(3);
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter users by role', async () => {
      // Crear usuarios con diferentes roles
      const adminUser = await userService.createUser({
        email: 'filteradmin@example.com',
        name: 'Filter Admin',
        password: 'password123',
        role: 'admin'
      }, 'admin-test');
      createdUserIds.push(adminUser.id);

      const operatorUser = await userService.createUser({
        email: 'filteroperator@example.com',
        name: 'Filter Operator',
        password: 'password123',
        role: 'operator'
      }, 'admin-test');
      createdUserIds.push(operatorUser.id);

      // Filtrar solo administradores
      const adminResult = await userService.listUsers({ role: 'admin' });
      const foundAdmin = adminResult.users.find(u => u.id === adminUser.id);
      const foundOperator = adminResult.users.find(u => u.id === operatorUser.id);

      expect(foundAdmin).toBeDefined();
      expect(foundOperator).toBeUndefined();
    });

    it('should filter users by active status', async () => {
      const userData: CreateUserRequest = {
        email: 'filterstatus@example.com',
        name: 'Filter Status',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      // Desactivar usuario
      await userService.deactivateUser(createdUser.id, 'admin-test');

      // Filtrar solo usuarios activos
      const activeResult = await userService.listUsers({ isActive: true });
      const foundInActive = activeResult.users.find(u => u.id === createdUser.id);
      expect(foundInActive).toBeUndefined();

      // Filtrar solo usuarios inactivos
      const inactiveResult = await userService.listUsers({ isActive: false });
      const foundInInactive = inactiveResult.users.find(u => u.id === createdUser.id);
      expect(foundInInactive).toBeDefined();
      expect(foundInInactive!.isActive).toBe(false);
    });

    it('should search users by name and email', async () => {
      const userData: CreateUserRequest = {
        email: 'searchable@example.com',
        name: 'Searchable User',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      // Buscar por nombre
      const nameResult = await userService.listUsers({ search: 'Searchable' });
      const foundByName = nameResult.users.find(u => u.id === createdUser.id);
      expect(foundByName).toBeDefined();

      // Buscar por email
      const emailResult = await userService.listUsers({ search: 'searchable@' });
      const foundByEmail = emailResult.users.find(u => u.id === createdUser.id);
      expect(foundByEmail).toBeDefined();
    });
  });

  describe('getUserStats', () => {
    it('should return correct user statistics', async () => {
      const initialStats = await userService.getUserStats();

      // Crear usuarios de prueba
      const adminUser = await userService.createUser({
        email: 'statsadmin@example.com',
        name: 'Stats Admin',
        password: 'password123',
        role: 'admin'
      }, 'admin-test');
      createdUserIds.push(adminUser.id);

      const operatorUser = await userService.createUser({
        email: 'statsoperator@example.com',
        name: 'Stats Operator',
        password: 'password123',
        role: 'operator'
      }, 'admin-test');
      createdUserIds.push(operatorUser.id);

      // Desactivar un usuario
      await userService.deactivateUser(operatorUser.id, 'admin-test');

      const finalStats = await userService.getUserStats();

      expect(finalStats.total).toBe(initialStats.total + 2);
      expect(finalStats.active).toBe(initialStats.active + 1); // Solo admin activo
      expect(finalStats.inactive).toBe(initialStats.inactive + 1); // Operator desactivado
      expect(finalStats.byRole.admin).toBe(initialStats.byRole.admin + 1);
      expect(finalStats.byRole.operator).toBe(initialStats.byRole.operator + 1);
    });
  });

  describe('canDeleteUser', () => {
    it('should return true for user without tasks', async () => {
      const userData: CreateUserRequest = {
        email: 'deletable@example.com',
        name: 'Deletable User',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      const canDelete = await userService.canDeleteUser(createdUser.id);
      expect(canDelete).toBe(true);
    });
  });

  describe('notifyUser', () => {
    it('should send notification without throwing error', async () => {
      const userData: CreateUserRequest = {
        email: 'notify@example.com',
        name: 'Notify User',
        password: 'password123',
        role: 'operator'
      };

      const createdUser = await userService.createUser(userData, 'admin-test');
      createdUserIds.push(createdUser.id);

      // No debe lanzar error
      await expect(userService.notifyUser(createdUser.id, 'Test notification', 'info'))
        .resolves.not.toThrow();
    });
  });
});