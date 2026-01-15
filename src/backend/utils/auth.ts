// Utilidades de autenticación que combinan JWT y bcrypt
import { hashPassword, comparePassword, validatePasswordStrength } from './bcrypt.js';
import { generateTokenPair, validateRefreshToken, getUserFromToken, extractTokenFromHeader } from './jwt.js';
import { UserSession, AuthResponse } from '../models/User.js';

// Interfaz para credenciales de login
export interface LoginCredentials {
  email: string;
  password: string;
}

// Resultado de autenticación
export interface AuthResult {
  success: boolean;
  user?: UserSession;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  error?: string;
}

// Crear hash de contraseña para nuevo usuario
export async function createPasswordHash(password: string): Promise<string> {
  // Validar fortaleza de contraseña
  const validation = validatePasswordStrength(password);
  if (!validation.isValid) {
    throw new Error(`Contraseña inválida: ${validation.errors.join(', ')}`);
  }

  // Crear hash
  return await hashPassword(password);
}

// Verificar credenciales de login
export async function verifyCredentials(password: string, hashedPassword: string): Promise<boolean> {
  return await comparePassword(password, hashedPassword);
}

// Generar respuesta de autenticación completa
export function generateAuthResponse(userSession: UserSession): AuthResponse {
  const tokens = generateTokenPair(userSession);
  
  return {
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: userSession.userId,
      email: userSession.email,
      name: '', // Se llenará desde la base de datos
      role: userSession.role,
      isActive: userSession.isActive,
      createdAt: new Date(), // Se llenará desde la base de datos
    },
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  };
}

// Validar token de autorización desde header
export function validateAuthHeader(authHeader: string | undefined): UserSession | null {
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return null;
  }

  return getUserFromToken(token);
}

// Renovar token usando refresh token
export function refreshAccessToken(refreshToken: string): { accessToken: string } | null {
  const decoded = validateRefreshToken(refreshToken);
  if (!decoded) {
    return null;
  }

  const userSession: UserSession = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    isActive: decoded.isActive
  };

  const tokens = generateTokenPair(userSession);
  return { accessToken: tokens.accessToken };
}

// Verificar permisos de rol
export function hasPermission(userRole: string, requiredRole: string | string[]): boolean {
  const roleHierarchy = {
    'admin': 3,
    'supervisor': 2,
    'operator': 1
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy];
  
  // Si el rol del usuario no es válido, denegar acceso
  if (userLevel === undefined) {
    return false;
  }

  if (Array.isArray(requiredRole)) {
    // Si el array está vacío, denegar acceso
    if (requiredRole.length === 0) {
      return false;
    }
    
    return requiredRole.some(role => {
      const requiredLevel = roleHierarchy[role as keyof typeof roleHierarchy];
      // Solo permitir acceso si el rol requerido es válido y el usuario tiene suficiente nivel
      return requiredLevel !== undefined && userLevel >= requiredLevel;
    });
  } else {
    // Si el rol requerido es string vacío o inválido, denegar acceso
    if (!requiredRole || requiredRole.trim() === '') {
      return false;
    }
    
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy];
    // Solo permitir acceso si el rol requerido es válido y el usuario tiene suficiente nivel
    return requiredLevel !== undefined && userLevel >= requiredLevel;
  }
}

// Verificar si el usuario puede acceder a un recurso específico
export function canAccessResource(userSession: UserSession, resourceOwnerId?: string): boolean {
  // Los administradores pueden acceder a todo
  if (userSession.role === 'admin') {
    return true;
  }

  // Los supervisores pueden acceder a recursos sin dueño específico
  if (userSession.role === 'supervisor' && !resourceOwnerId) {
    return true;
  }

  // Los usuarios solo pueden acceder a sus propios recursos
  if (resourceOwnerId) {
    return userSession.userId === resourceOwnerId;
  }

  // Por defecto, denegar acceso
  return false;
}

// Sanitizar datos de usuario para respuesta (remover información sensible)
export function sanitizeUserForResponse(user: any): any {
  const { password, password_hash, ...sanitizedUser } = user;
  return sanitizedUser;
}

// Validar formato de email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generar ID de sesión único
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
