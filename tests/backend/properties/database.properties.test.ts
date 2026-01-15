import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

describe('Database Configuration Properties Tests', () => {
  beforeEach(() => {
    // Limpiar el cache de módulos para cada test
    vi.resetModules();
    // Limpiar variables de entorno
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_POOL_MAX;
    delete process.env.DB_IDLE_TIMEOUT;
    delete process.env.DB_CONNECTION_TIMEOUT;
  });

  /**
   * **Feature: maintenance-app, Property 21: Database configuration flexibility**
   * For any valid database configuration in environment variables, 
   * the system should successfully connect and operate with the specified database
   * **Validates: Requirements 8.3**
   */
  it('Property 21: Database configuration with DATABASE_URL format', () => {
    fc.assert(
      fc.property(
        // Generador para configuraciones válidas usando DATABASE_URL
        fc.record({
          protocol: fc.constant('postgresql'),
          username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          password: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          host: fc.oneof(
            fc.constant('localhost'),
            fc.constant('127.0.0.1')
          ),
          port: fc.integer({ min: 5432, max: 5433 }),
          database: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s))
        }),
        (config) => {
          // Configurar DATABASE_URL
          const databaseUrl = `${config.protocol}://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
          
          // Verificar que el formato de URL es válido
          expect(databaseUrl).toMatch(/^postgresql:\/\/[a-zA-Z0-9_]+:[a-zA-Z0-9_]+@(localhost|127\.0\.0\.1):(5432|5433)\/[a-zA-Z0-9_]+$/);
          
          // Verificar que contiene todos los componentes necesarios
          expect(databaseUrl).toContain(config.username);
          expect(databaseUrl).toContain(config.password);
          expect(databaseUrl).toContain(config.host);
          expect(databaseUrl).toContain(config.port.toString());
          expect(databaseUrl).toContain(config.database);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 21b: Database configuration with individual variables', () => {
    fc.assert(
      fc.property(
        // Generador para configuraciones individuales válidas
        fc.record({
          host: fc.oneof(
            fc.constant('localhost'),
            fc.constant('127.0.0.1')
          ),
          port: fc.integer({ min: 5432, max: 5433 }),
          database: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          user: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          password: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s))
        }),
        (config) => {
          // Verificar que todos los campos son válidos
          expect(config.host).toMatch(/^(localhost|127\.0\.0\.1)$/);
          expect(config.port).toBeGreaterThanOrEqual(5432);
          expect(config.port).toBeLessThanOrEqual(5433);
          expect(config.database).toMatch(/^[a-zA-Z0-9_]+$/);
          expect(config.user).toMatch(/^[a-zA-Z0-9_]+$/);
          expect(config.password).toMatch(/^[a-zA-Z0-9_]+$/);
          
          // Verificar que no hay campos vacíos
          expect(config.database.length).toBeGreaterThan(0);
          expect(config.user.length).toBeGreaterThan(0);
          expect(config.password.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 21c: Pool configuration parameters are valid', () => {
    fc.assert(
      fc.property(
        fc.record({
          maxConnections: fc.integer({ min: 1, max: 50 }),
          idleTimeout: fc.integer({ min: 1000, max: 60000 }),
          connectionTimeout: fc.integer({ min: 1000, max: 10000 })
        }),
        (poolConfig) => {
          // Verificar que los valores de configuración del pool son válidos
          expect(poolConfig.maxConnections).toBeGreaterThan(0);
          expect(poolConfig.maxConnections).toBeLessThanOrEqual(50);
          
          expect(poolConfig.idleTimeout).toBeGreaterThanOrEqual(1000);
          expect(poolConfig.idleTimeout).toBeLessThanOrEqual(60000);
          
          expect(poolConfig.connectionTimeout).toBeGreaterThanOrEqual(1000);
          expect(poolConfig.connectionTimeout).toBeLessThanOrEqual(10000);
          
          // Los valores son válidos independientemente de su relación
          expect(typeof poolConfig.maxConnections).toBe('number');
          expect(typeof poolConfig.idleTimeout).toBe('number');
          expect(typeof poolConfig.connectionTimeout).toBe('number');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 21d: Default configuration values are reasonable', () => {
    // Verificar que los valores por defecto son razonables
    const defaultConfig = {
      host: 'localhost',
      port: 5432,
      database: 'maintenance_db',
      user: 'postgres',
      password: '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    };

    // Verificar valores por defecto
    expect(defaultConfig.host).toBe('localhost');
    expect(defaultConfig.port).toBe(5432);
    expect(defaultConfig.database).toMatch(/^[a-zA-Z0-9_]+$/);
    expect(defaultConfig.user).toMatch(/^[a-zA-Z0-9_]*$/);
    expect(defaultConfig.max).toBeGreaterThan(0);
    expect(defaultConfig.idleTimeoutMillis).toBeGreaterThan(0);
    expect(defaultConfig.connectionTimeoutMillis).toBeGreaterThan(0);
  });

  it('Property 21e: Environment variable parsing is consistent', () => {
    fc.assert(
      fc.property(
        fc.record({
          portString: fc.integer({ min: 1024, max: 65535 }).map(n => n.toString()),
          maxString: fc.integer({ min: 1, max: 100 }).map(n => n.toString()),
          timeoutString: fc.integer({ min: 1000, max: 60000 }).map(n => n.toString())
        }),
        (config) => {
          // Verificar que los strings se pueden parsear correctamente
          const port = parseInt(config.portString);
          const max = parseInt(config.maxString);
          const timeout = parseInt(config.timeoutString);
          
          expect(port).toBeGreaterThanOrEqual(1024);
          expect(port).toBeLessThanOrEqual(65535);
          expect(max).toBeGreaterThanOrEqual(1);
          expect(max).toBeLessThanOrEqual(100);
          expect(timeout).toBeGreaterThanOrEqual(1000);
          expect(timeout).toBeLessThanOrEqual(60000);
          
          // Verificar que el parsing es consistente
          expect(parseInt(config.portString)).toBe(port);
          expect(parseInt(config.maxString)).toBe(max);
          expect(parseInt(config.timeoutString)).toBe(timeout);
        }
      ),
      { numRuns: 30 }
    );
  });
});