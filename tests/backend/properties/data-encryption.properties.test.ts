import { describe, it, expect, beforeAll } from 'vitest';
import { fc } from '@fast-check/vitest';
import {
  encryptSensitiveData,
  decryptSensitiveData,
  encryptForDatabase,
  decryptFromDatabase,
  encryptObjectFields,
  decryptObjectFields,
  generateSecureHash,
  verifyDataIntegrity
} from '../../../src/backend/utils/encryption';

// **Feature: maintenance-app, Property 18: Data encryption for sensitive information**
// **Validates: Requirements 7.2**

describe('Property 18: Data encryption for sensitive information', () => {
  beforeAll(() => {
    // Configurar clave de encriptación para tests
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-maintenance-app-testing-purposes-32-bytes';
    process.env.ENCRYPTION_SALT = 'test-salt-for-encryption';
  });

  describe('Basic encryption/decryption round trip', () => {
    it('should encrypt and decrypt any sensitive data maintaining integrity', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (sensitiveData) => {
            // Encriptar datos sensibles
            const encrypted = encryptSensitiveData(sensitiveData);
            
            // Verificar que los datos están encriptados (no son iguales al original)
            expect(encrypted.encryptedData).not.toBe(sensitiveData);
            expect(encrypted.iv).toBeDefined();
            expect(encrypted.tag).toBeDefined();
            
            // Desencriptar y verificar que obtenemos los datos originales
            const decrypted = decryptSensitiveData(encrypted);
            expect(decrypted).toBe(sensitiveData);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Database encryption with integrity verification', () => {
    it('should encrypt data for database storage with integrity verification', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (sensitiveData, context) => {
            // Encriptar para base de datos
            const encryptedRecord = encryptForDatabase(sensitiveData, context);
            
            // Verificar estructura del registro encriptado
            expect(encryptedRecord.encrypted).toBeDefined();
            expect(encryptedRecord.hash).toBeDefined();
            expect(encryptedRecord.timestamp).toBeTypeOf('number');
            expect(encryptedRecord.context).toBe(context);
            
            // Los datos encriptados no deben ser iguales a los originales
            expect(encryptedRecord.encrypted.encryptedData).not.toBe(sensitiveData);
            
            // Desencriptar desde base de datos
            const decrypted = decryptFromDatabase(encryptedRecord);
            expect(decrypted).toBe(sensitiveData);
            
            // Verificar integridad usando hash
            expect(verifyDataIntegrity(decrypted, encryptedRecord.hash)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Object field encryption', () => {
    it('should encrypt specific fields of objects while preserving structure', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            notes: fc.string({ minLength: 0, maxLength: 200 }),
            publicInfo: fc.string({ minLength: 1, maxLength: 100 })
          }),
          (userData) => {
            const sensitiveFields = ['email', 'password', 'notes'];
            
            // Encriptar campos sensibles
            const encryptedObject = encryptObjectFields(userData, sensitiveFields);
            
            // Verificar que los campos no sensibles se mantienen
            expect(encryptedObject.id).toBe(userData.id);
            expect(encryptedObject.name).toBe(userData.name);
            expect(encryptedObject.publicInfo).toBe(userData.publicInfo);
            
            // Verificar que los campos sensibles fueron encriptados
            expect(encryptedObject.email).toBeUndefined();
            expect(encryptedObject.password).toBeUndefined();
            expect(encryptedObject.notes).toBeUndefined();
            
            // Verificar que existen los campos encriptados
            expect(encryptedObject.email_encrypted).toBeDefined();
            expect(encryptedObject.password_encrypted).toBeDefined();
            expect(encryptedObject.notes_encrypted).toBeDefined();
            
            // Desencriptar campos
            const decryptedObject = decryptObjectFields(encryptedObject, sensitiveFields);
            
            // Verificar que obtenemos los datos originales
            expect(decryptedObject.id).toBe(userData.id);
            expect(decryptedObject.name).toBe(userData.name);
            expect(decryptedObject.email).toBe(userData.email);
            expect(decryptedObject.password).toBe(userData.password);
            expect(decryptedObject.notes).toBe(userData.notes);
            expect(decryptedObject.publicInfo).toBe(userData.publicInfo);
            
            // Verificar que los campos encriptados fueron removidos
            expect(decryptedObject.email_encrypted).toBeUndefined();
            expect(decryptedObject.password_encrypted).toBeUndefined();
            expect(decryptedObject.notes_encrypted).toBeUndefined();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Hash integrity verification', () => {
    it('should generate consistent hashes and verify data integrity', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (data) => {
            // Generar hash
            const hash1 = generateSecureHash(data);
            const hash2 = generateSecureHash(data);
            
            // Los hashes deben ser consistentes
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 produce 64 caracteres hex
            
            // Verificar integridad
            expect(verifyDataIntegrity(data, hash1)).toBe(true);
            
            // Datos modificados no deben pasar la verificación
            if (data.length > 1) {
              const modifiedData = data.slice(0, -1) + 'X';
              expect(verifyDataIntegrity(modifiedData, hash1)).toBe(false);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Encryption security properties', () => {
    it('should produce different encrypted outputs for the same input (due to random IV)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (data) => {
            // Encriptar los mismos datos múltiples veces
            const encrypted1 = encryptSensitiveData(data);
            const encrypted2 = encryptSensitiveData(data);
            
            // Los resultados deben ser diferentes (debido al IV aleatorio)
            expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
            expect(encrypted1.iv).not.toBe(encrypted2.iv);
            
            // Pero ambos deben desencriptar al mismo valor original
            expect(decryptSensitiveData(encrypted1)).toBe(data);
            expect(decryptSensitiveData(encrypted2)).toBe(data);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should fail decryption with tampered data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (data) => {
            const encrypted = encryptSensitiveData(data);
            
            // Alterar los datos encriptados
            const tamperedEncrypted = {
              ...encrypted,
              encryptedData: encrypted.encryptedData.slice(0, -2) + 'XX'
            };
            
            // La desencriptación debe fallar
            expect(() => decryptSensitiveData(tamperedEncrypted)).toThrow();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Error handling', () => {
    it('should handle invalid inputs gracefully', () => {
      // Test con datos vacíos
      expect(() => encryptSensitiveData('')).toThrow();
      expect(() => encryptSensitiveData(null as any)).toThrow();
      expect(() => encryptSensitiveData(undefined as any)).toThrow();
      
      // Test con datos encriptados inválidos
      expect(() => decryptSensitiveData({} as any)).toThrow();
      expect(() => decryptSensitiveData({
        encryptedData: 'invalid',
        iv: 'invalid',
        tag: 'invalid'
      })).toThrow();
      
      // Test con hash inválido
      expect(verifyDataIntegrity('data', '')).toBe(false);
      expect(verifyDataIntegrity('', 'hash')).toBe(false);
    });
  });
});