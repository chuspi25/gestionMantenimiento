import { query, transaction } from '../utils/database.js';
import { createPasswordHash, isValidEmail } from '../utils/auth.js';
import { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest
} from '../models/User.js';

// Interfaz para filtros de búsqueda de usuarios
export interface UserFilters {
  role?: 'admin' | 'supervisor' | 'operator';
  isActive?: boolean;
  search?: string; // Búsqueda por nombre o email
}

// Interfaz para paginación
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'email' | 'created_at' | 'last_login';
  sortOrder?: 'asc' | 'desc';
}

// Resultado paginado
export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UserService {
  
  // Crear nuevo usuario
  async createUser(userData: CreateUserRequest, createdBy: string): Promise<User> {
    return await transaction(async (client) => {
      try {
        // Validar datos de entrada
        if (!isValidEmail(userData.email)) {
          throw new Error('Formato de email inválido');
        }

        if (!userData.name || userData.name.trim().length === 0) {
          throw new Error('El nombre es requerido');
        }

        if (!userData.password || userData.password.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres');
        }

        if (!['admin', 'supervisor', 'operator'].includes(userData.role)) {
          throw new Error('Rol inválido');
        }

        // Verificar que el email no esté en uso
        const existingUserResult = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [userData.email.toLowerCase()]
        );

        if (existingUserResult.rows.length > 0) {
          throw new Error('El email ya está registrado');
        }

        // Hash de la contraseña
        const passwordHash = await createPasswordHash(userData.password);

        // Crear usuario
        const userResult = await client.query(
          `INSERT INTO users (email, name, password_hash, role, is_active, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW()) 
           RETURNING id, email, name, role, is_active, created_at`,
          [userData.email.toLowerCase(), userData.name.trim(), passwordHash, userData.role, true]
        );

        const newUser = userResult.rows[0];

        console.log(`Nuevo usuario creado: ${newUser.email} por ${createdBy}`);
        
        // Convertir a formato User (camelCase)
        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          isActive: newUser.is_active,
          createdAt: newUser.created_at
        };
      } catch (error) {
        console.error('Error creando usuario:', error);
        throw error;
      }
    });
  }

  // Obtener usuario por ID
  async getUserById(userId: string): Promise<User | null> {
    try {
      const userResult = await query(
        'SELECT id, email, name, role, is_active, created_at, last_login, profile_image FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return null;
      }

      const user = userResult.rows[0];
      
      // Convertir a formato User (camelCase)
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        profileImage: user.profile_image
      };
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      throw error;
    }
  }

  // Obtener usuario por email
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const userResult = await query(
        'SELECT id, email, name, role, is_active, created_at, last_login, profile_image FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        return null;
      }

      const user = userResult.rows[0];
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        profileImage: user.profile_image
      };
    } catch (error) {
      console.error('Error obteniendo usuario por email:', error);
      throw error;
    }
  }

  // Actualizar usuario
  async updateUser(userId: string, updateData: UpdateUserRequest, updatedBy: string): Promise<User> {
    return await transaction(async (client) => {
      try {
        // Verificar que el usuario existe
        const existingUserResult = await client.query(
          'SELECT id, email FROM users WHERE id = $1',
          [userId]
        );

        if (existingUserResult.rows.length === 0) {
          throw new Error('Usuario no encontrado');
        }

        const existingUser = existingUserResult.rows[0];

        // Construir query dinámico basado en los campos a actualizar
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (updateData.email !== undefined) {
          if (!isValidEmail(updateData.email)) {
            throw new Error('Formato de email inválido');
          }

          // Verificar que el nuevo email no esté en uso por otro usuario
          if (updateData.email.toLowerCase() !== existingUser.email) {
            const emailCheckResult = await client.query(
              'SELECT id FROM users WHERE email = $1 AND id != $2',
              [updateData.email.toLowerCase(), userId]
            );

            if (emailCheckResult.rows.length > 0) {
              throw new Error('El email ya está en uso por otro usuario');
            }
          }

          updateFields.push(`email = $${paramIndex}`);
          updateValues.push(updateData.email.toLowerCase());
          paramIndex++;
        }

        if (updateData.name !== undefined) {
          if (!updateData.name || updateData.name.trim().length === 0) {
            throw new Error('El nombre no puede estar vacío');
          }
          updateFields.push(`name = $${paramIndex}`);
          updateValues.push(updateData.name.trim());
          paramIndex++;
        }

        if (updateData.password !== undefined) {
          if (updateData.password.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres');
          }
          const passwordHash = await createPasswordHash(updateData.password);
          updateFields.push(`password_hash = $${paramIndex}`);
          updateValues.push(passwordHash);
          paramIndex++;
        }

        if (updateData.role !== undefined) {
          if (!['admin', 'supervisor', 'operator'].includes(updateData.role)) {
            throw new Error('Rol inválido');
          }
          updateFields.push(`role = $${paramIndex}`);
          updateValues.push(updateData.role);
          paramIndex++;
        }

        if (updateData.isActive !== undefined) {
          updateFields.push(`is_active = $${paramIndex}`);
          updateValues.push(updateData.isActive);
          paramIndex++;
        }

        if (updateData.profileImage !== undefined) {
          updateFields.push(`profile_image = $${paramIndex}`);
          updateValues.push(updateData.profileImage);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          throw new Error('No hay campos para actualizar');
        }

        // Agregar ID del usuario al final
        updateValues.push(userId);

        // Ejecutar actualización
        const updateQuery = `
          UPDATE users 
          SET ${updateFields.join(', ')} 
          WHERE id = $${paramIndex} 
          RETURNING id, email, name, role, is_active, created_at, last_login, profile_image
        `;

        const updateResult = await client.query(updateQuery, updateValues);
        const updatedUser = updateResult.rows[0];

        console.log(`Usuario actualizado: ${updatedUser.email} por ${updatedBy}`);

        // Convertir a formato User (camelCase)
        return {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          isActive: updatedUser.is_active,
          createdAt: updatedUser.created_at,
          lastLogin: updatedUser.last_login,
          profileImage: updatedUser.profile_image
        };
      } catch (error) {
        console.error('Error actualizando usuario:', error);
        throw error;
      }
    });
  }

  // Desactivar usuario (soft delete)
  async deactivateUser(userId: string, deactivatedBy: string): Promise<User> {
    try {
      // Verificar que el usuario existe y está activo
      const userResult = await query(
        'SELECT id, email, name, role, is_active, created_at, last_login, profile_image FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        throw new Error('El usuario ya está desactivado');
      }

      // Desactivar usuario
      const updateResult = await query(
        'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, email, name, role, is_active, created_at, last_login, profile_image',
        [userId]
      );

      const deactivatedUser = updateResult.rows[0];

      console.log(`Usuario desactivado: ${deactivatedUser.email} por ${deactivatedBy}`);

      // Convertir a formato User (camelCase)
      return {
        id: deactivatedUser.id,
        email: deactivatedUser.email,
        name: deactivatedUser.name,
        role: deactivatedUser.role,
        isActive: deactivatedUser.is_active,
        createdAt: deactivatedUser.created_at,
        lastLogin: deactivatedUser.last_login,
        profileImage: deactivatedUser.profile_image
      };
    } catch (error) {
      console.error('Error desactivando usuario:', error);
      throw error;
    }
  }

  // Reactivar usuario
  async reactivateUser(userId: string, reactivatedBy: string): Promise<User> {
    try {
      // Verificar que el usuario existe y está desactivado
      const userResult = await query(
        'SELECT id, email, name, role, is_active, created_at, last_login, profile_image FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const user = userResult.rows[0];

      if (user.is_active) {
        throw new Error('El usuario ya está activo');
      }

      // Reactivar usuario
      const updateResult = await query(
        'UPDATE users SET is_active = true WHERE id = $1 RETURNING id, email, name, role, is_active, created_at, last_login, profile_image',
        [userId]
      );

      const reactivatedUser = updateResult.rows[0];

      console.log(`Usuario reactivado: ${reactivatedUser.email} por ${reactivatedBy}`);

      // Convertir a formato User (camelCase)
      return {
        id: reactivatedUser.id,
        email: reactivatedUser.email,
        name: reactivatedUser.name,
        role: reactivatedUser.role,
        isActive: reactivatedUser.is_active,
        createdAt: reactivatedUser.created_at,
        lastLogin: reactivatedUser.last_login,
        profileImage: reactivatedUser.profile_image
      };
    } catch (error) {
      console.error('Error reactivando usuario:', error);
      throw error;
    }
  }

  // Listar usuarios con filtros y paginación
  async listUsers(filters: UserFilters = {}, pagination: PaginationOptions = {}): Promise<PaginatedUsers> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = pagination;

      // Construir WHERE clause
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (filters.role !== undefined) {
        whereConditions.push(`role = $${paramIndex}`);
        queryParams.push(filters.role);
        paramIndex++;
      }

      if (filters.isActive !== undefined) {
        whereConditions.push(`is_active = $${paramIndex}`);
        queryParams.push(filters.isActive);
        paramIndex++;
      }

      if (filters.search !== undefined && filters.search.trim() !== '') {
        whereConditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
        queryParams.push(`%${filters.search.trim()}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Validar sortBy
      const validSortFields = ['name', 'email', 'created_at', 'last_login'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Contar total de registros
      const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      const countResult = await query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Calcular offset
      const offset = (page - 1) * limit;

      // Obtener usuarios paginados
      const usersQuery = `
        SELECT id, email, name, role, is_active, created_at, last_login, profile_image 
        FROM users 
        ${whereClause}
        ORDER BY ${sortField} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);

      const usersResult = await query(usersQuery, queryParams);

      // Convertir usuarios a formato camelCase
      const users: User[] = usersResult.rows.map((user: any) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        profileImage: user.profile_image
      }));

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error listando usuarios:', error);
      throw error;
    }
  }

  // Obtener estadísticas de usuarios
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: { admin: number; supervisor: number; operator: number };
  }> {
    try {
      const statsResult = await query(
        `SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
          COUNT(CASE WHEN role = 'supervisor' THEN 1 END) as supervisor_count,
          COUNT(CASE WHEN role = 'operator' THEN 1 END) as operator_count
        FROM users`
      );

      const stats = statsResult.rows[0];

      return {
        total: parseInt(stats.total_users),
        active: parseInt(stats.active_users),
        inactive: parseInt(stats.inactive_users),
        byRole: {
          admin: parseInt(stats.admin_count),
          supervisor: parseInt(stats.supervisor_count),
          operator: parseInt(stats.operator_count)
        }
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de usuarios:', error);
      throw error;
    }
  }

  // Verificar si un usuario puede ser eliminado (no tiene tareas asignadas)
  async canDeleteUser(userId: string): Promise<boolean> {
    try {
      // Verificar si el usuario tiene tareas asignadas
      const tasksResult = await query(
        'SELECT COUNT(*) as task_count FROM tasks WHERE assigned_to = $1',
        [userId]
      );

      const taskCount = parseInt(tasksResult.rows[0].task_count);
      return taskCount === 0;
    } catch (error) {
      console.error('Error verificando si el usuario puede ser eliminado:', error);
      return false;
    }
  }

  // Notificar a un usuario (placeholder para futuras notificaciones)
  async notifyUser(userId: string, message: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    try {
      // Por ahora solo registramos en logs
      // En el futuro se podría implementar un sistema de notificaciones real
      console.log(`[NOTIFICATION] Usuario ${userId} - ${type.toUpperCase()}: ${message}`);
      
      // Aquí se podría:
      // 1. Guardar la notificación en base de datos
      // 2. Enviar email
      // 3. Enviar notificación push
      // 4. Crear entrada en sistema de mensajería
    } catch (error) {
      console.error('Error enviando notificación:', error);
      throw error;
    }
  }
}
