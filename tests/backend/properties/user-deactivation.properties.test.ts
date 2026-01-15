import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { UserService } from '../../../src/backend/services/UserService.js';
import { AuthService } from '../../../src/backend/services/AuthService.js';
import { CreateUserRequest, User } from '../../../src/backend/models/User.js';
import { query } from '../../../src/backend/utils/database.js';

describe('User Deactivation Properties Tests', () => {
  let userService: UserService;
  let authService: AuthService;
  let createdUserIds: string[] = [];

  beforeEach(() => {
    // Configurar variables de entorno para tests
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.BCRYPT_SALT_ROUNDS = '4';
    
    userService = new UserService();
    authService = new AuthService();
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

  /**
   * **Feature: maintenance-app, Property 3: User deactivation preserves data integrity**
   * For any user deactivation operation, the system should preserve all user data
   * while preventing authentication and access to system resources
   * **Validates: Requirements 1.3**
   */
  it('Property 3a: User deactivation should preserve all user data', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generador para datos de usuario válidos
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
          password: fc.string({ minLength: 6, maxLength: 20 }),
          role: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        async (userData: CreateUserRequest) => {
          // Crear usuario
          const createdUser = await userService.createUser(userData, 'test-admin');
          createdUserIds.push(createdUser.id);

          // Obtener datos originales del usuario
          const originalUser = await userService.getUserById(createdUser.id);
          expect(originalUser).not.toBeNull();

          // Desactivar usuario
          const deactivatedUser = await userService.deactivateUser(createdUser.id, 'test-admin');

          // Verificar que los datos se preservan
          expect(deactivatedUser.id).toBe(originalUser!.id);
          expect(deactivatedUser.email).toBe(originalUser!.email);
          expect(deactivatedUser.name).toBe(originalUser!.name);
          expect(deactivatedUser.role).toBe(originalUser!.role);
          expect(deactivatedUser.createdAt).toEqual(originalUser!.createdAt);
          
          // Verificar que solo el estado activo cambió
          expect(deactivatedUser.isActive).toBe(false);
          expect(originalUser!.isActive).toBe(true);

          // Verificar que el usuario aún existe en la base de datos
          const userAfterDeactivation = await userService.getUserById(createdUser.id);
          expect(userAfterDeactivation).not.toBeNull();
          expect(userAfterDeactivation!.isActive).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  it('Property 3b: Deactivated users should not be able to authenticate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
          password: fc.string({ minLength: 6, maxLength: 20 }),
          role: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        async (userData: CreateUserRequest) => {
          // Crear usuario
          const createdUser = await userService.createUser(userData, 'test-admin');
          createdUserIds.push(createdUser.id);

          // Verificar que el usuario puede autenticarse inicialmente
          const loginResult = await authService.login({
            email: userData.email,
            password: userData.password
          });
          expect(loginResult.user.id).toBe(createdUser.id);

          // Desactivar usuario
          await userService.deactivateUser(createdUser.id, 'test-admin');

          // Verificar que el usuario desactivado no puede autenticarse
          await expect(authService.login({
            email: userData.email,
            password: userData.password
          })).rejects.toThrow('Cuenta desactivada');
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);

  it('Property 3c: User deactivation should be idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
          password: fc.string({ minLength: 6, maxLength: 20 }),
          role: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        async (userData: CreateUserRequest) => {
          // Crear usuario
          const createdUser = await userService.createUser(userData, 'test-admin');
          createdUserIds.push(createdUser.id);

          // Primera desactivación
          const firstDeactivation = await userService.deactivateUser(createdUser.id, 'test-admin');
          expect(firstDeactivation.isActive).toBe(false);

          // Segunda desactivación debe fallar con mensaje apropiado
          await expect(userService.deactivateUser(createdUser.id, 'test-admin'))
            .rejects.toThrow('El usuario ya está desactivado');

          // Verificar que el estado no cambió
          const userAfterSecondAttempt = await userService.getUserById(createdUser.id);
          expect(userAfterSecondAttempt!.isActive).toBe(false);
        }
      ),
      { numRuns: 8 }
    );
  }, 25000);

  it('Property 3d: User reactivation should restore access', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
          password: fc.string({ minLength: 6, maxLength: 20 }),
          role: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        async (userData: CreateUserRequest) => {
          // Crear usuario
          const createdUser = await userService.createUser(userData, 'test-admin');
          createdUserIds.push(createdUser.id);

          // Desactivar usuario
          const deactivatedUser = await userService.deactivateUser(createdUser.id, 'test-admin');
          expect(deactivatedUser.isActive).toBe(false);

          // Reactivar usuario
          const reactivatedUser = await userService.reactivateUser(createdUser.id, 'test-admin');
          expect(reactivatedUser.isActive).toBe(true);

          // Verificar que todos los datos se preservaron
          expect(reactivatedUser.id).toBe(createdUser.id);
          expect(reactivatedUser.email).toBe(createdUser.email);
          expect(reactivatedUser.name).toBe(createdUser.name);
          expect(reactivatedUser.role).toBe(createdUser.role);

          // Verificar que el usuario puede autenticarse nuevamente
          const loginResult = await authService.login({
            email: userData.email,
            password: userData.password
          });
          expect(loginResult.user.id).toBe(createdUser.id);
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);

  it('Property 3e: Deactivation should not affect user relationships', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
          password: fc.string({ minLength: 6, maxLength: 20 }),
          role: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        async (userData: CreateUserRequest) => {
          // Crear usuario
          const createdUser = await userService.createUser(userData, 'test-admin');
          createdUserIds.push(createdUser.id);

          // Obtener datos del usuario antes de desactivar
          const userBefore = await userService.getUserById(createdUser.id);
          
          // Desactivar usuario
          await userService.deactivateUser(createdUser.id, 'test-admin');

          // Verificar que el usuario aún puede ser encontrado por ID
          const userAfter = await userService.getUserById(createdUser.id);
          expect(userAfter).not.toBeNull();
          expect(userAfter!.id).toBe(userBefore!.id);

          // Verificar que el usuario aún puede ser encontrado por email
          const userByEmail = await userService.getUserByEmail(userData.email);
          expect(userByEmail).not.toBeNull();
          expect(userByEmail!.id).toBe(createdUser.id);
          expect(userByEmail!.isActive).toBe(false);
        }
      ),
      { numRuns: 8 }
    );
  }, 25000);

  it('Property 3f: User statistics should reflect deactivation correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
          password: fc.string({ minLength: 6, maxLength: 20 }),
          role: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        async (userData: CreateUserRequest) => {
          // Obtener estadísticas iniciales
          const statsBefore = await userService.getUserStats();

          // Crear usuario
          const createdUser = await userService.createUser(userData, 'test-admin');
          createdUserIds.push(createdUser.id);

          // Obtener estadísticas después de crear
          const statsAfterCreate = await userService.getUserStats();
          expect(statsAfterCreate.total).toBe(statsBefore.total + 1);
          expect(statsAfterCreate.active).toBe(statsBefore.active + 1);

          // Desactivar usuario
          await userService.deactivateUser(createdUser.id, 'test-admin');

          // Obtener estadísticas después de desactivar
          const statsAfterDeactivate = await userService.getUserStats();
          expect(statsAfterDeactivate.total).toBe(statsBefore.total + 1); // Total no cambia
          expect(statsAfterDeactivate.active).toBe(statsBefore.active); // Activos vuelve al original
          expect(statsAfterDeactivate.inactive).toBe(statsBefore.inactive + 1); // Inactivos aumenta
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);

  it('Property 3g: Deactivation should handle non-existent users gracefully', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        async (nonExistentUserId) => {
          // Intentar desactivar usuario que no existe
          await expect(userService.deactivateUser(nonExistentUserId, 'test-admin'))
            .rejects.toThrow('Usuario no encontrado');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 3h: User listing should include deactivated users with correct status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
          password: fc.string({ minLength: 6, maxLength: 20 }),
          role: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        async (userData: CreateUserRequest) => {
          // Crear usuario
          const createdUser = await userService.createUser(userData, 'test-admin');
          createdUserIds.push(createdUser.id);

          // Verificar que aparece en la lista de usuarios activos
          const activeUsers = await userService.listUsers({ isActive: true });
          const activeUser = activeUsers.users.find(u => u.id === createdUser.id);
          expect(activeUser).toBeDefined();
          expect(activeUser!.isActive).toBe(true);

          // Desactivar usuario
          await userService.deactivateUser(createdUser.id, 'test-admin');

          // Verificar que ya no aparece en la lista de usuarios activos
          const activeUsersAfter = await userService.listUsers({ isActive: true });
          const activeUserAfter = activeUsersAfter.users.find(u => u.id === createdUser.id);
          expect(activeUserAfter).toBeUndefined();

          // Verificar que aparece en la lista de usuarios inactivos
          const inactiveUsers = await userService.listUsers({ isActive: false });
          const inactiveUser = inactiveUsers.users.find(u => u.id === createdUser.id);
          expect(inactiveUser).toBeDefined();
          expect(inactiveUser!.isActive).toBe(false);

          // Verificar que aparece en la lista completa
          const allUsers = await userService.listUsers();
          const userInAll = allUsers.users.find(u => u.id === createdUser.id);
          expect(userInAll).toBeDefined();
          expect(userInAll!.isActive).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);
});