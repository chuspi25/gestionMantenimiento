import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateCreateUser, validateUpdateUser, type CreateUserRequest, type UpdateUserRequest } from '../../../src/backend/models/User.js';

describe('User Properties Tests', () => {
  /**
   * **Feature: maintenance-app, Property 1: User creation and validation**
   * For any user data input, creating a user should succeed only when all required fields are valid,
   * and the created user should have the specified role and be marked as active
   * **Validates: Requirements 1.1**
   */
  it('Property 1: User creation and validation', () => {
    fc.assert(
      fc.property(
        // Generador para datos válidos de usuario
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          password: fc.string({ minLength: 6, maxLength: 50 }),
          role: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        (validUserData: CreateUserRequest) => {
          // Para datos válidos, la validación debe pasar
          const isValid = validateCreateUser(validUserData);
          expect(isValid).toBe(true);
          
          // Verificar que los campos requeridos están presentes
          expect(validUserData.email).toContain('@');
          expect(validUserData.name.trim().length).toBeGreaterThan(0);
          expect(validUserData.password.length).toBeGreaterThanOrEqual(6);
          expect(['admin', 'supervisor', 'operator']).toContain(validUserData.role);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1b: Invalid user data should be rejected', () => {
    fc.assert(
      fc.property(
        // Generador para datos inválidos
        fc.oneof(
          // Email inválido
          fc.record({
            email: fc.string().filter(s => !s.includes('@')),
            name: fc.string({ minLength: 1 }),
            password: fc.string({ minLength: 6 }),
            role: fc.constantFrom('admin', 'supervisor', 'operator')
          }),
          // Nombre vacío
          fc.record({
            email: fc.emailAddress(),
            name: fc.constant(''),
            password: fc.string({ minLength: 6 }),
            role: fc.constantFrom('admin', 'supervisor', 'operator')
          }),
          // Contraseña muy corta
          fc.record({
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1 }),
            password: fc.string({ maxLength: 5 }),
            role: fc.constantFrom('admin', 'supervisor', 'operator')
          }),
          // Rol inválido
          fc.record({
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1 }),
            password: fc.string({ minLength: 6 }),
            role: fc.string().filter(s => !['admin', 'supervisor', 'operator'].includes(s))
          })
        ),
        (invalidUserData: any) => {
          // Para datos inválidos, la validación debe fallar
          const isValid = validateCreateUser(invalidUserData);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1c: Update user validation', () => {
    fc.assert(
      fc.property(
        // Generador para datos de actualización válidos (campos opcionales)
        fc.record({
          email: fc.option(fc.emailAddress(), { nil: undefined }),
          name: fc.option(fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), { nil: undefined }),
          password: fc.option(fc.string({ minLength: 6 }), { nil: undefined }),
          role: fc.option(fc.constantFrom('admin', 'supervisor', 'operator'), { nil: undefined }),
          isActive: fc.option(fc.boolean(), { nil: undefined })
        }).filter(data => Object.keys(data).some(key => data[key as keyof typeof data] !== undefined)),
        (validUpdateData: UpdateUserRequest) => {
          // Para datos de actualización válidos, la validación debe pasar
          const isValid = validateUpdateUser(validUpdateData);
          expect(isValid).toBe(true);
          
          // Verificar que si hay email, es válido
          if (validUpdateData.email) {
            expect(validUpdateData.email).toContain('@');
          }
          
          // Verificar que si hay nombre, no está vacío
          if (validUpdateData.name) {
            expect(validUpdateData.name.trim().length).toBeGreaterThan(0);
          }
          
          // Verificar que si hay contraseña, tiene longitud mínima
          if (validUpdateData.password) {
            expect(validUpdateData.password.length).toBeGreaterThanOrEqual(6);
          }
          
          // Verificar que si hay rol, es válido
          if (validUpdateData.role) {
            expect(['admin', 'supervisor', 'operator']).toContain(validUpdateData.role);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1d: Update user with invalid data should be rejected', () => {
    fc.assert(
      fc.property(
        // Generador para datos de actualización inválidos
        fc.oneof(
          // Email inválido
          fc.record({
            email: fc.string().filter(s => s.length > 0 && !s.includes('@'))
          }),
          // Nombre vacío
          fc.record({
            name: fc.constant('')
          }),
          // Contraseña muy corta
          fc.record({
            password: fc.string({ maxLength: 5 })
          }),
          // Rol inválido
          fc.record({
            role: fc.string().filter(s => !['admin', 'supervisor', 'operator'].includes(s))
          }),
          // Campo no permitido
          fc.record({
            invalidField: fc.string()
          })
        ),
        (invalidUpdateData: any) => {
          // Para datos de actualización inválidos, la validación debe fallar
          const isValid = validateUpdateUser(invalidUpdateData);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});