import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { OfflineManager } from '../../src/frontend/scripts/offlineManager.js';
import { Task } from '../../src/frontend/scripts/types.js';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock fetch
global.fetch = vi.fn();

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock window events
const mockAddEventListener = vi.fn();
const mockDispatchEvent = vi.fn();
Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener });
Object.defineProperty(window, 'dispatchEvent', { value: mockDispatchEvent });

global.localStorage = localStorageMock as any;

describe('Data Synchronization Properties Tests', () => {
  let offlineManager: OfflineManager;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
    localStorageMock.clear.mockImplementation(() => {});
    
    // Mock successful fetch responses by default
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [] }),
    });
    
    offlineManager = new OfflineManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: maintenance-app, Property 14: Data synchronization on reconnection**
   * When the system reconnects to the internet, it should synchronize local changes
   * with the server and resolve conflicts consistently
   * **Validates: Requirements 3.5**
   */
  it('Property 14a: Successful synchronization with server data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          serverTasks: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              title: fc.string({ minLength: 1, maxLength: 100 }),
              description: fc.string({ minLength: 1, maxLength: 500 }),
              type: fc.constantFrom('electrical', 'mechanical'),
              priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
              status: fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled'),
              location: fc.string({ minLength: 1, maxLength: 100 }),
              estimatedDuration: fc.integer({ min: 15, max: 480 }),
              dueDate: fc.date({ min: new Date() }).map(d => d.toISOString()),
              createdAt: fc.date({ min: new Date(2024, 0, 1), max: new Date() }).map(d => d.toISOString()),
              updatedAt: fc.option(fc.date({ min: new Date(2024, 0, 1), max: new Date() }).map(d => d.toISOString())),
              assignedTo: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
              notes: fc.constant([]),
              attachments: fc.constant([])
            }),
            { minLength: 0, maxLength: 5 }
          )
        }),
        async ({ serverTasks }) => {
          // Configurar mocks
          localStorageMock.getItem.mockImplementation((key) => {
            if (key === 'offline_tasks') return JSON.stringify([]);
            if (key === 'offline_pending_actions') return JSON.stringify([]);
            if (key === 'auth_token') return 'mock-token';
            return null;
          });

          (fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ tasks: serverTasks }),
          });

          // Ejecutar sincronización
          const result = await offlineManager.syncWithServer();

          // Verificar resultado exitoso
          expect(result.success).toBe(true);
          expect(result.message).toContain('exitosamente');

          // Verificar que se llamó a la API
          expect(fetch).toHaveBeenCalledWith('/api/tasks', {
            headers: {
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json'
            }
          });

          // Verificar que se guardaron los datos sincronizados
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'offline_tasks',
            expect.any(String)
          );
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 14b: Network error handling during sync', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Network error',
          'Server unavailable',
          'Timeout'
        ),
        async (errorMessage) => {
          // Configurar mocks
          localStorageMock.getItem.mockImplementation((key) => {
            if (key === 'offline_tasks') return JSON.stringify([]);
            if (key === 'offline_pending_actions') return JSON.stringify([]);
            if (key === 'auth_token') return 'mock-token';
            return null;
          });

          // Simular error de red
          (fetch as any).mockRejectedValue(new Error(errorMessage));

          // Ejecutar sincronización
          const result = await offlineManager.syncWithServer();

          // Verificar que se manejó el error
          expect(result.success).toBe(false);
          expect(result.message).toContain('Error durante la sincronización');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 14c: Offline mode synchronization prevention', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(false), // navigator.onLine = false
        async (isOnline) => {
          // Simular modo offline
          Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: isOnline,
          });

          // Crear nuevo manager en modo offline
          const offlineManagerOffline = new OfflineManager();

          // Intentar sincronizar
          const result = await offlineManagerOffline.syncWithServer();

          // Verificar que no se ejecutó la sincronización
          expect(result.success).toBe(false);
          expect(result.message).toContain('Sin conexión a internet');

          // Verificar que no se hicieron llamadas a la API
          expect(fetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 5 }
    );
  });
});