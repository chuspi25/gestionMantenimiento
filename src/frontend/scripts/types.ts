// Tipos compartidos para el frontend
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

export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'electrical' | 'mechanical';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  createdBy: string;
  location: string;
  requiredTools: string[];
  estimatedDuration: number;
  dueDate: Date;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  notes: TaskNote[];
  attachments: TaskAttachment[];
}

export interface TaskNote {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  uploadedAt: Date;
}

// Tipos para formularios
export interface LoginForm {
  email: string;
  password: string;
}

export interface TaskForm {
  title: string;
  description: string;
  type: 'electrical' | 'mechanical';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  location: string;
  requiredTools: string[];
  estimatedDuration: number;
  dueDate: string; // Como string para inputs de fecha
}

export interface UserForm {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'supervisor' | 'operator';
}

// Estados de la aplicación
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tasks: Task[];
  users: User[];
  currentView: string;
}

// Respuestas de la API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Configuración de filtros
export interface TaskFilters {
  type?: 'electrical' | 'mechanical';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string | null;
  search?: string;
}

// Configuración de ordenamiento
export interface SortConfig {
  field: 'priority' | 'dueDate' | 'createdAt' | 'title';
  direction: 'asc' | 'desc';
}

// Configuración de ordenamiento para TaskList
export interface TaskSortOptions {
  field: keyof Task;
  direction: 'asc' | 'desc';
}

// Eventos del DOM personalizados
export interface CustomEvents {
  'task-created': CustomEvent<Task>;
  'task-updated': CustomEvent<Task>;
  'task-deleted': CustomEvent<string>;
  'user-login': CustomEvent<User>;
  'user-logout': CustomEvent<void>;
  'error-occurred': CustomEvent<string>;
}

// Utilidades de validación para el frontend
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function validatePassword(password: string): boolean {
  return password.length >= 6;
}

export function validateTaskForm(form: TaskForm): string[] {
  const errors: string[] = [];
  
  if (!validateRequired(form.title)) {
    errors.push('El título es requerido');
  }
  
  if (!validateRequired(form.description)) {
    errors.push('La descripción es requerida');
  }
  
  if (!validateRequired(form.location)) {
    errors.push('La ubicación es requerida');
  }
  
  if (form.estimatedDuration <= 0) {
    errors.push('La duración estimada debe ser mayor a 0');
  }
  
  if (!form.dueDate) {
    errors.push('La fecha límite es requerida');
  }
  
  return errors;
}

export function validateUserForm(form: UserForm): string[] {
  const errors: string[] = [];
  
  if (!validateRequired(form.name)) {
    errors.push('El nombre es requerido');
  }
  
  if (!validateEmail(form.email)) {
    errors.push('El email no es válido');
  }
  
  if (!validatePassword(form.password)) {
    errors.push('La contraseña debe tener al menos 6 caracteres');
  }
  
  return errors;
}