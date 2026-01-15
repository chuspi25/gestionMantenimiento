# Design Document

## Overview

El sistema de gestión de mantenimiento será una aplicación web responsiva que proporciona una experiencia optimizada en dispositivos móviles con capacidades offline básicas usando localStorage. La arquitectura seguirá un patrón cliente-servidor con API REST, implementando autenticación basada en roles usando tecnologías modernas y ligeras: Hono framework para el backend y TypeScript compilado a Vanilla JavaScript para el frontend.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile Web    │    │   Web Dashboard  │    │   Admin Panel   │
│   (Operarios)   │    │  (Supervisores)  │    │(Administradores)│
│  Vanilla JS/TS  │    │  Vanilla JS/TS   │    │  Vanilla JS/TS  │
└─────────┬───────┘    └────────┬─────────┘    └─────────┬───────┘
          │                     │                        │
          └─────────────────────┼────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │     Hono Server        │
                    │   (Authentication &    │
                    │    API Routes)         │
                    └───────────┬────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
┌─────────▼─────────┐ ┌─────────▼─────────┐ ┌─────────▼─────────┐
│   Database        │ │   File Storage    │ │   localStorage    │
│ (Configurable)    │ │   (Images/Docs)   │ │   (Offline Data)  │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

### Technology Stack

- **Frontend**: HTML5, CSS3, TypeScript (compilado a Vanilla JavaScript)
- **Backend**: Node.js con Hono framework
- **Database**: PostgreSQL con configuración mediante variables de entorno
- **Authentication**: JWT tokens con bcrypt para hash de contraseñas
- **File Storage**: Sistema de archivos local o configurable
- **Offline Storage**: localStorage para datos básicos offline
- **Build Tools**: TypeScript compiler, npm scripts

## Components and Interfaces

### Frontend Components

#### 1. Authentication Module
- **LoginForm**: Formulario de login con validación
- **AuthManager**: Gestión de tokens JWT y estado de autenticación
- **RoleGuard**: Control de acceso basado en roles del usuario

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
- **OfflineManager**: Gestión de datos offline con localStorage
- **SyncIndicator**: Indicador de estado de conexión
- **CacheManager**: Gestión de cache de datos

### Backend Services

#### 1. Authentication Service
```typescript
interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthResponse>
  validateToken(token: string): Promise<UserSession>
  refreshToken(refreshToken: string): Promise<AuthResponse>
  logout(userId: string): Promise<void>
  hashPassword(password: string): Promise<string>
  comparePassword(password: string, hash: string): Promise<boolean>
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
  uploadTaskAttachment(taskId: string, file: File): Promise<TaskAttachment>
}
```

#### 3. User Service
```typescript
interface UserService {
  createUser(user: CreateUserRequest): Promise<User>
  updateUser(userId: string, updates: UpdateUserRequest): Promise<User>
  deactivateUser(userId: string): Promise<void>
  getUsersByRole(role: UserRole): Promise<User[]>
  notifyUser(userId: string, message: string): Promise<void>
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

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all testable properties from the prework analysis, I identified several areas where properties can be consolidated to eliminate redundancy:

- Properties 1.2 and 8.5 both deal with authentication mechanisms - these can be combined into a comprehensive authentication property
- Properties 2.1 and 4.1 both involve validation and state updates - these can be streamlined
- Properties 3.2 and 5.2 both involve filtering tasks - these can be combined into a general filtering property
- Properties 4.2 and 4.4 both involve storing information with metadata - these can be consolidated

### Core Properties

**Property 1: User creation and validation**
*For any* user data input, creating a user should succeed only when all required fields are valid, and the created user should have the specified role and be marked as active
**Validates: Requirements 1.1**

**Property 2: Role-based access control**
*For any* user with operator role, querying tasks should return only tasks assigned to that specific user, and no tasks assigned to other users
**Validates: Requirements 1.5**

**Property 3: User deactivation preserves data integrity**
*For any* active user with associated tasks, deactivating the user should revoke their access while preserving all their historical task data
**Validates: Requirements 1.3**

**Property 4: Task creation with unique identifiers**
*For any* valid task data, creating a task should assign a unique identifier that is different from all existing task identifiers
**Validates: Requirements 2.1**

**Property 5: Task assignment and visibility**
*For any* task assigned to an operator, that task should appear in the operator's task list and should not appear in other operators' task lists
**Validates: Requirements 2.2**

**Property 6: Task categorization consistency**
*For any* task with a specified maintenance type, the task should be consistently categorized as either electrical or mechanical throughout the system
**Validates: Requirements 2.3**

**Property 7: Task ordering by priority and date**
*For any* collection of tasks with different priorities and due dates, the system should order them with higher priority tasks first, and within the same priority, earlier due dates first
**Validates: Requirements 2.4**

**Property 8: Task filtering by type**
*For any* maintenance type filter (electrical or mechanical), the system should return only tasks that match the specified type
**Validates: Requirements 5.2**

**Property 9: Task status updates with timestamps**
*For any* task status change to "in_progress", the system should record the current timestamp as the start time and update the task status
**Validates: Requirements 4.1**

**Property 10: Task completion with confirmation**
*For any* task marked as completed, the system should record the completion timestamp and require confirmation before finalizing the status change
**Validates: Requirements 4.3**

**Property 11: Note and incident storage with metadata**
*For any* note or incident report added to a task, the system should store it with the current timestamp and the user who created it
**Validates: Requirements 4.2, 4.4**

**Property 12: File attachment association**
*For any* file uploaded for a task, the system should associate it with the correct task and store metadata including filename, upload timestamp, and uploader
**Validates: Requirements 4.5**

**Property 13: Offline data persistence**
*For any* task data stored in localStorage, the system should be able to retrieve and display it when offline
**Validates: Requirements 3.4**

**Property 14: Data synchronization on reconnection**
*For any* task updates made while offline, the system should synchronize these changes with the server when connection is restored
**Validates: Requirements 3.5**

**Property 15: Dashboard summary accuracy**
*For any* collection of active tasks, the dashboard summary should accurately reflect the count and status distribution of all tasks
**Validates: Requirements 5.1**

**Property 16: Report generation with correct metrics**
*For any* set of completed tasks, generated reports should include accurate metrics for productivity and completion rates
**Validates: Requirements 5.5**

**Property 17: Secure authentication with JWT and bcrypt**
*For any* login attempt with valid credentials, the system should authenticate using bcrypt for password verification and return a valid JWT token
**Validates: Requirements 7.1, 8.5**

**Property 18: Data encryption for sensitive information**
*For any* sensitive data stored in the database, the information should be encrypted before storage and decrypted when retrieved
**Validates: Requirements 7.2**

**Property 19: Secure error logging**
*For any* system error that occurs, the error should be logged with diagnostic information but without exposing sensitive user data
**Validates: Requirements 7.3**

**Property 20: Access blocking for unauthorized attempts**
*For any* unauthorized access attempt, the system should block the access and maintain a record for administrative review
**Validates: Requirements 7.4**

**Property 21: Database configuration flexibility**
*For any* valid database configuration in environment variables, the system should successfully connect and operate with the specified database
**Validates: Requirements 8.3**

## Error Handling

### Frontend Error Handling
- **Network Errors**: Graceful degradation with offline mode activation
- **Validation Errors**: Real-time form validation with clear error messages
- **Authentication Errors**: Automatic token refresh or redirect to login
- **File Upload Errors**: Progress indication and retry mechanisms

### Backend Error Handling
- **Database Errors**: Connection pooling and retry logic
- **Authentication Errors**: Secure error responses without information leakage
- **File System Errors**: Graceful handling of storage limitations
- **Validation Errors**: Structured error responses with field-specific messages

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, string>
    timestamp: string
  }
}
```

## Testing Strategy

### Dual Testing Approach

The system will implement both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties that should hold across all inputs
- Together they provide comprehensive coverage: unit tests catch concrete bugs, property tests verify general correctness

### Unit Testing

Unit tests will cover:
- Specific examples that demonstrate correct behavior
- Integration points between components
- Error conditions and edge cases
- Authentication flows and authorization checks

### Property-Based Testing

**Library**: fast-check for JavaScript/TypeScript property-based testing
**Configuration**: Each property-based test will run a minimum of 100 iterations

Property-based tests will implement each correctness property defined above:
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `**Feature: maintenance-app, Property {number}: {property_text}**`
- Each correctness property will be implemented by a SINGLE property-based test
- Tests will generate random valid inputs to verify properties hold across all scenarios

### Test Organization
```
tests/
├── frontend/
│   ├── unit/
│   │   ├── auth.test.ts
│   │   ├── tasks.test.ts
│   │   └── users.test.ts
│   └── properties/
│       ├── auth.properties.test.ts
│       ├── tasks.properties.test.ts
│       └── users.properties.test.ts
└── backend/
    ├── unit/
    │   ├── services/
    │   ├── routes/
    │   └── middleware/
    └── properties/
        ├── auth.properties.test.ts
        ├── tasks.properties.test.ts
        └── users.properties.test.ts
```