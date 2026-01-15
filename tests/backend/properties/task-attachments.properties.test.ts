import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TaskService } from '../../../src/backend/services/TaskService.js';
import { UserService } from '../../../src/backend/services/UserService.js';
import { CreateTaskRequest, CreateUserRequest } from '../../../src/backend/models/index.js';
import { query } from '../../../src/backend/utils/database.js';

describe('Task File Attachment Association Properties Tests', () => {
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
      email: 'attachments@test.com',
      name: 'Attachments Test User',
      password: 'password123',
      role: 'admin'
    };
    const testUser = await userService.createUser(userData, 'system');
    testUserId = testUser.id;
    createdUserIds.push(testUser.id);

    // Crear tarea de prueba
    const taskData: CreateTaskRequest = {
      title: 'Test Task for Attachments',
      description: 'Task for testing file attachments functionality',
      type: 'mechanical',
      priority: 'high',
      location: 'Test Location',
      requiredTools: ['wrench', 'hammer'],
      estimatedDuration: 180,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
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
   * **Feature: maintenance-app, Property 12: File attachment association**
   * For any file attachment operation, the system should correctly associate files
   * with tasks and preserve all metadata including file information and upload details
   * **Validates: Requirements 4.5**
   */
  it('Property 12a: File attachment should preserve metadata and associate with task', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generador para datos de archivo
        fc.record({
          fileName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fileUrl: fc.webUrl(),
          fileType: fc.constantFrom('image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'application/zip')
        }),
        async ({ fileName, fileUrl, fileType }) => {
          // Crear archivo adjunto
          const createdAttachment = await taskService.addTaskAttachment(
            testTaskId,
            fileName,
            fileUrl,
            fileType,
            testUserId
          );

          // Verificar que se generó un ID único
          expect(createdAttachment.id).toBeDefined();
          expect(typeof createdAttachment.id).toBe('string');
          expect(createdAttachment.id.length).toBeGreaterThan(0);

          // Verificar que los metadatos se preservaron correctamente
          expect(createdAttachment.fileName).toBe(fileName);
          expect(createdAttachment.fileUrl).toBe(fileUrl);
          expect(createdAttachment.fileType).toBe(fileType);
          expect(createdAttachment.taskId).toBe(testTaskId);
          expect(createdAttachment.uploadedBy).toBe(testUserId);

          // Verificar que se generó timestamp automáticamente
          expect(createdAttachment.uploadedAt).toBeDefined();
          expect(createdAttachment.uploadedAt instanceof Date).toBe(true);
          expect(createdAttachment.uploadedAt.getTime()).toBeLessThanOrEqual(Date.now());
          expect(createdAttachment.uploadedAt.getTime()).toBeGreaterThan(Date.now() - 5000);

          // Verificar que el archivo aparece en la tarea
          const updatedTask = await taskService.getTaskById(testTaskId);
          expect(updatedTask).toBeDefined();
          expect(updatedTask!.attachments.length).toBeGreaterThan(0);
          
          const foundAttachment = updatedTask!.attachments.find(att => att.id === createdAttachment.id);
          expect(foundAttachment).toBeDefined();
          expect(foundAttachment!.fileName).toBe(fileName);
          expect(foundAttachment!.fileUrl).toBe(fileUrl);
          expect(foundAttachment!.fileType).toBe(fileType);
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 12b: Multiple attachments should maintain upload order', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar múltiples archivos
        fc.array(
          fc.record({
            fileName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            fileType: fc.constantFrom('image/jpeg', 'application/pdf', 'text/plain')
          }),
          { minLength: 3, maxLength: 6 }
        ),
        async (attachmentData) => {
          const createdAttachments = [];

          // Crear archivos adjuntos con delay para asegurar diferentes timestamps
          for (let i = 0; i < attachmentData.length; i++) {
            const data = attachmentData[i];
            const createdAttachment = await taskService.addTaskAttachment(
              testTaskId,
              `${i + 1}_${data.fileName}`,
              `https://example.com/file${i + 1}.ext`,
              data.fileType,
              testUserId
            );
            createdAttachments.push(createdAttachment);

            // Pequeño delay para asegurar diferentes timestamps
            if (i < attachmentData.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          // Obtener la tarea con todos los archivos adjuntos
          const taskWithAttachments = await taskService.getTaskById(testTaskId);
          expect(taskWithAttachments).toBeDefined();
          expect(taskWithAttachments!.attachments.length).toBe(attachmentData.length);

          // Verificar que los archivos están en orden cronológico (más antiguos primero)
          const attachments = taskWithAttachments!.attachments;
          for (let i = 0; i < attachments.length - 1; i++) {
            const currentTime = attachments[i].uploadedAt.getTime();
            const nextTime = attachments[i + 1].uploadedAt.getTime();
            expect(currentTime).toBeLessThanOrEqual(nextTime);
          }

          // Verificar que todos los archivos tienen metadatos correctos
          attachments.forEach((attachment, index) => {
            expect(attachment.id).toBeDefined();
            expect(attachment.taskId).toBe(testTaskId);
            expect(attachment.uploadedBy).toBe(testUserId);
            expect(attachment.fileName).toBe(`${index + 1}_${attachmentData[index].fileName}`);
            expect(attachment.fileType).toBe(attachmentData[index].fileType);
            expect(attachment.uploadedAt).toBeDefined();
          });
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 12c: File attachments should handle various file types correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar diferentes tipos de archivo
        fc.record({
          fileName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fileType: fc.oneof(
            fc.constant('image/jpeg'),
            fc.constant('image/png'),
            fc.constant('image/gif'),
            fc.constant('application/pdf'),
            fc.constant('text/plain'),
            fc.constant('text/csv'),
            fc.constant('application/zip'),
            fc.constant('application/json'),
            fc.constant('video/mp4'),
            fc.constant('audio/mpeg')
          ),
          fileUrl: fc.webUrl()
        }),
        async ({ fileName, fileType, fileUrl }) => {
          // Crear archivo adjunto
          const createdAttachment = await taskService.addTaskAttachment(
            testTaskId,
            fileName,
            fileUrl,
            fileType,
            testUserId
          );

          // Verificar que el tipo de archivo se preservó exactamente
          expect(createdAttachment.fileType).toBe(fileType);

          // Verificar que el archivo se puede recuperar correctamente
          const taskWithAttachment = await taskService.getTaskById(testTaskId);
          const foundAttachment = taskWithAttachment!.attachments.find(att => att.id === createdAttachment.id);
          
          expect(foundAttachment).toBeDefined();
          expect(foundAttachment!.fileType).toBe(fileType);
          expect(foundAttachment!.fileName).toBe(fileName);
          expect(foundAttachment!.fileUrl).toBe(fileUrl);
        }
      ),
      { numRuns: 12 }
    );
  });

  it('Property 12d: Attachments should be associated only with their specific task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          task1Files: fc.array(
            fc.record({
              fileName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              fileType: fc.constantFrom('image/jpeg', 'application/pdf')
            }),
            { minLength: 2, maxLength: 4 }
          ),
          task2Files: fc.array(
            fc.record({
              fileName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              fileType: fc.constantFrom('text/plain', 'application/zip')
            }),
            { minLength: 2, maxLength: 4 }
          )
        }),
        async ({ task1Files, task2Files }) => {
          // Crear segunda tarea
          const task2Data: CreateTaskRequest = {
            title: 'Second Test Task for Attachments',
            description: 'Second task for attachments isolation test',
            type: 'electrical',
            priority: 'urgent',
            location: 'Test Location 2',
            requiredTools: [],
            estimatedDuration: 60,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          };
          const task2 = await taskService.createTask(task2Data, testUserId);
          createdTaskIds.push(task2.id);

          // Crear archivos para la primera tarea
          const task1CreatedAttachments = [];
          for (let i = 0; i < task1Files.length; i++) {
            const file = task1Files[i];
            const attachment = await taskService.addTaskAttachment(
              testTaskId,
              `task1_${file.fileName}`,
              `https://task1.com/file${i}.ext`,
              file.fileType,
              testUserId
            );
            task1CreatedAttachments.push(attachment);
          }

          // Crear archivos para la segunda tarea
          const task2CreatedAttachments = [];
          for (let i = 0; i < task2Files.length; i++) {
            const file = task2Files[i];
            const attachment = await taskService.addTaskAttachment(
              task2.id,
              `task2_${file.fileName}`,
              `https://task2.com/file${i}.ext`,
              file.fileType,
              testUserId
            );
            task2CreatedAttachments.push(attachment);
          }

          // Verificar que cada tarea tiene solo sus propios archivos
          const task1WithAttachments = await taskService.getTaskById(testTaskId);
          const task2WithAttachments = await taskService.getTaskById(task2.id);

          expect(task1WithAttachments!.attachments.length).toBe(task1Files.length);
          expect(task2WithAttachments!.attachments.length).toBe(task2Files.length);

          // Verificar que los archivos de task1 no aparecen en task2
          const task1AttachmentIds = new Set(task1WithAttachments!.attachments.map(a => a.id));
          const task2AttachmentIds = new Set(task2WithAttachments!.attachments.map(a => a.id));
          const intersection = new Set([...task1AttachmentIds].filter(id => task2AttachmentIds.has(id)));
          expect(intersection.size).toBe(0);

          // Verificar contenido específico
          task1WithAttachments!.attachments.forEach(attachment => {
            expect(attachment.fileName).toContain('task1_');
            expect(attachment.fileUrl).toContain('task1.com');
            expect(attachment.taskId).toBe(testTaskId);
          });

          task2WithAttachments!.attachments.forEach(attachment => {
            expect(attachment.fileName).toContain('task2_');
            expect(attachment.fileUrl).toContain('task2.com');
            expect(attachment.taskId).toBe(task2.id);
          });
        }
      ),
      { numRuns: 6 }
    );
  });

  it('Property 12e: Attachment metadata should be immutable after creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fileName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fileUrl: fc.webUrl(),
          fileType: fc.constantFrom('image/png', 'application/pdf', 'text/plain')
        }),
        async ({ fileName, fileUrl, fileType }) => {
          // Crear archivo adjunto
          const createdAttachment = await taskService.addTaskAttachment(
            testTaskId,
            fileName,
            fileUrl,
            fileType,
            testUserId
          );

          // Esperar un poco y recuperar el archivo nuevamente
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const taskWithAttachment1 = await taskService.getTaskById(testTaskId);
          const foundAttachment1 = taskWithAttachment1!.attachments.find(att => att.id === createdAttachment.id);

          // Esperar más tiempo y recuperar otra vez
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const taskWithAttachment2 = await taskService.getTaskById(testTaskId);
          const foundAttachment2 = taskWithAttachment2!.attachments.find(att => att.id === createdAttachment.id);

          // Verificar que todos los metadatos permanecen iguales
          expect(foundAttachment1).toBeDefined();
          expect(foundAttachment2).toBeDefined();
          
          expect(foundAttachment1!.id).toBe(foundAttachment2!.id);
          expect(foundAttachment1!.taskId).toBe(foundAttachment2!.taskId);
          expect(foundAttachment1!.uploadedBy).toBe(foundAttachment2!.uploadedBy);
          expect(foundAttachment1!.fileName).toBe(foundAttachment2!.fileName);
          expect(foundAttachment1!.fileUrl).toBe(foundAttachment2!.fileUrl);
          expect(foundAttachment1!.fileType).toBe(foundAttachment2!.fileType);
          expect(foundAttachment1!.uploadedAt.getTime()).toBe(foundAttachment2!.uploadedAt.getTime());

          // Verificar que coinciden con el archivo original
          expect(foundAttachment1!.id).toBe(createdAttachment.id);
          expect(foundAttachment1!.fileName).toBe(createdAttachment.fileName);
          expect(foundAttachment1!.fileUrl).toBe(createdAttachment.fileUrl);
          expect(foundAttachment1!.fileType).toBe(createdAttachment.fileType);
          expect(foundAttachment1!.uploadedAt.getTime()).toBe(createdAttachment.uploadedAt.getTime());
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 12f: Attachment creation should reject invalid task IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fileName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fileUrl: fc.webUrl(),
          fileType: fc.constant('application/pdf'),
          invalidTaskId: fc.oneof(
            fc.uuid().filter(id => id !== testTaskId), // UUID válido pero inexistente
            fc.constant('invalid-task-id'), // ID inválido
            fc.constant('00000000-0000-0000-0000-000000000000'), // UUID nulo
            fc.constant('') // String vacío
          )
        }),
        async ({ fileName, fileUrl, fileType, invalidTaskId }) => {
          // Intentar crear archivo adjunto con task ID inválido debe fallar
          await expect(taskService.addTaskAttachment(
            invalidTaskId,
            fileName,
            fileUrl,
            fileType,
            testUserId
          )).rejects.toThrow();

          // Verificar que no se creó ningún archivo en la tarea válida
          const taskWithAttachments = await taskService.getTaskById(testTaskId);
          const attachmentsWithFileName = taskWithAttachments!.attachments.filter(att => 
            att.fileName === fileName
          );
          expect(attachmentsWithFileName.length).toBe(0);
        }
      ),
      { numRuns: 8 }
    );
  });

  it('Property 12g: File attachment should handle special characters in filenames', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generar nombres de archivo con caracteres especiales
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => /[!@#$%^&*(),.?":{}|<>]/.test(s.trim())), // Con caracteres especiales
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => /[áéíóúñü]/.test(s.trim())), // Con acentos
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => /\s/.test(s.trim())), // Con espacios
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => /\d/.test(s.trim())), // Con números
          fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s}.pdf`), // Con extensión
          fc.string({ minLength: 1, maxLength: 50 }).map(s => `folder/${s}.jpg`) // Con path
        ),
        async (fileName) => {
          if (fileName.trim().length === 0) return; // Skip empty filenames

          const createdAttachment = await taskService.addTaskAttachment(
            testTaskId,
            fileName,
            'https://example.com/special-file.ext',
            'application/octet-stream',
            testUserId
          );

          // Verificar que el nombre de archivo se preservó correctamente
          expect(createdAttachment.fileName).toBe(fileName);

          // Verificar que el archivo se puede recuperar correctamente
          const taskWithAttachment = await taskService.getTaskById(testTaskId);
          const foundAttachment = taskWithAttachment!.attachments.find(att => att.id === createdAttachment.id);
          
          expect(foundAttachment).toBeDefined();
          expect(foundAttachment!.fileName).toBe(fileName);
          expect(foundAttachment!.fileName).toBe(createdAttachment.fileName);
        }
      ),
      { numRuns: 12 }
    );
  });

  it('Property 12h: Attachment creation should handle concurrent operations correctly', async () => {
    const attachmentData = [
      { fileName: 'concurrent1.pdf', fileType: 'application/pdf' },
      { fileName: 'concurrent2.jpg', fileType: 'image/jpeg' },
      { fileName: 'concurrent3.txt', fileType: 'text/plain' }
    ];
    
    // Crear archivos adjuntos concurrentemente
    const attachmentPromises = attachmentData.map((data, index) => 
      taskService.addTaskAttachment(
        testTaskId,
        data.fileName,
        `https://example.com/concurrent${index + 1}.ext`,
        data.fileType,
        testUserId
      )
    );

    const createdAttachments = await Promise.all(attachmentPromises);

    // Verificar que todos los archivos se crearon correctamente
    expect(createdAttachments.length).toBe(3);
    
    // Verificar que todos tienen IDs únicos
    const attachmentIds = new Set(createdAttachments.map(att => att.id));
    expect(attachmentIds.size).toBe(3);

    // Verificar que todos aparecen en la tarea
    const taskWithAttachments = await taskService.getTaskById(testTaskId);
    const concurrentAttachments = taskWithAttachments!.attachments.filter(att => 
      attachmentData.some(data => data.fileName === att.fileName)
    );
    expect(concurrentAttachments.length).toBe(3);

    // Verificar que cada archivo tiene metadatos correctos
    concurrentAttachments.forEach(attachment => {
      expect(attachment.id).toBeDefined();
      expect(attachment.taskId).toBe(testTaskId);
      expect(attachment.uploadedBy).toBe(testUserId);
      expect(attachment.uploadedAt).toBeDefined();
      expect(attachmentData.some(data => data.fileName === attachment.fileName)).toBe(true);
    });
  });
});