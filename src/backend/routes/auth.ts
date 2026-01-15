import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AuthService } from '../services/AuthService.js';
import { authMiddleware } from '../middleware/auth.js';
import { LoginCredentials, CreateUserRequest } from '../models/User.js';
import { secureLogger } from '../utils/secureLogger.js';

const authRoutes = new Hono();
const authService = new AuthService();

/**
 * POST /auth/login
 * Iniciar sesión
 */
authRoutes.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  
  try {
    const body = await c.req.json();
    
    // Validar datos de entrada
    if (!body.email || !body.password) {
      throw new HTTPException(400, { message: 'Email y contraseña son requeridos' });
    }

    const credentials: LoginCredentials = {
      email: body.email,
      password: body.password
    };

    secureLogger.info('Intento de inicio de sesión', {
      metadata: {
        email: body.email,
        ip
      }
    });

    const authResponse = await authService.login(credentials);

    secureLogger.audit('Inicio de sesión exitoso', {
      metadata: {
        userId: (authResponse.user as any).userId,
        email: body.email,
        ip
      }
    });

    return c.json({
      success: true,
      data: authResponse,
      message: 'Inicio de sesión exitoso'
    });
  } catch (error) {
    if (error instanceof Error) {
      // Log de seguridad para intentos fallidos
      secureLogger.security('Intento de inicio de sesión fallido', {
        metadata: {
          error: error.message,
          ip
        }
      });

      // Manejar errores específicos de autenticación
      if (error.message.includes('Credenciales inválidas') || 
          error.message.includes('Cuenta desactivada') ||
          error.message.includes('Formato de email inválido') ||
          error.message.includes('contraseña es requerida')) {
        throw new HTTPException(401, { message: error.message });
      }
    }

    secureLogger.error('Error interno en login', {
      metadata: {
        error: (error as Error).message,
        ip
      }
    });
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /auth/register
 * Registrar nuevo usuario
 */
authRoutes.post('/register', async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  let body: any;
  
  try {
    body = await c.req.json();
    
    // Validar datos de entrada
    if (!body.email || !body.password || !body.name) {
      throw new HTTPException(400, { message: 'Email, contraseña y nombre son requeridos' });
    }

    const userData: CreateUserRequest = {
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role || 'operator' // Por defecto operador
    };

    secureLogger.info('Intento de registro de usuario', {
      metadata: {
        email: body.email,
        role: userData.role,
        ip
      }
    });

    const newUser = await authService.register(userData, 'system');

    secureLogger.audit('Usuario registrado exitosamente', {
      metadata: {
        userId: newUser.id,
        email: body.email,
        role: userData.role,
        ip
      }
    });

    return c.json({
      success: true,
      data: newUser,
      message: 'Usuario registrado exitosamente'
    });
  } catch (error) {
    if (error instanceof Error) {
      // Log de seguridad para intentos fallidos
      secureLogger.security('Intento de registro fallido', {
        metadata: {
          error: error.message,
          email: body?.email,
          ip
        }
      });

      // Manejar errores específicos de registro
      if (error.message.includes('email ya está registrado') || 
          error.message.includes('Formato de email inválido') ||
          error.message.includes('nombre es requerido') ||
          error.message.includes('contraseña debe tener')) {
        throw new HTTPException(400, { message: error.message });
      }
    }

    secureLogger.error('Error interno en registro', {
      metadata: {
        error: (error as Error).message,
        ip
      }
    });
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /auth/refresh
 * Renovar token de acceso
 */
authRoutes.post('/refresh', async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  
  try {
    const body = await c.req.json();
    
    if (!body.refreshToken) {
      throw new HTTPException(400, { message: 'Refresh token requerido' });
    }

    const authResponse = await authService.refreshToken(body.refreshToken);

    secureLogger.audit('Token renovado exitosamente', {
      metadata: {
        userId: (authResponse.user as any).userId,
        ip
      }
    });

    return c.json({
      success: true,
      data: authResponse,
      message: 'Token renovado exitosamente'
    });
  } catch (error) {
    if (error instanceof Error) {
      secureLogger.security('Intento de renovación de token fallido', {
        metadata: {
          error: error.message,
          ip
        }
      });

      if (error.message.includes('Token inválido') || 
          error.message.includes('Usuario no encontrado') ||
          error.message.includes('Cuenta desactivada')) {
        throw new HTTPException(401, { message: error.message });
      }
    }

    secureLogger.error('Error interno renovando token', {
      metadata: {
        error: (error as Error).message,
        ip
      }
    });
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /auth/logout
 * Cerrar sesión
 */
authRoutes.post('/logout', authMiddleware, async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  
  try {
    const user = c.get('user');
    
    await authService.logout(user.userId);

    secureLogger.audit('Sesión cerrada exitosamente', {
      metadata: {
        userId: user.userId,
        ip
      }
    });

    return c.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    secureLogger.error('Error en logout', {
      metadata: {
        error: (error as Error).message,
        userId: c.get('user')?.userId,
        ip
      }
    });
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * GET /auth/me
 * Obtener información del usuario autenticado
 */
authRoutes.get('/me', authMiddleware, async (c) => {
  try {
    const userSession = c.get('user');
    
    const user = await authService.getUserById(userSession.userId);
    
    if (!user) {
      throw new HTTPException(404, { message: 'Usuario no encontrado' });
    }

    return c.json({
      success: true,
      data: user,
      message: 'Información de usuario obtenida exitosamente'
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    
    secureLogger.error('Error obteniendo información de usuario', {
      metadata: {
        error: (error as Error).message,
        userId: c.get('user')?.userId
      }
    });
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /auth/change-password
 * Cambiar contraseña del usuario autenticado
 */
authRoutes.post('/change-password', authMiddleware, async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  
  try {
    const user = c.get('user');
    const body = await c.req.json();
    
    if (!body.currentPassword || !body.newPassword) {
      throw new HTTPException(400, { message: 'Contraseña actual y nueva contraseña son requeridas' });
    }

    await authService.changePassword(user.userId, body.currentPassword, body.newPassword);

    secureLogger.audit('Contraseña cambiada exitosamente', {
      metadata: {
        userId: user.userId,
        ip
      }
    });

    return c.json({
      success: true,
      message: 'Contraseña cambiada exitosamente'
    });
  } catch (error) {
    if (error instanceof Error) {
      secureLogger.security('Intento de cambio de contraseña fallido', {
        metadata: {
          userId: c.get('user')?.userId,
          error: error.message,
          ip
        }
      });

      if (error.message.includes('Contraseña actual incorrecta')) {
        throw new HTTPException(400, { message: error.message });
      }
      if (error.message.includes('debe tener al menos')) {
        throw new HTTPException(400, { message: error.message });
      }
      if (error.message.includes('Usuario no encontrado')) {
        throw new HTTPException(404, { message: error.message });
      }
    }

    secureLogger.error('Error interno cambiando contraseña', {
      metadata: {
        error: (error as Error).message,
        userId: c.get('user')?.userId,
        ip
      }
    });
    throw new HTTPException(500, { message: 'Error interno del servidor' });
  }
});

/**
 * POST /auth/validate-token
 * Validar token de acceso
 */
authRoutes.post('/validate-token', async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  
  try {
    const body = await c.req.json();
    
    if (!body.token) {
      throw new HTTPException(400, { message: 'Token requerido' });
    }

    const userSession = await authService.validateToken(body.token);

    return c.json({
      success: true,
      data: { valid: true, user: userSession },
      message: 'Token válido'
    });
  } catch (error) {
    secureLogger.security('Validación de token fallida', {
      metadata: {
        error: (error as Error).message,
        ip
      }
    });

    // Para validación de token, devolver respuesta específica sin lanzar excepción
    return c.json({
      success: false,
      data: { valid: false },
      message: 'Token inválido o expirado'
    }, 401);
  }
});

export default authRoutes;
