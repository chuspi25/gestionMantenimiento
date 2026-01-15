import jwt from 'jsonwebtoken';
import { UserSession } from '../models/User.js';

// Configuración JWT desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Interfaz para el payload del JWT
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'supervisor' | 'operator';
  isActive: boolean;
  type: 'access' | 'refresh';
}

// Generar token de acceso
export function generateAccessToken(userSession: UserSession): string {
  const payload: JWTPayload = {
    userId: userSession.userId,
    email: userSession.email,
    role: userSession.role,
    isActive: userSession.isActive,
    type: 'access'
  };

  const options = {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'maintenance-app',
    audience: 'maintenance-app-users'
  } as jwt.SignOptions;

  return jwt.sign(payload, JWT_SECRET, options);
}

// Generar token de refresh
export function generateRefreshToken(userSession: UserSession): string {
  const payload: JWTPayload = {
    userId: userSession.userId,
    email: userSession.email,
    role: userSession.role,
    isActive: userSession.isActive,
    type: 'refresh'
  };

  const options = {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'maintenance-app',
    audience: 'maintenance-app-users'
  } as jwt.SignOptions;

  return jwt.sign(payload, JWT_SECRET, options);
}

// Validar y decodificar token
export function validateToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'maintenance-app',
      audience: 'maintenance-app-users'
    }) as JWTPayload;

    // Verificar que el token tenga la estructura esperada
    if (!decoded.userId || !decoded.email || !decoded.role || !decoded.type) {
      return null;
    }

    // Verificar que el usuario esté activo
    if (!decoded.isActive) {
      return null;
    }

    return decoded;
  } catch (error) {
    // Token inválido, expirado o malformado
    return null;
  }
}

// Validar token de acceso específicamente
export function validateAccessToken(token: string): JWTPayload | null {
  const decoded = validateToken(token);
  
  if (!decoded || decoded.type !== 'access') {
    return null;
  }

  return decoded;
}

// Validar token de refresh específicamente
export function validateRefreshToken(token: string): JWTPayload | null {
  const decoded = validateToken(token);
  
  if (!decoded || decoded.type !== 'refresh') {
    return null;
  }

  return decoded;
}

// Extraer token del header Authorization
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Formato esperado: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

// Obtener información del usuario desde el token
export function getUserFromToken(token: string): UserSession | null {
  const decoded = validateAccessToken(token);
  
  if (!decoded) {
    return null;
  }

  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    isActive: decoded.isActive
  };
}

// Verificar si un token está próximo a expirar (dentro de los próximos 5 minutos)
export function isTokenNearExpiry(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.exp) {
      return true; // Si no podemos decodificar, consideramos que debe renovarse
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = decoded.exp;
    const fiveMinutesInSeconds = 5 * 60;

    return (expirationTime - currentTime) <= fiveMinutesInSeconds;
  } catch (error) {
    return true; // En caso de error, consideramos que debe renovarse
  }
}

// Generar par de tokens (access + refresh)
export function generateTokenPair(userSession: UserSession): { accessToken: string; refreshToken: string } {
  return {
    accessToken: generateAccessToken(userSession),
    refreshToken: generateRefreshToken(userSession)
  };
}
