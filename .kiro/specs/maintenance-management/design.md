# Design Document

## Overview

El sistema de gestión de mantenimiento será una Progressive Web App (PWA) que proporciona una experiencia nativa en dispositivos móviles con capacidades offline. La arquitectura seguirá un patrón cliente-servidor con API REST, implementando autenticación basada en roles y sincronización de datos en tiempo real.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile PWA    │    │   Web Dashboard  │    │   Admin Panel   │
│   (Operarios)   │    │  (Supervisores)  │    │(Administradores)│
└─────────┬───────┘    └────────┬─────────┘    └─────────┬───────┘
          │                     │                        │
          └─────────────────────┼────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │     API Gateway        │
                    │   (Authentication &    │
                    │    Authorization)      │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Application Server  │
                    │   (Business Logic)     │
                    └───────────┬────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
┌─────────▼─────────┐ ┌─────────▼─────────┐ ┌─────────▼─────────┐
│   PostgreSQL      │ │   File Storage    │ │   Redis Cache     │
│   (Main Data)     │ │   (Images/Docs)   │ │   (Sessions)      │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

### Technology Stack

- **Frontend**: React.js con TypeScript, Tailwind CSS
- **Backend**: Node.js con Express.js y TypeScript
- **Database**: PostgreSQL para datos principales
- **Cache**: Redis para sesiones y cache
- **File Storage**: AWS S3 o almacenamiento local
- **Authentication**: JWT tokens
- **PWA**: Service Workers para funcionalidad offline

## Components and Interfaces

### Frontend Components

#### 1. Authentication Module
- **LoginComponent**: Manejo de credenciales y autenticación
- **RoleGuard**: Control de acceso basado en roles
- **TokenManager**: Gestión de tokens JWT y renovación

#### 2. Task Management Module
- **TaskList**: Lista de tareas con filtros y búsqueda
- **TaskDetail**: Vista detallada de tarea individual
- **TaskForm**: Creación y edición de tareas
- **TaskProgress**: Actualización de estado y progreso

#### 3. User Management Module
- **UserList**: Gestión de usuarios (solo admin/supervisor)
- **UserForm**: Creación y edición de usuarios
- **ProfileManager**: Gestión de perfil personal

#### 4. Offline Module
- **SyncManager**: Sincronización de datos offline/online
- **CacheManager**: Gestión de cache local
- **OfflineIndicator**: Indicador de estado de conexión

### Backend Services

#### 1. Authentication Service
```typescript
interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthResponse>
  validateToken(token: string): Promise<UserSession>
  refreshToken(refreshToken: string): Promise<AuthResponse>
  logout(userId: string): Promise<void>
}
```

#### 2. Task Service
```typescript
interface TaskService {
  createTask(task: CreateTaskRequest): Promise<Task>
  assignTask(taskId: string, operatorId: string): Promise<void>
  updateTaskStatus(taskId: string, status: TaskStatus, notes?: string): Promise<Task>
  getTasksByOperator(operatorId: string): Promise<Task[]>
  getTasksBySupervisor(supervisorId: string): Promise<Task[]>
}
```

#### 3. User Service
```typescript
interface UserService {
  createUser(user: CreateUserRequest): Promise<User>
  updateUser(userId: string, updates: UpdateUserRequest): Promise<User>
  deactivateUser(userId: string): Promise<void>
  getUsersByRole(role: UserRole): Promise<User[]>
}
```

## Data Models

### User Model
```typescript
interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'supervisor' | 'operator'
  isActive: boolean
  createdAt: Date
  lastLogin?: Date
  profileImage?: string
}
```

### Task Model
```typescript
interface Task {
  id: string
  title: string
  description: string
  type: 'electrical' | 'mechanical'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  assignedTo?: string
  createdBy: string
  location: string
  requiredTools: string[]
  estimatedDuration: number // minutes
  dueDate: Date
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  notes: TaskNote[]
  attachments: TaskAttachment[]
}
```

### Task Note Model
```typescript
interface TaskNote {
  id: string
  taskId: string
  userId: string
  content: string
  createdAt: Date
}
```

### Task Attachment Model
```typescript
interface TaskAttachment {
  id: string
  taskId: string
  fileName: string
  fileUrl: string
  fileType: string
  uploadedBy: string
  uploadedAt: Date
}
```
