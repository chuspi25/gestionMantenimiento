import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { fc } from '@fast-check/vitest';
import fs from 'fs';
import path from 'path';
import { SecureLogger } from '../../../src/backend/utils/secureLogger';

// **Feature: maintenance-app, Property 19: Secure error logging**
// **Validates: Requirements 7.3**

describe('Property 19: Secure error logging', () => {
  let testLogger: SecureLogger;
  let testLogDir: string;

  beforeAll(() => {
    // Configurar directorio de logs de prueba
    testLogDir = './test-logs';
    
    // Configurar variables de entorno para tests
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_DIRECTORY = testLogDir;
    process.env.LOG_ENABLE_CONSOLE = 'false';
    process.env.LOG_ENABLE_FILE = 'true';
    process.env.LOG_SANITIZE_DATA = 'true';
    process.env.LOG_ENCRYPT = 'false'; // Deshabilitado para poder leer los logs en tests
    
    testLogger = new SecureLogger({
      logLevel: 'debug',
      logDirectory: testLogDir,
      enableConsole: false,
      enableFile: true,
      sanitizeData: true,
      encryptLogs: false
    });
  });

  afterEach(() => {
    // Limpiar archivos de log después de cada test
    try {
      if (fs.existsSync(testLogDir)) {
        const files = fs.readdirSync(testLogDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(testLogDir, file));
        });
        fs.rmdirSync(testLogDir);
      }
    } catch (error) {
      // Ignorar errores de limpieza
    }
  });

  describe('Sensitive data sanitization', () => {
    it('should sanitize passwords in error messages', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 8, maxLength: 20 }),
          (username, password) => {
            const errorMessage = `Authentication failed for user ${username} with password: ${password}`;
            
            // Log the error
            testLogger.error(errorMessage);
            
            // Read the log file
            const logFiles = fs.readdirSync(testLogDir);
            expect(logFiles.length).toBeGreaterThan(0);
            
            const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
            
            // Verify password is not exposed
            expect(logContent).not.toContain(password);
            expect(logContent).toContain('***REDACTED***');
            expect(logContent).toContain(username); // Username should still be present
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should sanitize tokens in error messages', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 20, maxLength: 100 }),
          (token) => {
            const errorMessage = `Invalid token: ${token}`;
            
            testLogger.error(errorMessage);
            
            const logFiles = fs.readdirSync(testLogDir);
            const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
            
            // Verify token is not exposed
            expect(logContent).not.toContain(token);
            expect(logContent).toContain('***REDACTED***');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should sanitize email addresses in error messages', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          (email) => {
            const errorMessage = `User registration failed for email: ${email}`;
            
            testLogger.error(errorMessage);
            
            const logFiles = fs.readdirSync(testLogDir);
            const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
            
            // Verify email is sanitized
            expect(logContent).not.toContain(email);
            expect(logContent).toContain('***REDACTED***');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Metadata sanitization', () => {
    it('should sanitize sensitive fields in metadata', () => {
      fc.assert(
        fc.property(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            password: fc.string({ minLength: 8, maxLength: 20 }),
            token: fc.string({ minLength: 20, maxLength: 50 }),
            email: fc.emailAddress(),
            publicInfo: fc.string({ minLength: 1, maxLength: 50 })
          }),
          (metadata) => {
            testLogger.error('System error occurred', { metadata });
            
            const logFiles = fs.readdirSync(testLogDir);
            const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
            
            // Parse the log entry
            const logEntry = JSON.parse(logContent.trim());
            
            // Verify sensitive fields are redacted
            expect(logEntry.metadata.password).toBe('***REDACTED***');
            expect(logEntry.metadata.token).toBe('***REDACTED***');
            expect(logEntry.metadata.email).toBe('***REDACTED***');
            
            // Verify non-sensitive fields are preserved
            expect(logEntry.metadata.userId).toBe(metadata.userId);
            expect(logEntry.metadata.publicInfo).toBe(metadata.publicInfo);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Error logging with diagnostic information', () => {
    it('should include diagnostic information while sanitizing sensitive data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 8, maxLength: 20 }),
          (requestId, userId, password) => {
            const errorMessage = `Database connection failed for user ${userId}`;
            const context = {
              requestId,
              userId,
              password, // This should be sanitized
              timestamp: Date.now(),
              errorCode: 'DB_CONNECTION_ERROR'
            };
            
            testLogger.error(errorMessage, context);
            
            const logFiles = fs.readdirSync(testLogDir);
            const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
            const logEntry = JSON.parse(logContent.trim());
            
            // Verify diagnostic information is preserved
            expect(logEntry.requestId).toBe(requestId);
            expect(logEntry.userId).toBe(userId);
            expect(logEntry.timestamp).toBe(context.timestamp);
            expect(logEntry.errorCode).toBe('DB_CONNECTION_ERROR');
            expect(logEntry.level).toBe('error');
            expect(logEntry.message).toContain(userId);
            
            // Verify sensitive data is sanitized
            expect(logEntry.password).toBe('***REDACTED***');
            expect(logContent).not.toContain(password);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Different log levels maintain security', () => {
    it('should sanitize sensitive data across all log levels', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 8, maxLength: 20 }),
          fc.constantFrom('error', 'warn', 'info', 'debug'),
          (sensitiveData, logLevel) => {
            const message = `Operation failed with secret: ${sensitiveData}`;
            
            // Log at the specified level
            switch (logLevel) {
              case 'error':
                testLogger.error(message);
                break;
              case 'warn':
                testLogger.warn(message);
                break;
              case 'info':
                testLogger.info(message);
                break;
              case 'debug':
                testLogger.debug(message);
                break;
            }
            
            const logFiles = fs.readdirSync(testLogDir);
            const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
            const logEntry = JSON.parse(logContent.trim());
            
            // Verify level is correct
            expect(logEntry.level).toBe(logLevel);
            
            // Verify sensitive data is sanitized
            expect(logContent).not.toContain(sensitiveData);
            expect(logContent).toContain('***REDACTED***');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Security and audit logging', () => {
    it('should properly log security events without exposing sensitive data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 8, maxLength: 20 }),
          fc.string({ minLength: 10, maxLength: 50 }),
          (userId, password, ipAddress) => {
            const context = {
              userId,
              password, // Should be sanitized
              ip: ipAddress,
              userAgent: 'TestAgent/1.0'
            };
            
            testLogger.security('Unauthorized access attempt detected', context);
            
            const logFiles = fs.readdirSync(testLogDir);
            const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
            const logEntry = JSON.parse(logContent.trim());
            
            // Verify it's marked as security event
            expect(logEntry.message).toContain('[SECURITY]');
            expect(logEntry.context).toBe('security');
            
            // Verify diagnostic info is preserved
            expect(logEntry.userId).toBe(userId);
            expect(logEntry.ip).toBe(ipAddress);
            expect(logEntry.userAgent).toBe('TestAgent/1.0');
            
            // Verify sensitive data is sanitized
            expect(logEntry.password).toBe('***REDACTED***');
            expect(logContent).not.toContain(password);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Error handling in logging system', () => {
    it('should handle logging errors gracefully without exposing sensitive data', () => {
      // Test with circular references and other problematic data
      const problematicData = {
        password: 'secret123',
        validField: 'normalData'
      };
      
      // Create circular reference
      (problematicData as any).circular = problematicData;
      
      // This should not throw and should handle the error gracefully
      expect(() => {
        testLogger.error('Error with problematic data', problematicData);
      }).not.toThrow();
      
      // If a log file was created, verify no sensitive data leaked
      const logFiles = fs.readdirSync(testLogDir);
      if (logFiles.length > 0) {
        const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
        expect(logContent).not.toContain('secret123');
      }
    });
  });

  describe('Log structure and format', () => {
    it('should maintain consistent log structure while sanitizing data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            password: fc.string({ minLength: 8, maxLength: 20 }),
            requestId: fc.string({ minLength: 10, maxLength: 30 })
          }),
          (message, context) => {
            testLogger.error(message, context);
            
            const logFiles = fs.readdirSync(testLogDir);
            const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf8');
            const logEntry = JSON.parse(logContent.trim());
            
            // Verify required log structure
            expect(logEntry).toHaveProperty('timestamp');
            expect(logEntry).toHaveProperty('level');
            expect(logEntry).toHaveProperty('message');
            expect(logEntry.level).toBe('error');
            
            // Verify timestamp is valid ISO string
            expect(() => new Date(logEntry.timestamp)).not.toThrow();
            expect(new Date(logEntry.timestamp).toISOString()).toBe(logEntry.timestamp);
            
            // Verify context fields
            expect(logEntry.userId).toBe(context.userId);
            expect(logEntry.requestId).toBe(context.requestId);
            expect(logEntry.password).toBe('***REDACTED***');
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});