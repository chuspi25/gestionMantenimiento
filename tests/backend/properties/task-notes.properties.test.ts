import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, CreateUserRequest, CreateTaskNoteRequest } from '../../../src/backend/models/index.js';
import { query } from '../../../src/backend/utils/database.js';

describe('Task Notes Storage with Metadata Properties Tests', () => {
  let taskService: TaskService;
  let userService: UserService;
  let createdTaskIds: string[] = [];
  let createdUserIds: string[] = [];
  let testUserId: string;
  let testTaskId: string;

  beforeEach(async () => {
    // Configurar variables de entorno para tests
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.BCRYPT_SALT_ROUNDS = '4';
    
    taskService = new TaskService();
    userService = new UserService();
    createdTaskIds = [];
    createdUserIds = [];

    // Crear usuario de prueba
    const userData: CreateUserRequest = {
      email: 'notes@test.com',
      name: 'Notes Test User',
      password: 'password123',
      role: 'admin'
    };
    const testUser = await userService.createUser(userData, 'system');
    testUserId = testUser.id;
    createdUserIds.push(testUser.id);

    // Crear tarea de prueba
    const taskData: CreateTaskRequest = {
      title: 'Test Task for Notes',
      description: 'Task for testing notes functionality',
      type: 'electrical',
      priority: 'medium',
      location: 'Test Location',
      requiredTools: ['multimeter', 'screwdriver'],
      estimatedDuration: 120,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    const testTask = await taskService.createTask(taskData, testUserId);
    testTaskId = testTask.id;
    createdTaskIds.push(testTask.id);
  });

  afterEach(async () => {
    // Limpiar tareas creadas durante los tests
    for (const taskId of createdTaskIds) {
      try {
        await query('DELETE FROM task_notes WHERE task_id = $1', [taskId]);
        await query('DELETE FROM task_attachments WHERE task_id = $1', [taskId]);
        await query('DELETE FROM tasks WHERE id = $1', [taskId]);
      } catch (error) {
        console.warn(`Error limpiando tarea ${taskId}:`, error);
      }
    }

    // Limpiar usuarios creados durante los tests
    for (const userId of createdUserIds) {
      try {
        await query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (error) {
        console.warn(`Error limpiando usuario ${userId}:`, error);
      }
    }

    createdTaskIds = [];
    createdUserIds = [];
  });

  /**
   * **Feature: maintenance-app, Property 11: Note and incident storage with metadata**
   * For any note or incident storage operation, the system should preserve all metadata
   * including timestamps, user information, and content integrity
   * **Validates: Requirements 4.2, 4.4**
   */
  it('Property 11a: Note creation should preserve content and generate metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generador para contenido de notas
        fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
        async (noteContent: string) => {
          const noteData: CreateTaskNoteRequest = {
            taskId: testTaskId,
            content: noteContent
          };

          // Crear la nota
          const createdNote = await taskService.addTaskNote(noteData, testUserId);

          // Verificar que se generó un ID único
          expect(createdNote.id).toBeDefined();
          expect(typeof createdNote.id).toBe('string');
          expect(createdNote.id.length).toBeGreaterThan(0);

          // Verificar que el contenido se preservó correctamente
          expect(createdNote.content).toBe(noteContent.trim());
          expect(createdNote.taskId).toBe(testTaskId);
          expect(createdNote.userId).toBe(testUserId);

          // Verificar que se generó timestamp automáticamente
          expect(createdNote.createdAt).toBeDefined();
          expect(createdNote.createdAt instanceof Date).toBe(true);
          expect(createdNote.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
          expect(createdNote.createdAt.getTime()).toBeGreaterThan(Date.now() - 5000); // Dentro de los últimos 5 segundos

          // Verificar que la nota aparece en la tarea
          const updatedTask = await taskService.getTaskById(testTaskId);
          expect(updatedTask).toBeDefined();
          expect(updatedTask!.notes.length).toBeGreaterThan(0);
          
          const foundNote = updatedTask!.notes.find(note => note.id === createdNote.id);
          expect(foundNote).toBeDefined();
          expect(foundNote!.content).toBe(noteContent.trim());
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 11b: Multiple notes should maintain chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar múltiples notas
        fc.array(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          { minLength: 3, maxLength: 6 }
        ),
        async (noteContents: string[]) => {
          const createdNotes = [];

          // Crear notas con delay para asegurar diferentes timestamps
          for (let i = 0; i < noteContents.length; i++) {
            const noteData: CreateTaskNoteRequest = {
              taskId: testTaskId,
              content: `Note ${i + 1}: ${noteContents[i]}`
            };

            const createdNote = await taskService.addTaskNote(noteData, testUserId);
            createdNotes.push(createdNote);

            // Pequeño delay para asegurar diferentes timestamps
            if (i < noteContents.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          // Obtener la tarea con todas las notas
          const taskWithNotes = await taskService.getTaskById(testTaskId);
          expect(taskWithNotes).toBeDefined();
          expect(taskWithNotes!.notes.length).toBe(noteContents.length);

          // Verificar que las notas están en orden cronológico (más antiguas primero)
          const notes = taskWithNotes!.notes;
          for (let i = 0; i < notes.length - 1; i++) {
            const currentTime = notes[i].createdAt.getTime();
            const nextTime = notes[i + 1].createdAt.getTime();
            expect(currentTime).toBeLessThanOrEqual(nextTime);
          }

          // Verificar que todas las notas tienen metadatos correctos
          notes.forEach((note, index) => {
            expect(note.id).toBeDefined();
            expect(note.taskId).toBe(testTaskId);
            expect(note.userId).toBe(testUserId);
            expect(note.content).toBe(`Note ${index + 1}: ${noteContents[index].trim()}`);
            expect(note.createdAt).toBeDefined();
          });
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 11c: Note content should handle special characters and whitespace correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar contenido con caracteres especiales y espacios
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 100 }).map(s => `  ${s}  `), // Con espacios
          fc.string({ minLength: 1, maxLength: 100 }).map(s => `\t${s}\n`), // Con tabs y saltos
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => /[!@#$%^&*(),.?":{}|<>]/.test(s)), // Con caracteres especiales
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => /[áéíóúñü]/.test(s)), // Con acentos
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => /\d/.test(s)) // Con números
        ),
        async (noteContent: string) => {
          const noteData: CreateTaskNoteRequest = {
            taskId: testTaskId,
            content: noteContent
          };

          // Crear la nota
          const createdNote = await taskService.addTaskNote(noteData, testUserId);

          // Verificar que el contenido se preservó correctamente (con trimming)
          expect(createdNote.content).toBe(noteContent.trim());

          // Verificar que la nota se puede recuperar correctamente
          const taskWithNote = await taskService.getTaskById(testTaskId);
          const foundNote = taskWithNote!.notes.find(note => note.id === createdNote.id);
          
          expect(foundNote).toBeDefined();
          expect(foundNote!.content).toBe(noteContent.trim());
          expect(foundNote!.content).toBe(createdNote.content);
        }
      ),
      { numRuns: 12 }
    );
  });

  it('Property 11d: Notes should be associated only with their specific task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          task1Notes: fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            { minLength: 2, maxLength: 4 }
          ),
          task2Notes: fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            { minLength: 2, maxLength: 4 }
          )
        }),
        async ({ task1Notes, task2Notes }) => {
          // Crear segunda tarea
          const task2Data: CreateTaskRequest = {
            title: 'Second Test Task',
            description: 'Second task for notes isolation test',
            type: 'mechanical',
            priority: 'high',
            location: 'Test Location 2',
            requiredTools: [],
            estimatedDuration: 90,
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
          };
          const task2 = await taskService.createTask(task2Data, testUserId);
          createdTaskIds.push(task2.id);

          // Crear notas para la primera tarea
          const task1CreatedNotes = [];
          for (const content of task1Notes) {
            const noteData: CreateTaskNoteRequest = {
              taskId: testTaskId,
              content: `Task1: ${content}`
            };
            const note = await taskService.addTaskNote(noteData, testUserId);
            task1CreatedNotes.push(note);
          }

          // Crear notas para la segunda tarea
          const task2CreatedNotes = [];
          for (const content of task2Notes) {
            const noteData: CreateTaskNoteRequest = {
              taskId: task2.id,
              content: `Task2: ${content}`
            };
            const note = await taskService.addTaskNote(noteData, testUserId);
            task2CreatedNotes.push(note);
          }

          // Verificar que cada tarea tiene solo sus propias notas
          const task1WithNotes = await taskService.getTaskById(testTaskId);
          const task2WithNotes = await taskService.getTaskById(task2.id);

          expect(task1WithNotes!.notes.length).toBe(task1Notes.length);
          expect(task2WithNotes!.notes.length).toBe(task2Notes.length);

          // Verificar que las notas de task1 no aparecen en task2
          const task1NoteIds = new Set(task1WithNotes!.notes.map(n => n.id));
          const task2NoteIds = new Set(task2WithNotes!.notes.map(n => n.id));
          const intersection = new Set([...task1NoteIds].filter(id => task2NoteIds.has(id)));
          expect(intersection.size).toBe(0);

          // Verificar contenido específico
          task1WithNotes!.notes.forEach(note => {
            expect(note.content).toContain('Task1:');
            expect(note.taskId).toBe(testTaskId);
          });

          task2WithNotes!.notes.forEach(note => {
            expect(note.content).toContain('Task2:');
            expect(note.taskId).toBe(task2.id);
          });
        }
      ),
      { numRuns: 6 }
    );
  });

  it('Property 11e: Note metadata should be immutable after creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (noteContent: string) => {
          const noteData: CreateTaskNoteRequest = {
            taskId: testTaskId,
            content: noteContent
          };

          // Crear la nota
          const createdNote = await taskService.addTaskNote(noteData, testUserId);

          // Esperar un poco y recuperar la nota nuevamente
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const taskWithNote1 = await taskService.getTaskById(testTaskId);
          const foundNote1 = taskWithNote1!.notes.find(note => note.id === createdNote.id);

          // Esperar más tiempo y recuperar otra vez
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const taskWithNote2 = await taskService.getTaskById(testTaskId);
          const foundNote2 = taskWithNote2!.notes.find(note => note.id === createdNote.id);

          // Verificar que todos los metadatos permanecen iguales
          expect(foundNote1).toBeDefined();
          expect(foundNote2).toBeDefined();
          
          expect(foundNote1!.id).toBe(foundNote2!.id);
          expect(foundNote1!.taskId).toBe(foundNote2!.taskId);
          expect(foundNote1!.userId).toBe(foundNote2!.userId);
          expect(foundNote1!.content).toBe(foundNote2!.content);
          expect(foundNote1!.createdAt.getTime()).toBe(foundNote2!.createdAt.getTime());

          // Verificar que coinciden con la nota original
          expect(foundNote1!.id).toBe(createdNote.id);
          expect(foundNote1!.content).toBe(createdNote.content);
          expect(foundNote1!.createdAt.getTime()).toBe(createdNote.createdAt.getTime());
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 11f: Note creation should reject invalid task IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          invalidTaskId: fc.oneof(
            fc.uuid().filter(id => id !== testTaskId), // UUID válido pero inexistente
            fc.constant('invalid-task-id'), // ID inválido
            fc.constant('00000000-0000-0000-0000-000000000000'), // UUID nulo
            fc.constant('') // String vacío
          )
        }),
        async ({ content, invalidTaskId }) => {
          const noteData: CreateTaskNoteRequest = {
            taskId: invalidTaskId,
            content: content
          };

          // Intentar crear nota con task ID inválido debe fallar
          await expect(taskService.addTaskNote(noteData, testUserId))
            .rejects.toThrow();

          // Verificar que no se creó ninguna nota en la tarea válida
          const taskWithNotes = await taskService.getTaskById(testTaskId);
          const notesWithContent = taskWithNotes!.notes.filter(note => 
            note.content === content.trim()
          );
          expect(notesWithContent.length).toBe(0);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 11g: Note creation should handle concurrent operations correctly', async () => {
    const noteContents = ['Concurrent note 1', 'Concurrent note 2', 'Concurrent note 3'];
    
    // Crear notas concurrentemente
    const notePromises = noteContents.map(content => {
      const noteData: CreateTaskNoteRequest = {
        taskId: testTaskId,
        content: content
      };
      return taskService.addTaskNote(noteData, testUserId);
    });

    const createdNotes = await Promise.all(notePromises);

    // Verificar que todas las notas se crearon correctamente
    expect(createdNotes.length).toBe(3);
    
    // Verificar que todas tienen IDs únicos
    const noteIds = new Set(createdNotes.map(note => note.id));
    expect(noteIds.size).toBe(3);

    // Verificar que todas aparecen en la tarea
    const taskWithNotes = await taskService.getTaskById(testTaskId);
    const concurrentNotes = taskWithNotes!.notes.filter(note => 
      noteContents.includes(note.content)
    );
    expect(concurrentNotes.length).toBe(3);

    // Verificar que cada nota tiene metadatos correctos
    concurrentNotes.forEach(note => {
      expect(note.id).toBeDefined();
      expect(note.taskId).toBe(testTaskId);
      expect(note.userId).toBe(testUserId);
      expect(note.createdAt).toBeDefined();
      expect(noteContents).toContain(note.content);
    });
  });
});