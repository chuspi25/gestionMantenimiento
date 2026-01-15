import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { TaskService, PaginationOptions } from '../services/TaskService.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { 
  validateCreateTask, 
  validateUpdateTask, 
  validateCreateTaskNote,
  CreateTaskRequest, 
  UpdateTaskRequest,
  TaskFilters,
  TaskStatus,
  TaskType,
  TaskPriority
} from '../models/Task.js';

const taskRoutes = new Hono();
const taskService = new TaskService();

// Middleware de autenticación para todas las rutas de tareas
taskRoutes.use('*', authMiddleware);

/**
 * GET /tasks
 * Listar tareas con filtros y paginación
 * Todos los usuarios autenticados pueden ver tareas
 */
taskRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    
    // Obtener parámetros de query
    const type = c.req.query('type') as TaskType | undefined;
    const status = c.req.query('status') as TaskStatus | undefined;
    const priority = c.req.query('priority') as TaskPriority | undefined;
    const assignedTo = c.req.query('assignedTo');
    const createdBy = c.req.query('createdBy');
    const dueBefore = c.req.query('dueBefore');
    const dueAfter = c.req.query('dueAfter');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);
    const sortBy = c.req.query('sortBy') as 'priority' | 'dueDate' | 'createdAt' | 'title' | undefined;
    const sortOrder = c.req.query('sortOrder') as 'asc' | 'desc' | undefined;

    // Construir filtros
    const filters: TaskFilters = {};
    
    if (type && ['electrical', 'mechanical'].includes(type)) {
      filters.type = type;
    }
    
    if (status && ['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      filters.status = status;
    }
    
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      filters.priority = priority;
    }
    
    if (assignedTo) {
      filters.assignedTo = assignedTo;
    }
    
    if (createdBy) {
      filters.createdBy = createdBy;
    }
    
    if (dueBefore) {
      const date = new Date(dueBefore);
      if (!isNaN(date.getTime())) {
        filters.dueBefore = date;
      }
    }
    
    if (dueAfter) {
      const date = new Date(dueAfter);
      if (!isNaN(date.getTime())) {
        filters.dueAfter = date;
      }
    }

    // Los operadores solo pueden ver sus tareas asignadas (a menos que sean supervisores/admin)
    if (user.role === 'operator') {
      filters.assignedTo = user.userId;
    }

    // Construir opciones de paginación
    const pagination: PaginationOptions = {
      page: Math.max(1, page),
      limit: Math.max(1, limit),
      sortBy,
      sortOrder
    };

    const result = await taskService.listTasks(filters, pagination);

    return c.json({
      success: true,
      data: result,
      message: 'Tareas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error listando tareas:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /tasks/stats
 * Obtener estadísticas de tareas
 * Requiere rol: supervisor o admin
 */
taskRoutes.get('/stats', requireRole('supervisor'), async (c) => {
  try {
    const stats = await taskService.getTaskStats();

    return c.json({
      success: true,
      data: stats,
      message: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de tareas:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /tasks/overdue
 * Obtener tareas vencidas
 * Requiere rol: supervisor o admin
 */
taskRoutes.get('/overdue', requireRole('supervisor'), async (c) => {
  try {
    const overdueTasks = await taskService.getOverdueTasks();

    return c.json({
      success: true,
      data: overdueTasks,
      message: 'Tareas vencidas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo tareas vencidas:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /tasks/my
 * Obtener tareas asignadas al usuario actual
 */
taskRoutes.get('/my', async (c) => {
  try {
    const user = c.get('user');
    
    const myTasks = await taskService.getTasksByUser(user.userId);

    return c.json({
      success: true,
      data: myTasks,
      message: 'Mis tareas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo mis tareas:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /tasks/:id
 * Obtener tarea por ID
 * Los operadores solo pueden ver sus tareas asignadas
 */
taskRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const taskId = c.req.param('id');
    
    if (!taskId) {
      throw new HTTPException(400, { message: 'ID de tarea requerido' });
    }

    const task = await taskService.getTaskById(taskId);
    
    if (!task) {
      throw new HTTPException(404, { message: 'Tarea no encontrada' });
    }

    // Verificar permisos de acceso
    if (user.role === 'operator') {
      if (task.assignedTo !== user.userId && task.createdBy !== user.userId) {
        throw new HTTPException(403, { message: 'No tienes permisos para ver esta tarea' });
      }
    }

    return c.json({
      success: true,
      data: task,
      message: 'Tarea obtenida exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('Error obteniendo tarea:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /tasks
 * Crear nueva tarea
 * Requiere rol: supervisor o admin
 */
taskRoutes.post('/', requireRole('supervisor'), async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json();

    // Validar datos de entrada
    if (!validateCreateTask(body)) {
      throw new HTTPException(400, { message: 'Datos de tarea inválidos' });
    }

    const taskData: CreateTaskRequest = body;

    // Crear tarea
    const newTask = await taskService.createTask(taskData, currentUser.userId);

    return c.json({
      success: true,
      data: newTask,
      message: 'Tarea creada exitosamente'
    }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    
    // Manejar errores específicos del servicio
    if (error instanceof Error) {
      if (error.message.includes('usuario asignado no existe')) {
        throw new HTTPException(400, { message: error.message });
      }
      if (error.message.includes('fecha de vencimiento')) {
        throw new HTTPException(400, { message: error.message });
      }
      if (error.message.includes('inválido') || error.message.includes('requerido')) {
        throw new HTTPException(400, { message: error.message });
      }
    }

    console.error('Error creando tarea:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * PUT /tasks/:id
 * Actualizar tarea
 * Los operadores pueden actualizar solo sus tareas asignadas
 */
taskRoutes.put('/:id', async (c) => {
  try {
    const currentUser = c.get('user');
    const taskId = c.req.param('id');
    const body = await c.req.json();

    if (!taskId) {
      throw new HTTPException(400, { message: 'ID de tarea requerido' });
    }

    // Validar datos de entrada
    if (!validateUpdateTask(body)) {
      throw new HTTPException(400, { message: 'Datos de actualización inválidos' });
    }

    const updateData: UpdateTaskRequest = body;

    // Verificar que la tarea existe y obtener permisos
    const existingTask = await taskService.getTaskById(taskId);
    if (!existingTask) {
      throw new HTTPException(404, { message: 'Tarea no encontrada' });
    }

    // Verificar permisos
    if (currentUser.role === 'operator') {
      // Los operadores solo pueden actualizar sus tareas asignadas
      if (existingTask.assignedTo !== currentUser.userId) {
        throw new HTTPException(403, { message: 'No tienes permisos para actualizar esta tarea' });
      }
      
      // Los operadores no pueden cambiar la asignación
      if (updateData.assignedTo !== undefined) {
        throw new HTTPException(403, { message: 'No puedes cambiar la asignación de la tarea' });
      }

      // Los operadores solo pueden actualizar ciertos campos
      const allowedFields = ['status', 'description'];
      const providedFields = Object.keys(updateData);
      const hasDisallowedFields = providedFields.some(field => !allowedFields.includes(field));
      
      if (hasDisallowedFields) {
        throw new HTTPException(403, { message: 'Solo puedes actualizar el estado y descripción de tus tareas' });
      }
    }

    // Actualizar tarea
    const updatedTask = await taskService.updateTask(taskId, updateData, currentUser.userId);

    return c.json({
      success: true,
      data: updatedTask,
      message: 'Tarea actualizada exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    // Manejar errores específicos del servicio
    if (error instanceof Error) {
      if (error.message.includes('no encontrada')) {
        throw new HTTPException(404, { message: error.message });
      }
      if (error.message.includes('usuario asignado no existe')) {
        throw new HTTPException(400, { message: error.message });
      }
      if (error.message.includes('inválido') || error.message.includes('requerido')) {
        throw new HTTPException(400, { message: error.message });
      }
    }

    console.error('Error actualizando tarea:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * PATCH /tasks/:id/status
 * Actualizar solo el estado de una tarea
 * Los operadores pueden actualizar el estado de sus tareas asignadas
 */
taskRoutes.patch('/:id/status', async (c) => {
  try {
    const currentUser = c.get('user');
    const taskId = c.req.param('id');
    const body = await c.req.json();

    if (!taskId) {
      throw new HTTPException(400, { message: 'ID de tarea requerido' });
    }

    const { status } = body;

    if (!status || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      throw new HTTPException(400, { message: 'Estado de tarea inválido' });
    }

    // Verificar que la tarea existe y obtener permisos
    const existingTask = await taskService.getTaskById(taskId);
    if (!existingTask) {
      throw new HTTPException(404, { message: 'Tarea no encontrada' });
    }

    // Verificar permisos
    if (currentUser.role === 'operator') {
      if (existingTask.assignedTo !== currentUser.userId) {
        throw new HTTPException(403, { message: 'No tienes permisos para actualizar esta tarea' });
      }
    }

    // Actualizar estado
    const updatedTask = await taskService.updateTaskStatus(taskId, status, currentUser.userId);

    return c.json({
      success: true,
      data: updatedTask,
      message: 'Estado de tarea actualizado exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Error actualizando estado de tarea:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * PATCH /tasks/:id/assign
 * Asignar tarea a un usuario
 * Requiere rol: supervisor o admin
 */
taskRoutes.patch('/:id/assign', requireRole('supervisor'), async (c) => {
  try {
    const currentUser = c.get('user');
    const taskId = c.req.param('id');
    const body = await c.req.json();

    if (!taskId) {
      throw new HTTPException(400, { message: 'ID de tarea requerido' });
    }

    const { assignedTo } = body;

    if (!assignedTo || typeof assignedTo !== 'string') {
      throw new HTTPException(400, { message: 'ID de usuario asignado requerido' });
    }

    // Asignar tarea
    const updatedTask = await taskService.assignTask(taskId, assignedTo, currentUser.userId);

    return c.json({
      success: true,
      data: updatedTask,
      message: 'Tarea asignada exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    // Manejar errores específicos del servicio
    if (error instanceof Error) {
      if (error.message.includes('no encontrada')) {
        throw new HTTPException(404, { message: error.message });
      }
      if (error.message.includes('usuario asignado no existe')) {
        throw new HTTPException(400, { message: error.message });
      }
    }

    console.error('Error asignando tarea:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /tasks/:id/notes
 * Agregar nota a una tarea
 * Los usuarios pueden agregar notas a tareas que pueden ver
 */
taskRoutes.post('/:id/notes', async (c) => {
  try {
    const currentUser = c.get('user');
    const taskId = c.req.param('id');
    const body = await c.req.json();

    if (!taskId) {
      throw new HTTPException(400, { message: 'ID de tarea requerido' });
    }

    // Validar datos de entrada
    const noteData = { taskId, ...body };
    if (!validateCreateTaskNote(noteData)) {
      throw new HTTPException(400, { message: 'Datos de nota inválidos' });
    }

    // Verificar que la tarea existe y el usuario tiene permisos
    const existingTask = await taskService.getTaskById(taskId);
    if (!existingTask) {
      throw new HTTPException(404, { message: 'Tarea no encontrada' });
    }

    // Verificar permisos
    if (currentUser.role === 'operator') {
      if (existingTask.assignedTo !== currentUser.userId && existingTask.createdBy !== currentUser.userId) {
        throw new HTTPException(403, { message: 'No tienes permisos para agregar notas a esta tarea' });
      }
    }

    // Crear nota
    const newNote = await taskService.addTaskNote(noteData, currentUser.userId);

    return c.json({
      success: true,
      data: newNote,
      message: 'Nota agregada exitosamente'
    }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    // Manejar errores específicos del servicio
    if (error instanceof Error) {
      if (error.message.includes('no encontrada')) {
        throw new HTTPException(404, { message: error.message });
      }
      if (error.message.includes('inválido') || error.message.includes('requerido')) {
        throw new HTTPException(400, { message: error.message });
      }
    }

    console.error('Error agregando nota:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /tasks/:id/attachments
 * Agregar archivo adjunto a una tarea
 * Los usuarios pueden agregar archivos a tareas que pueden ver
 */
taskRoutes.post('/:id/attachments', async (c) => {
  try {
    const currentUser = c.get('user');
    const taskId = c.req.param('id');
    const body = await c.req.json();

    if (!taskId) {
      throw new HTTPException(400, { message: 'ID de tarea requerido' });
    }

    const { fileName, fileUrl, fileType } = body;

    if (!fileName || !fileUrl || !fileType) {
      throw new HTTPException(400, { message: 'Datos de archivo incompletos' });
    }

    if (typeof fileName !== 'string' || typeof fileUrl !== 'string' || typeof fileType !== 'string') {
      throw new HTTPException(400, { message: 'Datos de archivo inválidos' });
    }

    // Verificar que la tarea existe y el usuario tiene permisos
    const existingTask = await taskService.getTaskById(taskId);
    if (!existingTask) {
      throw new HTTPException(404, { message: 'Tarea no encontrada' });
    }

    // Verificar permisos
    if (currentUser.role === 'operator') {
      if (existingTask.assignedTo !== currentUser.userId && existingTask.createdBy !== currentUser.userId) {
        throw new HTTPException(403, { message: 'No tienes permisos para agregar archivos a esta tarea' });
      }
    }

    // Crear archivo adjunto
    const newAttachment = await taskService.addTaskAttachment(
      taskId,
      fileName.trim(),
      fileUrl.trim(),
      fileType.trim(),
      currentUser.userId
    );

    return c.json({
      success: true,
      data: newAttachment,
      message: 'Archivo adjunto agregado exitosamente'
    }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    // Manejar errores específicos del servicio
    if (error instanceof Error) {
      if (error.message.includes('no encontrada')) {
        throw new HTTPException(404, { message: error.message });
      }
    }

    console.error('Error agregando archivo adjunto:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

export default taskRoutes;
