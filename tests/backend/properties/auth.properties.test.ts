import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  hashPassword, 
  comparePassword, 
  validatePasswordStrength,
  generateTemporaryPassword,
  isValidBcryptHash 
} from '../../../src/backend/utils/bcrypt.js';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  validateToken, 
  validateAccessToken,
  validateRefreshToken,
  extractTokenFromHeader,
  getUserFromToken,
  generateTokenPair
} from '../../../src/backend/utils/jwt.js';
import { 
  createPasswordHash, 
  verifyCredentials, 
  hasPermission,
  isValidEmail 
} from '../../../src/backend/utils/auth.js';
import { UserSession } from '../../../src/backend/models/User.js';

describe('Authentication Properties Tests', () => {
  beforeEach(() => {
    // Configurar variables de entorno para tests
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.BCRYPT_SALT_ROUNDS = '4'; // Reducir para tests más rápidos
  });

  /**
   * **Feature: maintenance-app, Property 17: Secure authentication with JWT and bcrypt**
   * For any login attempt with valid credentials, the system should authenticate using bcrypt 
   * for password verification and return a valid JWT token
   * **Validates: Requirements 7.1, 8.5**
   */
  it('Property 17: Password hashing and verification round trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generador para contraseñas válidas
        fc.string({ minLength: 6, maxLength: 20 }).filter(s => s.trim().length >= 6),
        async (password) => {
          // Hash de la contraseña
          const hashedPassword = await hashPassword(password);
          
          // Verificar que el hash es válido
          expect(isValidBcryptHash(hashedPassword)).toBe(true);
          expect(hashedPassword).not.toBe(password); // No debe ser la contraseña original
          expect(hashedPassword.length).toBeGreaterThan(50); // Los hashes bcrypt son largos
          
          // Verificar que la contraseña original coincide con el hash
          const isMatch = await comparePassword(password, hashedPassword);
          expect(isMatch).toBe(true);
          
          // Verificar que una contraseña incorrecta no coincide
          const wrongPassword = password + 'wrong';
          const isWrongMatch = await comparePassword(wrongPassword, hashedPassword);
          expect(isWrongMatch).toBe(false);
        }
      ),
      { numRuns: 3 } // Reducir runs porque bcrypt es muy lento
    );
  }, 20000); // Timeout de 20 segundos

  it('Property 17b: JWT token generation and validation round trip', () => {
    fc.assert(
      fc.property(
        // Generador para sesiones de usuario válidas
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
          role: fc.constantFrom('admin', 'supervisor', 'operator'),
          isActive: fc.constant(true)
        }),
        (userSession: UserSession) => {
          // Generar tokens
          const accessToken = generateAccessToken(userSession);
          const refreshToken = generateRefreshToken(userSession);
          
          // Verificar que los tokens no están vacíos
          expect(accessToken).toBeTruthy();
          expect(refreshToken).toBeTruthy();
          expect(accessToken).not.toBe(refreshToken);
          
          // Validar token de acceso
          const decodedAccess = validateAccessToken(accessToken);
          expect(decodedAccess).toBeTruthy();
          expect(decodedAccess?.userId).toBe(userSession.userId);
          expect(decodedAccess?.email).toBe(userSession.email);
          expect(decodedAccess?.role).toBe(userSession.role);
          expect(decodedAccess?.type).toBe('access');
          
          // Validar token de refresh
          const decodedRefresh = validateRefreshToken(refreshToken);
          expect(decodedRefresh).toBeTruthy();
          expect(decodedRefresh?.userId).toBe(userSession.userId);
          expect(decodedRefresh?.email).toBe(userSession.email);
          expect(decodedRefresh?.role).toBe(userSession.role);
          expect(decodedRefresh?.type).toBe('refresh');
          
          // Verificar que no se pueden usar tokens del tipo incorrecto
          expect(validateRefreshToken(accessToken)).toBeNull();
          expect(validateAccessToken(refreshToken)).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 17c: Authorization header extraction', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 200 }).filter(s => !s.includes(' ')),
        (token) => {
          // Formato correcto: "Bearer <token>"
          const correctHeader = `Bearer ${token}`;
          const extractedToken = extractTokenFromHeader(correctHeader);
          expect(extractedToken).toBe(token);
          
          // Formatos incorrectos deben devolver null
          expect(extractTokenFromHeader(`Basic ${token}`)).toBeNull();
          expect(extractTokenFromHeader(token)).toBeNull();
          expect(extractTokenFromHeader(`Bearer`)).toBeNull();
          expect(extractTokenFromHeader('')).toBeNull();
          expect(extractTokenFromHeader(undefined)).toBeNull();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 17d: Password strength validation', () => {
    fc.assert(
      fc.property(
        // Generador para contraseñas de diferentes fortalezas
        fc.oneof(
          // Contraseñas válidas
          fc.string({ minLength: 6, maxLength: 50 }).filter(s => s.trim().length >= 6 && /[a-zA-Z]/.test(s)),
          // Contraseñas muy cortas
          fc.string({ maxLength: 5 }),
          // Contraseñas muy largas
          fc.string({ minLength: 129, maxLength: 200 }),
          // Contraseñas solo espacios
          fc.string().map(s => ' '.repeat(Math.max(1, s.length)))
        ),
        (password) => {
          const validation = validatePasswordStrength(password);
          
          // Verificar consistencia de la validación
          if (validation.isValid) {
            expect(validation.errors).toHaveLength(0);
            expect(password.length).toBeGreaterThanOrEqual(6);
            expect(password.length).toBeLessThanOrEqual(128);
            expect(password.trim().length).toBeGreaterThan(0);
            expect(/[a-zA-Z]/.test(password)).toBe(true);
          } else {
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors.every(error => typeof error === 'string')).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 17e: Role-based permission system', () => {
    fc.assert(
      fc.property(
        fc.record({
          userRole: fc.constantFrom('admin', 'supervisor', 'operator'),
          requiredRole: fc.constantFrom('admin', 'supervisor', 'operator')
        }),
        ({ userRole, requiredRole }) => {
          const hasAccess = hasPermission(userRole, requiredRole);
          
          // Verificar jerarquía de roles
          if (userRole === 'admin') {
            expect(hasAccess).toBe(true); // Admin puede todo
          } else if (userRole === 'supervisor') {
            if (requiredRole === 'admin') {
              expect(hasAccess).toBe(false); // Supervisor no puede acceso de admin
            } else {
              expect(hasAccess).toBe(true); // Supervisor puede supervisor y operator
            }
          } else if (userRole === 'operator') {
            if (requiredRole === 'operator') {
              expect(hasAccess).toBe(true); // Operator puede acceso de operator
            } else {
              expect(hasAccess).toBe(false); // Operator no puede supervisor ni admin
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 17f: Email validation consistency', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Emails válidos
          fc.emailAddress(),
          // Emails inválidos
          fc.string().filter(s => !s.includes('@')),
          fc.string().map(s => s + '@'),
          fc.string().map(s => '@' + s),
          fc.constant(''),
          fc.constant('invalid-email')
        ),
        (email) => {
          const isValid = isValidEmail(email);
          
          if (isValid) {
            // Si es válido, debe contener @ y tener formato básico correcto
            expect(email).toContain('@');
            expect(email.split('@')).toHaveLength(2);
            expect(email.split('@')[0].length).toBeGreaterThan(0);
            expect(email.split('@')[1]).toContain('.');
          } else {
            // Si es inválido, verificar que realmente no cumple los criterios básicos
            const hasAt = email.includes('@');
            const parts = email.split('@');
            const hasValidStructure = hasAt && parts.length === 2 && parts[0].length > 0 && parts[1].includes('.');
            
            expect(hasValidStructure).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 17g: Temporary password generation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8, max: 32 }),
        (length) => {
          const tempPassword = generateTemporaryPassword(length);
          
          // Verificar longitud
          expect(tempPassword.length).toBe(length);
          
          // Verificar que contiene diferentes tipos de caracteres
          expect(/[a-z]/.test(tempPassword)).toBe(true); // minúscula
          expect(/[A-Z]/.test(tempPassword)).toBe(true); // mayúscula
          expect(/\d/.test(tempPassword)).toBe(true); // número
          expect(/[!@#$%^&*]/.test(tempPassword)).toBe(true); // símbolo
          
          // Verificar que es válida según nuestros criterios
          const validation = validatePasswordStrength(tempPassword);
          expect(validation.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 17h: Token pair generation consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
          role: fc.constantFrom('admin', 'supervisor', 'operator'),
          isActive: fc.constant(true)
        }),
        (userSession: UserSession) => {
          const tokenPair = generateTokenPair(userSession);
          
          // Verificar que ambos tokens son válidos
          expect(tokenPair.accessToken).toBeTruthy();
          expect(tokenPair.refreshToken).toBeTruthy();
          expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken);
          
          // Verificar que ambos tokens contienen la misma información de usuario
          const accessDecoded = validateAccessToken(tokenPair.accessToken);
          const refreshDecoded = validateRefreshToken(tokenPair.refreshToken);
          
          expect(accessDecoded?.userId).toBe(refreshDecoded?.userId);
          expect(accessDecoded?.email).toBe(refreshDecoded?.email);
          expect(accessDecoded?.role).toBe(refreshDecoded?.role);
          expect(accessDecoded?.isActive).toBe(refreshDecoded?.isActive);
          
          // Verificar tipos correctos
          expect(accessDecoded?.type).toBe('access');
          expect(refreshDecoded?.type).toBe('refresh');
        }
      ),
      { numRuns: 30 }
    );
  });
});