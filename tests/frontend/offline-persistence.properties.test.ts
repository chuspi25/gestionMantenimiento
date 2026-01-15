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

describe('Offline Data Persistence Properties Tests', () => {
  let offlineManager: OfflineManager;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
    localStorageMock.clear.mockImplementation(() => {});
    
    offlineManager = new OfflineManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: maintenance-app, Property 13: Offline data persistence**
   * For any task data stored offline, the system should persist it in localStorage
   * and be able to retrieve the exact same data consistently
   * **Validates: Requirements 3.4**
   */
  it('Property 13a: Task data persistence round trip', () => {
    fc.assert(
      fc.property(
        // Generador para arrays de tareas válidas
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
            type: fc.constantFrom('electrical', 'mechanical'),
            priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
            status: fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled'),
            location: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            estimatedDuration: fc.integer({ min: 15, max: 480 }),
            dueDate: fc.date({ min: new Date(2024, 0, 1), max: new Date(2025, 11, 31) }).map(d => d.toISOString()),
            createdAt: fc.date({ min: new Date(2024, 0, 1), max: new Date() }).map(d => d.toISOString()),
            assignedTo: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
            notes: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                content: fc.string({ minLength: 1, maxLength: 200 }),
                createdAt: fc.date().map(d => d.toISOString()),
                authorId: fc.string({ minLength: 1, maxLength: 50 })
              }),
              { minLength: 0, maxLength: 3 }
            ),
            attachments: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                fileName: fc.string({ minLength: 1, maxLength: 100 }),
                fileUrl: fc.string({ minLength: 1, maxLength: 200 }),
                fileType: fc.constantFrom('image/jpeg', 'image/png', 'application/pdf', 'text/plain'),
                uploadedAt: fc.date().map(d => d.toISOString()),
                uploadedBy: fc.string({ minLength: 1, maxLength: 50 })
              }),
              { minLength: 0, maxLength: 2 }
            )
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (tasks: Task[]) => {
          // Simular que localStorage devuelve las tareas guardadas
          const tasksJson = JSON.stringify(tasks);
          localStorageMock.getItem.mockReturnValue(tasksJson);

          // Guardar tareas
          offlineManager.saveTasks(tasks);

          // Verificar que se llamó a localStorage.setItem
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'offline_tasks',
            tasksJson
          );

          // Recuperar tareas
          const retrievedTasks = offlineManager.getTasks();

          // Verificar que los datos son idénticos
          expect(retrievedTasks).toEqual(tasks);
          expect(retrievedTasks.length).toBe(tasks.length);

          // Verificar cada tarea individualmente
          tasks.forEach((originalTask, index) => {
            const retrievedTask = retrievedTasks[index];
            expect(retrievedTask.id).toBe(originalTask.id);
            expect(retrievedTask.title).toBe(originalTask.title);
            expect(retrievedTask.description).toBe(originalTask.description);
            expect(retrievedTask.type).toBe(originalTask.type);
            expect(retrievedTask.priority).toBe(originalTask.priority);
            expect(retrievedTask.status).toBe(originalTask.status);
            expect(retrievedTask.location).toBe(originalTask.location);
            expect(retrievedTask.estimatedDuration).toBe(originalTask.estimatedDuration);
            expect(retrievedTask.dueDate).toBe(originalTask.dueDate);
            expect(retrievedTask.createdAt).toBe(originalTask.createdAt);
            expect(retrievedTask.assignedTo).toBe(originalTask.assignedTo);
            expect(retrievedTask.requiredTools).toEqual(originalTask.requiredTools);
            expect(retrievedTask.notes).toEqual(originalTask.notes);
            expect(retrievedTask.attachments).toEqual(originalTask.attachments);
          });
        }
      ),
      { numRuns: 25 }
    );
  });

  it('Property 13b: Empty task list persistence', () => {
    fc.assert(
      fc.property(
        fc.constant([]), // Array vacío
        (emptyTasks: Task[]) => {
          const tasksJson = JSON.stringify(emptyTasks);
          localStorageMock.getItem.mockReturnValue(tasksJson);

          offlineManager.saveTasks(emptyTasks);
          const retrievedTasks = offlineManager.getTasks();

          expect(retrievedTasks).toEqual([]);
          expect(retrievedTasks.length).toBe(0);
          expect(Array.isArray(retrievedTasks)).toBe(true);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('Property 13c: Task data integrity with special characters', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.constant('test-id'),
          title: fc.string().filter(s => s.length > 0 && s.length <= 100),
          description: fc.string().filter(s => s.length > 0 && s.length <= 500),
          type: fc.constant('electrical'),
          priority: fc.constant('medium'),
          status: fc.constant('pending'),
          location: fc.string().filter(s => s.length > 0 && s.length <= 100),
          estimatedDuration: fc.constant(60),
          dueDate: fc.constant(new Date().toISOString()),
          createdAt: fc.constant(new Date().toISOString()),
          assignedTo: fc.option(fc.string(), { nil: undefined }),
          requiredTools: fc.array(fc.string(), { maxLength: 3 }),
          notes: fc.constant([]),
          attachments: fc.constant([])
        }),
        (task: Task) => {
          const tasks = [task];
          const tasksJson = JSON.stringify(tasks);
          localStorageMock.getItem.mockReturnValue(tasksJson);

          offlineManager.saveTasks(tasks);
          const retrievedTasks = offlineManager.getTasks();

          expect(retrievedTasks).toHaveLength(1);
          expect(retrievedTasks[0].title).toBe(task.title);
          expect(retrievedTasks[0].description).toBe(task.description);
          expect(retrievedTasks[0].location).toBe(task.location);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 13d: Offline task creation persistence', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          type: fc.constantFrom('electrical', 'mechanical'),
          priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          location: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          estimatedDuration: fc.integer({ min: 15, max: 480 }),
          dueDate: fc.date({ min: new Date() }).map(d => d.toISOString()),
          assignedTo: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          requiredTools: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 })
        }),
        (taskData) => {
          // Simular localStorage vacío inicialmente
          localStorageMock.getItem.mockReturnValue('[]');

          // Crear tarea offline
          const taskId = offlineManager.addTaskOffline(taskData);

          // Verificar que se generó un ID
          expect(taskId).toBeDefined();
          expect(typeof taskId).toBe('string');
          expect(taskId.length).toBeGreaterThan(0);

          // Verificar que se llamó a localStorage.setItem
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'offline_tasks',
            expect.stringContaining(taskData.title)
          );

          // Verificar que se guardaron las acciones pendientes
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'offline_pending_actions',
            expect.stringContaining('CREATE_TASK')
          );
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 13e: Task update persistence', () => {
    fc.assert(
      fc.property(
        fc.record({
          taskId: fc.string({ minLength: 1, maxLength: 50 }),
          originalTitle: fc.string({ minLength: 1, maxLength: 100 }),
          newTitle: fc.string({ minLength: 1, maxLength: 100 }),
          newPriority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
          newStatus: fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled')
        }),
        ({ taskId, originalTitle, newTitle, newPriority, newStatus }) => {
          // Crear tarea inicial
          const originalTask: Task = {
            id: taskId,
            title: originalTitle,
            description: 'Test description',
            type: 'electrical',
            priority: 'low',
            status: 'pending',
            location: 'Test location',
            estimatedDuration: 60,
            dueDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            requiredTools: [],
            notes: [],
            attachments: []
          };

          // Simular que la tarea existe en localStorage
          localStorageMock.getItem.mockReturnValue(JSON.stringify([originalTask]));

          // Actualizar tarea
          const updates = {
            title: newTitle,
            priority: newPriority,
            status: newStatus
          };

          offlineManager.updateTaskOffline(taskId, updates);

          // Verificar que se guardó la tarea actualizada
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'offline_tasks',
            expect.stringContaining(newTitle)
          );

          // Verificar que se guardó la acción pendiente
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'offline_pending_actions',
            expect.stringContaining('UPDATE_TASK')
          );
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 13f: Note addition persistence', () => {
    fc.assert(
      fc.property(
        fc.record({
          taskId: fc.string({ minLength: 1, maxLength: 50 }),
          noteContent: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)
        }),
        ({ taskId, noteContent }) => {
          // Crear tarea inicial
          const task: Task = {
            id: taskId,
            title: 'Test Task',
            description: 'Test description',
            type: 'electrical',
            priority: 'medium',
            status: 'pending',
            location: 'Test location',
            estimatedDuration: 60,
            dueDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            requiredTools: [],
            notes: [],
            attachments: []
          };

          // Simular que la tarea existe en localStorage
          localStorageMock.getItem.mockReturnValue(JSON.stringify([task]));

          // Agregar nota
          offlineManager.addNoteOffline(taskId, noteContent);

          // Verificar que se guardó la tarea con la nota
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'offline_tasks',
            expect.stringContaining(noteContent)
          );

          // Verificar que se guardó la acción pendiente
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'offline_pending_actions',
            expect.stringContaining('ADD_NOTE')
          );
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 13g: Storage error handling', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            description: fc.string({ minLength: 1, maxLength: 500 }),
            type: fc.constantFrom('electrical', 'mechanical'),
            priority: fc.constantFrom('low', 'medium', 'high', 'urgent'),
            status: fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled'),
            location: fc.string({ minLength: 1, maxLength: 100 }),
            estimatedDuration: fc.integer({ min: 15, max: 480 }),
            dueDate: fc.date().map(d => d.toISOString()),
            createdAt: fc.date().map(d => d.toISOString()),
            requiredTools: fc.array(fc.string(), { maxLength: 3 }),
            notes: fc.constant([]),
            attachments: fc.constant([])
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (tasks: Task[]) => {
          // Simular error en localStorage.setItem
          localStorageMock.setItem.mockImplementation(() => {
            throw new Error('Storage quota exceeded');
          });

          // Simular console.error para verificar que se maneja el error
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          // Intentar guardar tareas
          offlineManager.saveTasks(tasks);

          // Verificar que se manejó el error
          expect(consoleSpy).toHaveBeenCalledWith(
            'Error saving tasks to localStorage:',
            expect.any(Error)
          );

          consoleSpy.mockRestore();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 13h: Data retrieval with corrupted storage', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('invalid json'),
          fc.constant('{"incomplete": json'),
          fc.constant('null'),
          fc.constant('undefined'),
          fc.constant('')
        ),
        (corruptedData: string) => {
          // Simular datos corruptos en localStorage
          localStorageMock.getItem.mockReturnValue(corruptedData);

          // Simular console.error para verificar que se maneja el error
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          // Intentar recuperar tareas
          const tasks = offlineManager.getTasks();

          // Debe devolver array vacío en caso de error
          expect(Array.isArray(tasks)).toBe(true);
          expect(tasks).toEqual([]);

          // Verificar que se manejó el error (excepto para datos válidos como 'null')
          if (corruptedData !== 'null') {
            expect(consoleSpy).toHaveBeenCalledWith(
              'Error loading tasks from localStorage:',
              expect.any(Error)
            );
          }

          consoleSpy.mockRestore();
        }
      ),
      { numRuns: 10 }
    );
  });
});