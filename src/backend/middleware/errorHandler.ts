import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureLogger } from '../utils/secureLogger.js';

// Tipos de errores personalizados
export class ValidationError extends Error {
  public statusCode: number = 400;
  public code: string = 'VALIDATION_ERROR';
  
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  public statusCode: number = 401;
  public code: string = 'AUTHENTICATION_ERROR';
  
  constructor(message: string = 'No autorizado') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  public statusCode: number = 403;
  public code: string = 'AUTHORIZATION_ERROR';
  
  constructor(message: string = 'Acceso denegado') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  public statusCode: number = 404;
  public code: string = 'NOT_FOUND_ERROR';
  
  constructor(message: string = 'Recurso no encontrado') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  public statusCode: number = 409;
  public code: string = 'CONFLICT_ERROR';
  
  constructor(message: string = 'Conflicto con el estado actual del recurso') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends Error {
  public statusCode: number = 500;
  public code: string = 'DATABASE_ERROR';
  
  constructor(message: string = 'Error de base de datos') {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends Error {
  public statusCode: number = 502;
  public code: string = 'EXTERNAL_SERVICE_ERROR';
  
  constructor(message: string = 'Error en servicio externo') {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

// Interfaz para respuesta de error estandarizada
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    timestamp: string;
    requestId?: string;
  };
  details?: any;
}

/**
 * Sanitiza el mensaje de error para evitar exposición de información sensible
 */
function sanitizeErrorMessage(error: Error): string {
  // Lista de patrones que no deben exponerse al cliente
  const sensitivePatterns = [
    /password/gi,
    /token/gi,
    /secret/gi,
    /key/gi,
    /connection string/gi,
    /database/gi,
    /internal/gi,
    /stack trace/gi
  ];

  let message = error.message;

  // En producción, sanitizar mensajes que puedan contener información sensible
  if (process.env.NODE_ENV === 'production') {
    const containsSensitiveInfo = sensitivePatterns.some(pattern => 
      pattern.test(message)
    );

    if (containsSensitiveInfo) {
      // Mapear a mensajes genéricos seguros
      if (error instanceof DatabaseError) {
        return 'Error interno del servidor';
      }
      if (error instanceof AuthenticationError) {
        return 'Credenciales inválidas';
      }
      if (error instanceof ValidationError) {
        return 'Datos de entrada inválidos';
      }
      return 'Error interno del servidor';
    }
  }

  return message;
}

/**
 * Determina si el error debe ser loggeado como crítico
 */
function isCriticalError(error: Error): boolean {
  return (
    error instanceof DatabaseError ||
    error instanceof ExternalServiceError ||
    (error instanceof Error && error.message.includes('ECONNREFUSED')) ||
    (error instanceof Error && error.message.includes('timeout'))
  );
}

/**
 * Extrae información del contexto de la request para logging
 */
function extractRequestContext(c: Context): {
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  requestId?: string;
} {
  const headers = c.req.header();
  const user = c.get('user');
  
  return {
    method: c.req.method,
    url: c.req.url,
    userAgent: headers['user-agent'],
    ip: headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown',
    userId: user?.userId,
    requestId: c.get('requestId') || headers['x-request-id']
  };
}

/**
 * Middleware principal de manejo de errores
 */
export const errorHandler = async (err: Error, c: Context): Promise<Response> => {
  const requestContext = extractRequestContext(c);
  const timestamp = new Date().toISOString();
  
  // Determinar código de estado y tipo de error
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  
  if (err instanceof HTTPException) {
    statusCode = err.status;
    errorCode = `HTTP_${err.status}`;
  } else if (err instanceof ValidationError) {
    statusCode = err.statusCode;
    errorCode = err.code;
  } else if (err instanceof AuthenticationError) {
    statusCode = err.statusCode;
    errorCode = err.code;
  } else if (err instanceof AuthorizationError) {
    statusCode = err.statusCode;
    errorCode = err.code;
  } else if (err instanceof NotFoundError) {
    statusCode = err.statusCode;
    errorCode = err.code;
  } else if (err instanceof ConflictError) {
    statusCode = err.statusCode;
    errorCode = err.code;
  } else if (err instanceof DatabaseError) {
    statusCode = err.statusCode;
    errorCode = err.code;
  } else if (err instanceof ExternalServiceError) {
    statusCode = err.statusCode;
    errorCode = err.code;
  }

  // Sanitizar mensaje de error
  const sanitizedMessage = sanitizeErrorMessage(err);

  // Preparar respuesta de error
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: sanitizedMessage,
      field: (err as ValidationError).field,
      timestamp,
      requestId: requestContext.requestId
    }
  };

  // En desarrollo, incluir detalles adicionales
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      stack: err.stack,
      originalMessage: err.message
    };
  }

  // Logging del error
  const logContext = {
    ...requestContext,
    errorCode,
    statusCode,
    errorName: err.name,
    originalMessage: err.message,
    stack: err.stack
  };

  if (isCriticalError(err)) {
    secureLogger.error(`Error crítico: ${err.message}`, logContext);
  } else if (statusCode >= 500) {
    secureLogger.error(`Error del servidor: ${err.message}`, logContext);
  } else if (statusCode >= 400) {
    secureLogger.warn(`Error del cliente: ${err.message}`, logContext);
  } else {
    secureLogger.info(`Error manejado: ${err.message}`, logContext);
  }

  // Log de seguridad para errores de autenticación/autorización
  if (err instanceof AuthenticationError || err instanceof AuthorizationError) {
    secureLogger.security(`Intento de acceso no autorizado: ${err.message}`, {
      ...requestContext,
      metadata: { errorType: err.name }
    });
  }

  return c.json(errorResponse, statusCode as any);
};

/**
 * Middleware para capturar errores no manejados
 */
export const globalErrorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (err) {
    return errorHandler(err as Error, c);
  }
};

/**
 * Middleware para validar que la respuesta tenga el formato correcto
 */
export const responseValidator = async (c: Context, next: Next) => {
  await next();
  
  // Verificar que las respuestas exitosas tengan el formato estándar
  if (c.res.status >= 200 && c.res.status < 300) {
    try {
      const contentType = c.res.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        // En desarrollo, validar estructura de respuesta
        if (process.env.NODE_ENV === 'development') {
          const responseText = await c.res.clone().text();
          if (responseText) {
            const responseData = JSON.parse(responseText);
            
            // Verificar que tenga la estructura esperada
            if (typeof responseData === 'object' && responseData !== null) {
              if (!responseData.hasOwnProperty('success')) {
                secureLogger.warn('Respuesta sin campo success', {
                  metadata: {
                    url: c.req.url,
                    method: c.req.method,
                    status: c.res.status
                  }
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Error al validar respuesta, no interrumpir el flujo
      secureLogger.debug('Error validando formato de respuesta', {
        metadata: {
          error: (error as Error).message,
          url: c.req.url
        }
      });
    }
  }
};

/**
 * Middleware para generar ID único de request
 */
export const requestIdMiddleware = async (c: Context, next: Next) => {
  const requestId = c.req.header('x-request-id') || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  
  await next();
};

/**
 * Middleware para timeout de requests
 */
export const timeoutMiddleware = (timeoutMs: number = 30000) => {
  return async (c: Context, next: Next) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout después de ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      await Promise.race([next(), timeoutPromise]);
    } catch (error) {
      if ((error as Error).message.includes('timeout')) {
        secureLogger.warn('Request timeout', {
          metadata: {
            url: c.req.url,
            method: c.req.method,
            timeout: timeoutMs,
            requestId: c.get('requestId')
          }
        });
        
        throw new Error('La solicitud ha excedido el tiempo límite');
      }
      throw error;
    }
  };
};

/**
 * Middleware para rate limiting básico
 */
export const rateLimitMiddleware = (maxRequests: number = 100, windowMs: number = 60000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') || 
               c.req.header('x-real-ip') || 
               'unknown';
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Limpiar entradas expiradas
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }
    
    const current = requests.get(ip) || { count: 0, resetTime: now + windowMs };
    
    if (current.count >= maxRequests && current.resetTime > now) {
      secureLogger.security('Rate limit excedido', {
        metadata: {
          ip,
          count: current.count,
          maxRequests,
          url: c.req.url,
          method: c.req.method
        }
      });
      
      throw new Error('Demasiadas solicitudes. Intente nuevamente más tarde.');
    }
    
    current.count++;
    requests.set(ip, current);
    
    await next();
  };
};

/**
 * Funciones de utilidad para lanzar errores específicos
 */
export const throwValidationError = (message: string, field?: string): never => {
  throw new ValidationError(message, field);
};

export const throwAuthenticationError = (message?: string): never => {
  throw new AuthenticationError(message);
};

export const throwAuthorizationError = (message?: string): never => {
  throw new AuthorizationError(message);
};

export const throwNotFoundError = (message?: string): never => {
  throw new NotFoundError(message);
};

export const throwConflictError = (message?: string): never => {
  throw new ConflictError(message);
};

export const throwDatabaseError = (message?: string): never => {
  throw new DatabaseError(message);
};

export const throwExternalServiceError = (message?: string): never => {
  throw new ExternalServiceError(message);
};
