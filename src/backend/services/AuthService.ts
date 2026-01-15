import { query, transaction } from '../utils/database.js';
import { createPasswordHash, verifyCredentials, generateAuthResponse, isValidEmail } from '../utils/auth.js';
import { validateToken } from '../utils/jwt.js';
import { 
  User, 
  CreateUserRequest, 
  LoginCredentials, 
  AuthResponse, 
  UserSession 
} from '../models/User.js';

export class AuthService {
  // Iniciar sesión
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validar formato de email
      if (!isValidEmail(credentials.email)) {
        throw new Error('Formato de email inválido');
      }

      // Validar que la contraseña no esté vacía
      if (!credentials.password || credentials.password.trim().length === 0) {
        throw new Error('La contraseña es requerida');
      }

      // Buscar usuario por email
      const userResult = await query(
        'SELECT id, email, name, password_hash, role, is_active, created_at, last_login FROM users WHERE email = $1',
        [credentials.email]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Credenciales inválidas');
      }

      const user = userResult.rows[0];

      // Verificar que el usuario esté activo
      if (!user.is_active) {
        throw new Error('Cuenta desactivada');
      }

      // Verificar contraseña
      const isPasswordValid = await verifyCredentials(credentials.password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Credenciales inválidas');
      }

      // Actualizar último login
      await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Crear sesión de usuario
      const userSession: UserSession = {
        userId: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active
      };

      // Generar respuesta de autenticación
      const authResponse = generateAuthResponse(userSession);
      authResponse.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLogin: new Date()
      };

      return authResponse;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  // Validar token y obtener sesión de usuario
  async validateToken(token: string): Promise<UserSession> {
    try {
      // Validar formato del token
      const decoded = validateToken(token);
      if (!decoded) {
        throw new Error('Token inválido');
      }

      // Verificar que el usuario aún existe y está activo
      const userResult = await query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const user = userResult.rows[0];

      // Verificar que el usuario esté activo
      if (!user.is_active) {
        throw new Error('Cuenta desactivada');
      }

      // Verificar que los datos del token coincidan con la base de datos
      if (user.email !== decoded.email || user.role !== decoded.role) {
        throw new Error('Token desactualizado');
      }

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active
      };
    } catch (error) {
      console.error('Error validando token:', error);
      throw error;
    }
  }

  // Renovar token usando refresh token
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Validar refresh token
      const decoded = validateToken(refreshToken);
      if (!decoded || decoded.type !== 'refresh') {
        throw new Error('Refresh token inválido');
      }

      // Verificar que el usuario aún existe y está activo
      const userResult = await query(
        'SELECT id, email, name, role, is_active, created_at, last_login FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        throw new Error('Cuenta desactivada');
      }

      // Crear nueva sesión
      const userSession: UserSession = {
        userId: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active
      };

      // Generar nuevos tokens
      const authResponse = generateAuthResponse(userSession);
      authResponse.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLogin: user.last_login
      };

      return authResponse;
    } catch (error) {
      console.error('Error renovando token:', error);
      throw error;
    }
  }

  // Cerrar sesión (logout)
  async logout(userId: string): Promise<void> {
    try {
      // En una implementación más compleja, aquí podríamos:
      // 1. Invalidar tokens en una blacklist
      // 2. Limpiar sesiones activas
      // 3. Registrar el evento de logout
      
      // Por ahora, solo registramos el evento
      console.log(`Usuario ${userId} cerró sesión`);
      
      // Opcional: Actualizar timestamp de último logout
      await query(
        'UPDATE users SET last_login = last_login WHERE id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Error en logout:', error);
      throw error;
    }
  }

  // Registrar nuevo usuario (solo para administradores)
  async register(userData: CreateUserRequest, createdBy: string): Promise<User> {
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

        // Verificar que el email no esté en uso
        const existingUserResult = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [userData.email]
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
          [userData.email, userData.name.trim(), passwordHash, userData.role, true]
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
        console.error('Error registrando usuario:', error);
        throw error;
      }
    });
  }

  // Cambiar contraseña
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Obtener usuario actual
      const userResult = await query(
        'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const user = userResult.rows[0];

      // Verificar contraseña actual
      const isCurrentPasswordValid = await verifyCredentials(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Validar nueva contraseña
      if (!newPassword || newPassword.length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
      }

      // Hash de la nueva contraseña
      const newPasswordHash = await createPasswordHash(newPassword);

      // Actualizar contraseña
      await query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, userId]
      );

      console.log(`Contraseña cambiada para usuario ${userId}`);
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      throw error;
    }
  }

  // Obtener información del usuario por ID
  async getUserById(userId: string): Promise<User | null> {
    try {
      const userResult = await query(
        'SELECT id, email, name, role, is_active, created_at, last_login FROM users WHERE id = $1',
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
        lastLogin: user.last_login
      };
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      throw error;
    }
  }

  // Verificar si un usuario tiene permisos específicos
  async hasPermission(userId: string, requiredRole: string): Promise<boolean> {
    try {
      const userResult = await query(
        'SELECT role FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return false;
      }

      const user = userResult.rows[0];
      
      // Jerarquía de roles: admin > supervisor > operator
      const roleHierarchy = {
        'admin': 3,
        'supervisor': 2,
        'operator': 1
      };

      const userLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
      const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

      return userLevel >= requiredLevel;
    } catch (error) {
      console.error('Error verificando permisos:', error);
      return false;
    }
  }
}
