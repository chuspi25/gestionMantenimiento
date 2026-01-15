import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AuthService } from '../services/AuthService.js';
import { validateAuthHeader } from '../utils/auth.js';
import { UserSession } from '../models/User.js';

// Extender el contexto de Hono para incluir información del usuario
declare module 'hono' {
  interface ContextVariableMap {
    user: UserSession;
  }
}

// Instancia del servicio de autenticación
const authService = new AuthService();

/**
 * Middleware de autenticación JWT
 * Valida el token de autorización y establece la información del usuario en el contexto
 */
export async function authMiddleware(c: Context, next: Next) {
  try {
    // Obtener header de autorización
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader) {
      throw new HTTPException(401, { message: 'Token de autorización requerido' });
    }

    // Validar token y obtener sesión de usuario
    const userSession = validateAuthHeader(authHeader);
    
    if (!userSession) {
      throw new HTTPException(401, { message: 'Token inválido o expirado' });
    }

    // Verificar que el usuario aún existe y está activo en la base de datos
    const validatedSession = await authService.validateToken(
      authHeader.replace('Bearer ', '')
    );

    // Establecer información del usuario en el contexto
    c.set('user', validatedSession);
    
    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    
    console.error('Error en middleware de autenticación:', error);
    throw new HTTPException(401, { message: 'Error de autenticación' });
  }
}

/**
 * Middleware de autorización basado en roles
 * Verifica que el usuario tenga el rol requerido o superior
 */
export function requireRole(requiredRole: 'admin' | 'supervisor' | 'operator') {
  return async (c: Context, next: Next) => {
    try {
      // Obtener información del usuario del contexto (debe ejecutarse después de authMiddleware)
      const user = c.get('user');
      
      if (!user) {
        throw new HTTPException(401, { message: 'Usuario no autenticado' });
      }

      // Verificar permisos usando el servicio de autenticación
      const hasPermission = await authService.hasPermission(user.userId, requiredRole);
      
      if (!hasPermission) {
        throw new HTTPException(403, { 
          message: `Acceso denegado. Se requiere rol: ${requiredRole}` 
        });
      }

      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      
      console.error('Error en middleware de autorización:', error);
      throw new HTTPException(403, { message: 'Error de autorización' });
    }
  };
}

/**
 * Middleware para verificar que el usuario puede acceder a un recurso específico
 * Permite acceso si es admin, supervisor (para recursos sin dueño), o dueño del recurso
 */
export function requireResourceAccess(getResourceOwnerId?: (c: Context) => string | undefined) {
  return async (c: Context, next: Next) => {
    try {
      const user = c.get('user');
      
      if (!user) {
        throw new HTTPException(401, { message: 'Usuario no autenticado' });
      }

      // Los administradores tienen acceso completo
      if (user.role === 'admin') {
        await next();
        return;
      }

      // Obtener ID del dueño del recurso si se proporciona la función
      const resourceOwnerId = getResourceOwnerId ? getResourceOwnerId(c) : undefined;

      // Los supervisores pueden acceder a recursos sin dueño específico
      if (user.role === 'supervisor' && !resourceOwnerId) {
        await next();
        return;
      }

      // Verificar si el usuario es dueño del recurso
      if (resourceOwnerId && user.userId === resourceOwnerId) {
        await next();
        return;
      }

      throw new HTTPException(403, { 
        message: 'No tienes permisos para acceder a este recurso' 
      });
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      
      console.error('Error en middleware de acceso a recurso:', error);
      throw new HTTPException(403, { message: 'Error de autorización' });
    }
  };
}

/**
 * Middleware opcional de autenticación
 * Establece información del usuario si está presente, pero no requiere autenticación
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader) {
      const userSession = validateAuthHeader(authHeader);
      
      if (userSession) {
        // Verificar que el usuario aún existe y está activo
        try {
          const validatedSession = await authService.validateToken(
            authHeader.replace('Bearer ', '')
          );
          c.set('user', validatedSession);
        } catch (error) {
          // Si hay error validando el token, continuar sin usuario
          console.warn('Token inválido en middleware opcional:', error);
        }
      }
    }
    
    await next();
  } catch (error) {
    console.error('Error en middleware de autenticación opcional:', error);
    await next();
  }
}

/**
 * Middleware para verificar que el usuario está activo
 */
export async function requireActiveUser(c: Context, next: Next) {
  try {
    const user = c.get('user');
    
    if (!user) {
      throw new HTTPException(401, { message: 'Usuario no autenticado' });
    }

    if (!user.isActive) {
      throw new HTTPException(403, { message: 'Cuenta desactivada' });
    }

    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    
    console.error('Error verificando usuario activo:', error);
    throw new HTTPException(403, { message: 'Error de verificación de usuario' });
  }
}

/**
 * Middleware para logging de acceso autenticado
 */
export async function logAuthenticatedAccess(c: Context, next: Next) {
  const user = c.get('user');
  const method = c.req.method;
  const path = c.req.path;
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  
  if (user) {
    console.log(`[AUTH] ${user.email} (${user.role}) - ${method} ${path} - ${userAgent}`);
  }
  
  await next();
}
