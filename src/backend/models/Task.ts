// Modelo de Tarea
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
  estimatedDuration: number; // minutes
  dueDate: Date;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  notes: TaskNote[];
  attachments: TaskAttachment[];
}

// Nota de tarea
export interface TaskNote {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

// Archivo adjunto de tarea
export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  uploadedAt: Date;
}

// Datos para crear una nueva tarea
export interface CreateTaskRequest {
  title: string;
  description: string;
  type: 'electrical' | 'mechanical';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  location: string;
  requiredTools: string[];
  estimatedDuration: number;
  dueDate: Date;
}

// Datos para actualizar una tarea
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  type?: 'electrical' | 'mechanical';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  location?: string;
  requiredTools?: string[];
  estimatedDuration?: number;
  dueDate?: Date;
}

// Datos para crear una nota
export interface CreateTaskNoteRequest {
  taskId: string;
  content: string;
}

// Tipos de estado de tarea
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskType = 'electrical' | 'mechanical';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Filtros para tareas
export interface TaskFilters {
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  createdBy?: string;
  dueBefore?: Date;
  dueAfter?: Date;
}

// Ordenamiento de tareas
export interface TaskSortOptions {
  field: 'priority' | 'dueDate' | 'createdAt' | 'title';
  direction: 'asc' | 'desc';
}

// Validación de datos de tarea
export function validateCreateTask(data: any): data is CreateTaskRequest {
  // Convertir dueDate de string a Date si es necesario
  if (typeof data.dueDate === 'string') {
    const parsedDate = new Date(data.dueDate);
    if (!isNaN(parsedDate.getTime())) {
      data.dueDate = parsedDate;
    }
  }

  return (
    typeof data.title === 'string' &&
    typeof data.description === 'string' &&
    ['electrical', 'mechanical'].includes(data.type) &&
    ['low', 'medium', 'high', 'urgent'].includes(data.priority) &&
    typeof data.location === 'string' &&
    Array.isArray(data.requiredTools) &&
    typeof data.estimatedDuration === 'number' &&
    (data.dueDate instanceof Date || (typeof data.dueDate === 'string' && !isNaN(new Date(data.dueDate).getTime()))) &&
    data.title.trim().length > 0 &&
    data.description.trim().length > 0 &&
    data.location.trim().length > 0 &&
    data.estimatedDuration > 0 &&
    data.requiredTools.every((tool: any) => typeof tool === 'string')
  );
}

export function validateUpdateTask(data: any): data is UpdateTaskRequest {
  const validFields = ['title', 'description', 'type', 'priority', 'status', 'assignedTo', 'location', 'requiredTools', 'estimatedDuration', 'dueDate'];
  const hasValidFields = Object.keys(data).every(key => validFields.includes(key));
  
  if (!hasValidFields) return false;
  
  // Convertir dueDate de string a Date si es necesario
  if (data.dueDate && typeof data.dueDate === 'string') {
    const parsedDate = new Date(data.dueDate);
    if (!isNaN(parsedDate.getTime())) {
      data.dueDate = parsedDate;
    }
  }
  
  if (data.title && (typeof data.title !== 'string' || data.title.trim().length === 0)) return false;
  if (data.description && (typeof data.description !== 'string' || data.description.trim().length === 0)) return false;
  if (data.type && !['electrical', 'mechanical'].includes(data.type)) return false;
  if (data.priority && !['low', 'medium', 'high', 'urgent'].includes(data.priority)) return false;
  if (data.status && !['pending', 'in_progress', 'completed', 'cancelled'].includes(data.status)) return false;
  if (data.location && (typeof data.location !== 'string' || data.location.trim().length === 0)) return false;
  if (data.requiredTools && (!Array.isArray(data.requiredTools) || !data.requiredTools.every((tool: any) => typeof tool === 'string'))) return false;
  if (data.estimatedDuration && (typeof data.estimatedDuration !== 'number' || data.estimatedDuration <= 0)) return false;
  if (data.dueDate && !(data.dueDate instanceof Date || (typeof data.dueDate === 'string' && !isNaN(new Date(data.dueDate).getTime())))) return false;
  
  return true;
}

export function validateCreateTaskNote(data: any): data is CreateTaskNoteRequest {
  return (
    typeof data.taskId === 'string' &&
    typeof data.content === 'string' &&
    data.taskId.trim().length > 0 &&
    data.content.trim().length > 0
  );
}
