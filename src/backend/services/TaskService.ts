import { query, transaction } from '../utils/database.js';
import { 
  Task, 
  TaskNote, 
  TaskAttachment,
  CreateTaskRequest, 
  UpdateTaskRequest, 
  CreateTaskNoteRequest,
  TaskFilters,
  TaskStatus,
  TaskType,
  TaskPriority
} from '../models/Task.js';
import pkg from 'uuid';
const { v4: uuidv4 } = pkg;

// Interfaz para datos de tarea desde la base de datos (snake_case)
interface TaskFromDB {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to?: string;
  created_by: string;
  location: string;
  required_tools: string[];
  estimated_duration: number;
  due_date: Date;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

interface TaskNoteFromDB {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: Date;
}

interface TaskAttachmentFromDB {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  uploaded_at: Date;
}

// Opciones de paginación
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'priority' | 'dueDate' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// Resultado paginado
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Estadísticas de tareas
export interface TaskStats {
  total: number;
  byStatus: {
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  byType: {
    electrical: number;
    mechanical: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  overdue: number;
  completedThisWeek: number;
  averageCompletionTime: number; // en horas
}

export class TaskService {
  // Crear nueva tarea
  async createTask(taskData: CreateTaskRequest, createdBy: string): Promise<Task> {
    return await transaction(async (client) => {
      try {
        // Generar ID único para la tarea
        const taskId = uuidv4();

        // Validar que el usuario asignado existe (si se especifica)
        if (taskData.assignedTo) {
          const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1 AND is_active = true',
            [taskData.assignedTo]
          );
          
          if (userResult.rows.length === 0) {
            throw new Error('El usuario asignado no existe o está inactivo');
          }
        }

        // Validar que la fecha de vencimiento no sea en el pasado
        if (taskData.dueDate < new Date()) {
          throw new Error('La fecha de vencimiento no puede ser en el pasado');
        }

        // Crear la tarea
        const taskResult = await client.query(
          `INSERT INTO tasks (
            id, title, description, type, priority, status, assigned_to, created_by,
            location, required_tools, estimated_duration, due_date, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          RETURNING *`,
          [
            taskId,
            taskData.title.trim(),
            taskData.description.trim(),
            taskData.type,
            taskData.priority,
            'pending',
            taskData.assignedTo || null,
            createdBy,
            taskData.location.trim(),
            taskData.requiredTools,
            taskData.estimatedDuration,
            taskData.dueDate
          ]
        );

        const newTask = taskResult.rows[0];
        console.log(`Nueva tarea creada: ${newTask.title} (${newTask.id}) por ${createdBy}`);

        return this.convertTaskFromDB(newTask, [], []);
      } catch (error) {
        console.error('Error creando tarea:', error);
        throw error;
      }
    });
  }

  // Obtener tarea por ID
  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      const taskResult = await query(
        'SELECT * FROM tasks WHERE id = $1',
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        return null;
      }

      const task = taskResult.rows[0];

      // Obtener notas de la tarea
      const notesResult = await query(
        'SELECT * FROM task_notes WHERE task_id = $1 ORDER BY created_at ASC',
        [taskId]
      );

      // Obtener archivos adjuntos
      const attachmentsResult = await query(
        'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY uploaded_at ASC',
        [taskId]
      );

      const notes = notesResult.rows.map(this.convertTaskNoteFromDB);
      const attachments = attachmentsResult.rows.map(this.convertTaskAttachmentFromDB);

      return this.convertTaskFromDB(task, notes, attachments);
    } catch (error) {
      console.error('Error obteniendo tarea:', error);
      throw error;
    }
  }

  // Listar tareas con filtros y paginación
  async listTasks(
    filters: TaskFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<PaginatedResult<Task>> {
    try {
      const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Construir condiciones WHERE
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.type) {
        conditions.push(`type = $${paramIndex++}`);
        params.push(filters.type);
      }

      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
      }

      if (filters.priority) {
        conditions.push(`priority = $${paramIndex++}`);
        params.push(filters.priority);
      }

      if (filters.assignedTo) {
        conditions.push(`assigned_to = $${paramIndex++}`);
        params.push(filters.assignedTo);
      }

      if (filters.createdBy) {
        conditions.push(`created_by = $${paramIndex++}`);
        params.push(filters.createdBy);
      }

      if (filters.dueBefore) {
        conditions.push(`due_date <= $${paramIndex++}`);
        params.push(filters.dueBefore);
      }

      if (filters.dueAfter) {
        conditions.push(`due_date >= $${paramIndex++}`);
        params.push(filters.dueAfter);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Mapear campos de ordenamiento
      const sortFieldMap = {
        priority: 'CASE priority WHEN \'urgent\' THEN 4 WHEN \'high\' THEN 3 WHEN \'medium\' THEN 2 ELSE 1 END',
        dueDate: 'due_date',
        createdAt: 'created_at',
        title: 'title'
      };

      const orderBy = `ORDER BY ${sortFieldMap[sortBy]} ${sortOrder.toUpperCase()}`;

      // Consulta para obtener el total
      const countResult = await query(
        `SELECT COUNT(*) as count FROM tasks ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Consulta para obtener las tareas
      const tasksResult = await query(
        `SELECT * FROM tasks ${whereClause} ${orderBy} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      );

      // Convertir tareas (sin notas ni adjuntos para eficiencia en listados)
      const tasks = tasksResult.rows.map((task: any) => this.convertTaskFromDB(task, [], []));

      return {
        items: tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error listando tareas:', error);
      throw error;
    }
  }

  // Actualizar tarea
  async updateTask(taskId: string, updateData: UpdateTaskRequest, updatedBy: string): Promise<Task> {
    return await transaction(async (client) => {
      try {
        // Verificar que la tarea existe
        const existingTaskResult = await client.query(
          'SELECT * FROM tasks WHERE id = $1',
          [taskId]
        );

        if (existingTaskResult.rows.length === 0) {
          throw new Error('Tarea no encontrada');
        }

        const existingTask = existingTaskResult.rows[0];

        // Validar campos a actualizar
        const fieldsToUpdate: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updateData.title !== undefined) {
          if (updateData.title.trim().length === 0) {
            throw new Error('El título no puede estar vacío');
          }
          fieldsToUpdate.push(`title = $${paramIndex++}`);
          values.push(updateData.title.trim());
        }

        if (updateData.description !== undefined) {
          if (updateData.description.trim().length === 0) {
            throw new Error('La descripción no puede estar vacía');
          }
          fieldsToUpdate.push(`description = $${paramIndex++}`);
          values.push(updateData.description.trim());
        }

        if (updateData.type !== undefined) {
          fieldsToUpdate.push(`type = $${paramIndex++}`);
          values.push(updateData.type);
        }

        if (updateData.priority !== undefined) {
          fieldsToUpdate.push(`priority = $${paramIndex++}`);
          values.push(updateData.priority);
        }

        if (updateData.status !== undefined) {
          fieldsToUpdate.push(`status = $${paramIndex++}`);
          values.push(updateData.status);

          // Actualizar timestamps según el estado
          if (updateData.status === 'in_progress' && existingTask.status === 'pending') {
            fieldsToUpdate.push(`started_at = NOW()`);
          } else if (updateData.status === 'completed' && existingTask.status !== 'completed') {
            fieldsToUpdate.push(`completed_at = NOW()`);
          }
        }

        if (updateData.assignedTo !== undefined) {
          if (updateData.assignedTo) {
            // Verificar que el usuario existe
            const userResult = await client.query(
              'SELECT id FROM users WHERE id = $1 AND is_active = true',
              [updateData.assignedTo]
            );
            
            if (userResult.rows.length === 0) {
              throw new Error('El usuario asignado no existe o está inactivo');
            }
          }
          fieldsToUpdate.push(`assigned_to = $${paramIndex++}`);
          values.push(updateData.assignedTo || null);
        }

        if (updateData.location !== undefined) {
          if (updateData.location.trim().length === 0) {
            throw new Error('La ubicación no puede estar vacía');
          }
          fieldsToUpdate.push(`location = $${paramIndex++}`);
          values.push(updateData.location.trim());
        }

        if (updateData.requiredTools !== undefined) {
          fieldsToUpdate.push(`required_tools = $${paramIndex++}`);
          values.push(updateData.requiredTools);
        }

        if (updateData.estimatedDuration !== undefined) {
          if (updateData.estimatedDuration <= 0) {
            throw new Error('La duración estimada debe ser mayor a 0');
          }
          fieldsToUpdate.push(`estimated_duration = $${paramIndex++}`);
          values.push(updateData.estimatedDuration);
        }

        if (updateData.dueDate !== undefined) {
          fieldsToUpdate.push(`due_date = $${paramIndex++}`);
          values.push(updateData.dueDate);
        }

        if (fieldsToUpdate.length === 0) {
          throw new Error('No hay campos para actualizar');
        }

        // Actualizar la tarea
        values.push(taskId);
        const updateResult = await client.query(
          `UPDATE tasks SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          values
        );

        const updatedTask = updateResult.rows[0];
        console.log(`Tarea actualizada: ${updatedTask.title} (${updatedTask.id}) por ${updatedBy}`);

        // Obtener notas y adjuntos
        const notesResult = await client.query(
          'SELECT * FROM task_notes WHERE task_id = $1 ORDER BY created_at ASC',
          [taskId]
        );

        const attachmentsResult = await client.query(
          'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY uploaded_at ASC',
          [taskId]
        );

        const notes = notesResult.rows.map(this.convertTaskNoteFromDB);
        const attachments = attachmentsResult.rows.map(this.convertTaskAttachmentFromDB);

        return this.convertTaskFromDB(updatedTask, notes, attachments);
      } catch (error) {
        console.error('Error actualizando tarea:', error);
        throw error;
      }
    });
  }

  // Asignar tarea a usuario
  async assignTask(taskId: string, assignedTo: string, assignedBy: string): Promise<Task> {
    return await this.updateTask(taskId, { assignedTo }, assignedBy);
  }

  // Cambiar estado de tarea
  async updateTaskStatus(taskId: string, status: TaskStatus, updatedBy: string): Promise<Task> {
    return await this.updateTask(taskId, { status }, updatedBy);
  }

  // Agregar nota a tarea
  async addTaskNote(noteData: CreateTaskNoteRequest, userId: string): Promise<TaskNote> {
    return await transaction(async (client) => {
      try {
        // Verificar que la tarea existe
        const taskResult = await client.query(
          'SELECT id FROM tasks WHERE id = $1',
          [noteData.taskId]
        );

        if (taskResult.rows.length === 0) {
          throw new Error('Tarea no encontrada');
        }

        // Crear la nota
        const noteId = uuidv4();
        const noteResult = await client.query(
          `INSERT INTO task_notes (id, task_id, user_id, content, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING *`,
          [noteId, noteData.taskId, userId, noteData.content.trim()]
        );

        const newNote = noteResult.rows[0];
        console.log(`Nueva nota agregada a tarea ${noteData.taskId} por ${userId}`);

        return this.convertTaskNoteFromDB(newNote);
      } catch (error) {
        console.error('Error agregando nota a tarea:', error);
        throw error;
      }
    });
  }

  // Agregar archivo adjunto a tarea
  async addTaskAttachment(
    taskId: string,
    fileName: string,
    fileUrl: string,
    fileType: string,
    uploadedBy: string
  ): Promise<TaskAttachment> {
    return await transaction(async (client) => {
      try {
        // Verificar que la tarea existe
        const taskResult = await client.query(
          'SELECT id FROM tasks WHERE id = $1',
          [taskId]
        );

        if (taskResult.rows.length === 0) {
          throw new Error('Tarea no encontrada');
        }

        // Crear el archivo adjunto
        const attachmentId = uuidv4();
        const attachmentResult = await client.query(
          `INSERT INTO task_attachments (id, task_id, file_name, file_url, file_type, uploaded_by, uploaded_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING *`,
          [attachmentId, taskId, fileName, fileUrl, fileType, uploadedBy]
        );

        const newAttachment = attachmentResult.rows[0];
        console.log(`Nuevo archivo adjunto agregado a tarea ${taskId} por ${uploadedBy}`);

        return this.convertTaskAttachmentFromDB(newAttachment);
      } catch (error) {
        console.error('Error agregando archivo adjunto a tarea:', error);
        throw error;
      }
    });
  }

  // Obtener estadísticas de tareas
  async getTaskStats(): Promise<TaskStats> {
    try {
      // Estadísticas básicas
      const statsResult = await query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          COUNT(CASE WHEN type = 'electrical' THEN 1 END) as electrical,
          COUNT(CASE WHEN type = 'mechanical' THEN 1 END) as mechanical,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as low,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high,
          COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent,
          COUNT(CASE WHEN due_date < NOW() AND status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue
         FROM tasks`
      );

      // Tareas completadas esta semana
      const weekResult = await query(
        `SELECT COUNT(*) as completed_this_week 
         FROM tasks 
         WHERE status = 'completed' 
         AND completed_at >= DATE_TRUNC('week', NOW())`
      );

      // Tiempo promedio de completación
      const avgResult = await query(
        `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_completion_time
         FROM tasks 
         WHERE status = 'completed' AND completed_at IS NOT NULL`
      );

      const stats = statsResult.rows[0];
      const avgCompletionTime = parseFloat(avgResult.rows[0].avg_completion_time || '0');

      return {
        total: parseInt(stats.total),
        byStatus: {
          pending: parseInt(stats.pending),
          in_progress: parseInt(stats.in_progress),
          completed: parseInt(stats.completed),
          cancelled: parseInt(stats.cancelled)
        },
        byType: {
          electrical: parseInt(stats.electrical),
          mechanical: parseInt(stats.mechanical)
        },
        byPriority: {
          low: parseInt(stats.low),
          medium: parseInt(stats.medium),
          high: parseInt(stats.high),
          urgent: parseInt(stats.urgent)
        },
        overdue: parseInt(stats.overdue),
        completedThisWeek: parseInt(weekResult.rows[0].completed_this_week),
        averageCompletionTime: Math.round(avgCompletionTime * 100) / 100
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de tareas:', error);
      throw error;
    }
  }

  // Obtener tareas asignadas a un usuario
  async getTasksByUser(userId: string, filters: TaskFilters = {}): Promise<Task[]> {
    const userFilters = { ...filters, assignedTo: userId };
    const result = await this.listTasks(userFilters, { page: 1, limit: 1000 });
    return result.items;
  }

  // Obtener tareas vencidas
  async getOverdueTasks(): Promise<Task[]> {
    const filters: TaskFilters = {
      dueBefore: new Date()
    };
    const result = await this.listTasks(filters, { page: 1, limit: 1000 });
    return result.items.filter(task => !['completed', 'cancelled'].includes(task.status));
  }

  // Métodos de conversión privados
  private convertTaskFromDB(taskDB: TaskFromDB, notes: TaskNote[], attachments: TaskAttachment[]): Task {
    return {
      id: taskDB.id,
      title: taskDB.title,
      description: taskDB.description,
      type: taskDB.type,
      priority: taskDB.priority,
      status: taskDB.status,
      assignedTo: taskDB.assigned_to || undefined,
      createdBy: taskDB.created_by,
      location: taskDB.location,
      requiredTools: Array.isArray(taskDB.required_tools) ? taskDB.required_tools : [],
      estimatedDuration: taskDB.estimated_duration,
      dueDate: taskDB.due_date,
      createdAt: taskDB.created_at,
      startedAt: taskDB.started_at || undefined,
      completedAt: taskDB.completed_at || undefined,
      notes,
      attachments
    };
  }

  private convertTaskNoteFromDB(noteDB: TaskNoteFromDB): TaskNote {
    return {
      id: noteDB.id,
      taskId: noteDB.task_id,
      userId: noteDB.user_id,
      content: noteDB.content,
      createdAt: noteDB.created_at
    };
  }

  private convertTaskAttachmentFromDB(attachmentDB: TaskAttachmentFromDB): TaskAttachment {
    return {
      id: attachmentDB.id,
      taskId: attachmentDB.task_id,
      fileName: attachmentDB.file_name,
      fileUrl: attachmentDB.file_url,
      fileType: attachmentDB.file_type,
      uploadedBy: attachmentDB.uploaded_by,
      uploadedAt: attachmentDB.uploaded_at
    };
  }
}
