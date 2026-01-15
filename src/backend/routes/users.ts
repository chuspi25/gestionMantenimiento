import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { UserService, UserFilters, PaginationOptions } from '../services/UserService.js';
import { authMiddleware, requireRole, requireResourceAccess } from '../middleware/auth.js';
import { validateCreateUser, validateUpdateUser, CreateUserRequest, UpdateUserRequest } from '../models/User.js';

const userRoutes = new Hono();
const userService = new UserService();

// Middleware de autenticación para todas las rutas de usuarios
userRoutes.use('*', authMiddleware);

/**
 * GET /users
 * Listar usuarios con filtros y paginación
 * Requiere rol: supervisor o admin
 */
userRoutes.get('/', requireRole('supervisor'), async (c) => {
  try {
    // User available for future use
    
    // Obtener parámetros de query
    const role = c.req.query('role') as 'admin' | 'supervisor' | 'operator' | undefined;
    const isActive = c.req.query('active');
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100); // Máximo 100
    const sortBy = c.req.query('sortBy') as 'name' | 'email' | 'created_at' | 'last_login' | undefined;
    const sortOrder = c.req.query('sortOrder') as 'asc' | 'desc' | undefined;

    // Construir filtros
    const filters: UserFilters = {};
    if (role && ['admin', 'supervisor', 'operator'].includes(role)) {
      filters.role = role;
    }
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    if (search && search.trim() !== '') {
      filters.search = search.trim();
    }

    // Construir opciones de paginación
    const pagination: PaginationOptions = {
      page: Math.max(1, page),
      limit: Math.max(1, limit),
      sortBy,
      sortOrder
    };

    const result = await userService.listUsers(filters, pagination);

    return c.json({
      success: true,
      data: result,
      message: 'Usuarios obtenidos exitosamente'
    });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /users/stats
 * Obtener estadísticas de usuarios
 * Requiere rol: supervisor o admin
 */
userRoutes.get('/stats', requireRole('supervisor'), async (c) => {
  try {
    const stats = await userService.getUserStats();

    return c.json({
      success: true,
      data: stats,
      message: 'Estadísticas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /users/:id
 * Obtener usuario por ID
 * Los operadores solo pueden ver su propio perfil
 */
userRoutes.get('/:id', requireResourceAccess((c) => c.req.param('id')), async (c) => {
  try {
    const userId = c.req.param('id');
    
    if (!userId) {
      throw new HTTPException(400, { message: 'ID de usuario requerido' });
    }

    const user = await userService.getUserById(userId);
    
    if (!user) {
      throw new HTTPException(404, { message: 'Usuario no encontrado' });
    }

    return c.json({
      success: true,
      data: user,
      message: 'Usuario obtenido exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('Error obteniendo usuario:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /users
 * Crear nuevo usuario
 * Requiere rol: admin
 */
userRoutes.post('/', requireRole('admin'), async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json();

    // Validar datos de entrada
    if (!validateCreateUser(body)) {
      throw new HTTPException(400, { message: 'Datos de usuario inválidos' });
    }

    const userData: CreateUserRequest = body;

    // Crear usuario
    const newUser = await userService.createUser(userData, currentUser.userId);

    return c.json({
      success: true,
      data: newUser,
      message: 'Usuario creado exitosamente'
    }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    
    // Manejar errores específicos del servicio
    if (error instanceof Error) {
      if (error.message.includes('email ya está registrado')) {
        throw new HTTPException(409, { message: error.message });
      }
      if (error.message.includes('inválido') || error.message.includes('requerido')) {
        throw new HTTPException(400, { message: error.message });
      }
    }

    console.error('Error creando usuario:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * PUT /users/:id
 * Actualizar usuario
 * Los operadores solo pueden actualizar su propio perfil (excepto rol)
 */
userRoutes.put('/:id', async (c) => {
  try {
    const currentUser = c.get('user');
    const userId = c.req.param('id');
    const body = await c.req.json();

    if (!userId) {
      throw new HTTPException(400, { message: 'ID de usuario requerido' });
    }

    // Validar datos de entrada
    if (!validateUpdateUser(body)) {
      throw new HTTPException(400, { message: 'Datos de actualización inválidos' });
    }

    const updateData: UpdateUserRequest = body;

    // Verificar permisos
    if (currentUser.role === 'operator') {
      // Los operadores solo pueden actualizar su propio perfil
      if (currentUser.userId !== userId) {
        throw new HTTPException(403, { message: 'No tienes permisos para actualizar este usuario' });
      }
      
      // Los operadores no pueden cambiar su rol
      if (updateData.role !== undefined) {
        throw new HTTPException(403, { message: 'No puedes cambiar tu propio rol' });
      }

      // Los operadores no pueden cambiar su estado activo
      if (updateData.isActive !== undefined) {
        throw new HTTPException(403, { message: 'No puedes cambiar tu propio estado' });
      }
    } else if (currentUser.role === 'supervisor') {
      // Los supervisores no pueden actualizar administradores
      const targetUser = await userService.getUserById(userId);
      if (targetUser && targetUser.role === 'admin') {
        throw new HTTPException(403, { message: 'No tienes permisos para actualizar administradores' });
      }

      // Los supervisores no pueden otorgar rol de admin
      if (updateData.role === 'admin') {
        throw new HTTPException(403, { message: 'No puedes otorgar rol de administrador' });
      }
    }

    // Actualizar usuario
    const updatedUser = await userService.updateUser(userId, updateData, currentUser.userId);

    return c.json({
      success: true,
      data: updatedUser,
      message: 'Usuario actualizado exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    // Manejar errores específicos del servicio
    if (error instanceof Error) {
      if (error.message.includes('no encontrado')) {
        throw new HTTPException(404, { message: error.message });
      }
      if (error.message.includes('email ya está en uso')) {
        throw new HTTPException(409, { message: error.message });
      }
      if (error.message.includes('inválido') || error.message.includes('requerido')) {
        throw new HTTPException(400, { message: error.message });
      }
    }

    console.error('Error actualizando usuario:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /users/:id/deactivate
 * Desactivar usuario
 * Requiere rol: supervisor o admin
 */
userRoutes.post('/:id/deactivate', requireRole('supervisor'), async (c) => {
  try {
    const currentUser = c.get('user');
    const userId = c.req.param('id');

    if (!userId) {
      throw new HTTPException(400, { message: 'ID de usuario requerido' });
    }

    // Verificar que no se esté desactivando a sí mismo
    if (currentUser.userId === userId) {
      throw new HTTPException(400, { message: 'No puedes desactivar tu propia cuenta' });
    }

    // Los supervisores no pueden desactivar administradores
    if (currentUser.role === 'supervisor') {
      const targetUser = await userService.getUserById(userId);
      if (targetUser && targetUser.role === 'admin') {
        throw new HTTPException(403, { message: 'No tienes permisos para desactivar administradores' });
      }
    }

    const deactivatedUser = await userService.deactivateUser(userId, currentUser.userId);

    return c.json({
      success: true,
      data: deactivatedUser,
      message: 'Usuario desactivado exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      throw new HTTPException(404, { message: error.message });
    }

    console.error('Error desactivando usuario:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /users/:id/reactivate
 * Reactivar usuario
 * Requiere rol: supervisor o admin
 */
userRoutes.post('/:id/reactivate', requireRole('supervisor'), async (c) => {
  try {
    const currentUser = c.get('user');
    const userId = c.req.param('id');

    if (!userId) {
      throw new HTTPException(400, { message: 'ID de usuario requerido' });
    }

    // Los supervisores no pueden reactivar administradores
    if (currentUser.role === 'supervisor') {
      const targetUser = await userService.getUserById(userId);
      if (targetUser && targetUser.role === 'admin') {
        throw new HTTPException(403, { message: 'No tienes permisos para reactivar administradores' });
      }
    }

    const reactivatedUser = await userService.reactivateUser(userId, currentUser.userId);

    return c.json({
      success: true,
      data: reactivatedUser,
      message: 'Usuario reactivado exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      throw new HTTPException(404, { message: error.message });
    }

    console.error('Error reactivando usuario:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /users/:id/can-delete
 * Verificar si un usuario puede ser eliminado
 * Requiere rol: admin
 */
userRoutes.get('/:id/can-delete', requireRole('admin'), async (c) => {
  try {
    const userId = c.req.param('id');

    if (!userId) {
      throw new HTTPException(400, { message: 'ID de usuario requerido' });
    }

    const canDelete = await userService.canDeleteUser(userId);

    return c.json({
      success: true,
      data: { canDelete },
      message: canDelete 
        ? 'El usuario puede ser eliminado' 
        : 'El usuario no puede ser eliminado porque tiene tareas asignadas'
    });
  } catch (error) {
    console.error('Error verificando si el usuario puede ser eliminado:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /users/:id/notify
 * Enviar notificación a un usuario
 * Requiere rol: supervisor o admin
 */
userRoutes.post('/:id/notify', requireRole('supervisor'), async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();

    if (!userId) {
      throw new HTTPException(400, { message: 'ID de usuario requerido' });
    }

    const { message, type = 'info' } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw new HTTPException(400, { message: 'Mensaje de notificación requerido' });
    }

    if (!['info', 'warning', 'error'].includes(type)) {
      throw new HTTPException(400, { message: 'Tipo de notificación inválido' });
    }

    // Verificar que el usuario existe
    const user = await userService.getUserById(userId);
    if (!user) {
      throw new HTTPException(404, { message: 'Usuario no encontrado' });
    }

    await userService.notifyUser(userId, message.trim(), type);

    return c.json({
      success: true,
      message: 'Notificación enviada exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Error enviando notificación:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /users/me
 * Obtener perfil del usuario actual
 */
userRoutes.get('/me', async (c) => {
  try {
    const currentUser = c.get('user');
    
    const user = await userService.getUserById(currentUser.userId);
    
    if (!user) {
      throw new HTTPException(404, { message: 'Usuario no encontrado' });
    }

    return c.json({
      success: true,
      data: user,
      message: 'Perfil obtenido exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    
    console.error('Error obteniendo perfil:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * PUT /users/me
 * Actualizar perfil del usuario actual
 */
userRoutes.put('/me', async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json();

    // Validar datos de entrada
    if (!validateUpdateUser(body)) {
      throw new HTTPException(400, { message: 'Datos de actualización inválidos' });
    }

    const updateData: UpdateUserRequest = body;

    // Los usuarios no pueden cambiar su propio rol o estado
    if (updateData.role !== undefined) {
      throw new HTTPException(403, { message: 'No puedes cambiar tu propio rol' });
    }

    if (updateData.isActive !== undefined) {
      throw new HTTPException(403, { message: 'No puedes cambiar tu propio estado' });
    }

    const updatedUser = await userService.updateUser(currentUser.userId, updateData, currentUser.userId);

    return c.json({
      success: true,
      data: updatedUser,
      message: 'Perfil actualizado exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    // Manejar errores específicos del servicio
    if (error instanceof Error) {
      if (error.message.includes('email ya está en uso')) {
        throw new HTTPException(409, { message: error.message });
      }
      if (error.message.includes('inválido') || error.message.includes('requerido')) {
        throw new HTTPException(400, { message: error.message });
      }
    }

    console.error('Error actualizando perfil:', error);
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

export default userRoutes;
