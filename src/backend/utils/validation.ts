import { ValidationError } from '../middleware/errorHandler.js';

// Tipos para validación
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'date' | 'uuid';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

// Patrones de validación comunes
export const VALIDATION_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  phone: /^\+?[\d\s\-\(\)]{10,}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s\-_\.]+$/
};

/**
 * Sanitiza una cadena removiendo caracteres peligrosos
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remover < y > para prevenir XSS básico
    .replace(/[\x00-\x1f\x7f]/g, '') // Remover caracteres de control
    .replace(/\s+/g, ' '); // Normalizar espacios en blanco
}

/**
 * Sanitiza un objeto removiendo propiedades peligrosas
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = { ...obj } as any;
  
  // Remover propiedades que podrían ser peligrosas
  const dangerousProps = ['__proto__', 'constructor', 'prototype'];
  dangerousProps.forEach(prop => {
    delete sanitized[prop];
  });

  // Sanitizar strings recursivamente
  Object.keys(sanitized).forEach(key => {
    const value = sanitized[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    }
  });

  return sanitized as T;
}

/**
 * Valida un valor contra una regla de validación
 */
export function validateValue(value: any, rule: ValidationRule, fieldName: string): string | null {
  // Verificar si es requerido
  if (rule.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} es requerido`;
  }

  // Si no es requerido y está vacío, no validar más
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return null;
  }

  // Validar tipo
  if (rule.type) {
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${fieldName} debe ser una cadena de texto`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `${fieldName} debe ser un número válido`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `${fieldName} debe ser verdadero o falso`;
        }
        break;
      case 'email':
        if (typeof value !== 'string' || !VALIDATION_PATTERNS.email.test(value)) {
          return `${fieldName} debe ser un email válido`;
        }
        break;
      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return `${fieldName} debe ser una fecha válida`;
        }
        break;
      case 'uuid':
        if (typeof value !== 'string' || !VALIDATION_PATTERNS.uuid.test(value)) {
          return `${fieldName} debe ser un UUID válido`;
        }
        break;
    }
  }

  // Validar longitud para strings
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) {
      return `${fieldName} debe tener al menos ${rule.minLength} caracteres`;
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return `${fieldName} no puede tener más de ${rule.maxLength} caracteres`;
    }
  }

  // Validar rango para números
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return `${fieldName} debe ser mayor o igual a ${rule.min}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return `${fieldName} debe ser menor o igual a ${rule.max}`;
    }
  }

  // Validar patrón
  if (rule.pattern && typeof value === 'string') {
    if (!rule.pattern.test(value)) {
      return `${fieldName} tiene un formato inválido`;
    }
  }

  // Validar enum
  if (rule.enum && !rule.enum.includes(value)) {
    return `${fieldName} debe ser uno de: ${rule.enum.join(', ')}`;
  }

  // Validación personalizada
  if (rule.custom) {
    const customResult = rule.custom(value);
    if (customResult !== true) {
      return typeof customResult === 'string' ? customResult : `${fieldName} no es válido`;
    }
  }

  return null;
}

/**
 * Valida un objeto contra un schema de validación
 */
export function validateSchema(data: any, schema: ValidationSchema): void {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Los datos deben ser un objeto válido');
  }

  const errors: string[] = [];

  // Validar cada campo del schema
  Object.keys(schema).forEach(fieldName => {
    const rule = schema[fieldName];
    const value = data[fieldName];
    
    const error = validateValue(value, rule, fieldName);
    if (error) {
      errors.push(error);
    }
  });

  // Si hay errores, lanzar excepción
  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '));
  }
}

/**
 * Middleware para validar el cuerpo de la request
 */
export function validateRequestBody(schema: ValidationSchema) {
  return async (c: any, next: any) => {
    try {
      const body = await c.req.json();
      const sanitizedBody = sanitizeObject(body);
      
      validateSchema(sanitizedBody, schema);
      
      // Almacenar el cuerpo sanitizado para uso posterior
      c.set('validatedBody', sanitizedBody);
      
      await next();
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Formato de datos inválido');
    }
  };
}

/**
 * Middleware para validar parámetros de query
 */
export function validateQueryParams(schema: ValidationSchema) {
  return async (c: any, next: any) => {
    const query = c.req.query();
    const sanitizedQuery = sanitizeObject(query);
    
    validateSchema(sanitizedQuery, schema);
    
    // Almacenar los parámetros sanitizados
    c.set('validatedQuery', sanitizedQuery);
    
    await next();
  };
}

/**
 * Middleware para validar parámetros de ruta
 */
export function validatePathParams(schema: ValidationSchema) {
  return async (c: any, next: any) => {
    const params: Record<string, string> = {};
    
    // Extraer parámetros de la ruta
    Object.keys(schema).forEach(paramName => {
      params[paramName] = c.req.param(paramName);
    });
    
    const sanitizedParams = sanitizeObject(params);
    validateSchema(sanitizedParams, schema);
    
    // Almacenar los parámetros sanitizados
    c.set('validatedParams', sanitizedParams);
    
    await next();
  };
}

/**
 * Schemas de validación comunes
 */
export const COMMON_SCHEMAS = {
  // Paginación
  pagination: {
    page: { type: 'number' as const, min: 1 },
    limit: { type: 'number' as const, min: 1, max: 100 },
    sortBy: { type: 'string' as const, maxLength: 50 },
    sortOrder: { type: 'string' as const, enum: ['asc', 'desc'] }
  },

  // ID de usuario
  userId: {
    id: { required: true, type: 'uuid' as const }
  },

  // Filtros de fecha
  dateRange: {
    startDate: { type: 'date' as const },
    endDate: { type: 'date' as const }
  },

  // Credenciales de login
  loginCredentials: {
    email: { required: true, type: 'email' as const, maxLength: 255 },
    password: { required: true, type: 'string' as const, minLength: 8, maxLength: 128 }
  },

  // Cambio de contraseña
  changePassword: {
    currentPassword: { required: true, type: 'string' as const, minLength: 8, maxLength: 128 },
    newPassword: { 
      required: true, 
      type: 'string' as const, 
      minLength: 8, 
      maxLength: 128,
      pattern: VALIDATION_PATTERNS.password,
      custom: (value: string) => {
        if (!VALIDATION_PATTERNS.password.test(value)) {
          return 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y símbolos';
        }
        return true;
      }
    }
  }
};

/**
 * Utilidades para validación específica de dominio
 */
export const DOMAIN_VALIDATORS = {
  /**
   * Valida que un email no esté en una lista de dominios bloqueados
   */
  emailDomainAllowed: (email: string): boolean => {
    const blockedDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return !blockedDomains.includes(domain);
  },

  /**
   * Valida que una fecha esté en el futuro
   */
  futureDate: (date: string | Date): boolean => {
    const inputDate = new Date(date);
    const now = new Date();
    return inputDate > now;
  },

  /**
   * Valida que una fecha esté dentro de un rango razonable
   */
  reasonableDateRange: (date: string | Date): boolean => {
    const inputDate = new Date(date);
    const now = new Date();
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    return inputDate >= oneYearAgo && inputDate <= oneYearFromNow;
  },

  /**
   * Valida que un texto no contenga contenido potencialmente malicioso
   */
  safeText: (text: string): boolean => {
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];
    
    return !maliciousPatterns.some(pattern => pattern.test(text));
  }
};

/**
 * Función helper para crear validadores personalizados
 */
export function createCustomValidator(
  validatorFn: (value: any) => boolean | string,
  errorMessage?: string
) {
  return (value: any) => {
    const result = validatorFn(value);
    if (result === true) {
      return true;
    }
    return typeof result === 'string' ? result : (errorMessage || 'Valor inválido');
  };
}

/**
 * Función para validar y sanitizar datos de entrada de forma segura
 */
export function secureValidateAndSanitize<T>(
  data: any,
  schema: ValidationSchema
): T {
  try {
    // Primero sanitizar
    const sanitized = sanitizeObject(data);
    
    // Luego validar
    validateSchema(sanitized, schema);
    
    return sanitized as T;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Error al procesar los datos de entrada');
  }
}
