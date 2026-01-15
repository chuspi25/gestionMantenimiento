// Modelo de Usuario
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'operator';
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
  profileImage?: string;
}

// Datos para crear un nuevo usuario
export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'supervisor' | 'operator';
}

// Datos para actualizar un usuario
export interface UpdateUserRequest {
  email?: string;
  name?: string;
  password?: string;
  role?: 'admin' | 'supervisor' | 'operator';
  isActive?: boolean;
  profileImage?: string;
}

// Credenciales de login
export interface LoginCredentials {
  email: string;
  password: string;
}

// Respuesta de autenticación
export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: Omit<User, 'password'>;
  expiresIn: string;
}

// Sesión de usuario
export interface UserSession {
  userId: string;
  email: string;
  role: 'admin' | 'supervisor' | 'operator';
  isActive: boolean;
}

// Validación de datos de usuario
export function validateCreateUser(data: any): data is CreateUserRequest {
  return (
    typeof data.email === 'string' &&
    typeof data.name === 'string' &&
    typeof data.password === 'string' &&
    ['admin', 'supervisor', 'operator'].includes(data.role) &&
    data.email.includes('@') &&
    data.name.trim().length > 0 &&
    data.password.length >= 6
  );
}

export function validateUpdateUser(data: any): data is UpdateUserRequest {
  const validFields = ['email', 'name', 'password', 'role', 'isActive', 'profileImage'];
  const hasValidFields = Object.keys(data).every(key => validFields.includes(key));
  
  if (!hasValidFields) return false;
  
  if (data.email !== undefined && (!data.email.includes('@') || typeof data.email !== 'string')) return false;
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) return false;
  if (data.password !== undefined && (typeof data.password !== 'string' || data.password.length < 6)) return false;
  if (data.role !== undefined && !['admin', 'supervisor', 'operator'].includes(data.role)) return false;
  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') return false;
  
  return true;
}
