-- =====================================================
-- SISTEMA DE GESTIÓN DE MANTENIMIENTO - ESQUEMA DE BASE DE DATOS
-- =====================================================
-- Base de datos: PostgreSQL
-- Descripción: Sistema para gestión de operaciones de mantenimiento eléctrico y mecánico
-- =====================================================

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLA: users
-- Descripción: Almacena información de usuarios del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'supervisor', 'operator')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    profile_image TEXT,
    
    -- Constraints adicionales
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- =====================================================
-- TABLA: tasks
-- Descripción: Almacena las tareas de mantenimiento
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('electrical', 'mechanical')),
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    location VARCHAR(255) NOT NULL,
    required_tools TEXT[] DEFAULT '{}',
    estimated_duration INTEGER NOT NULL CHECK (estimated_duration > 0), -- en minutos
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints adicionales
    CONSTRAINT tasks_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT tasks_description_not_empty CHECK (LENGTH(TRIM(description)) > 0),
    CONSTRAINT tasks_location_not_empty CHECK (LENGTH(TRIM(location)) > 0),
    CONSTRAINT tasks_due_date_future CHECK (due_date > created_at),
    CONSTRAINT tasks_completion_logic CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR 
        (status != 'completed' AND completed_at IS NULL)
    ),
    CONSTRAINT tasks_start_logic CHECK (
        (status IN ('in_progress', 'completed') AND started_at IS NOT NULL) OR 
        (status IN ('pending', 'cancelled'))
    )
);

-- =====================================================
-- TABLA: task_notes
-- Descripción: Notas y comentarios asociados a las tareas
-- =====================================================
CREATE TABLE IF NOT EXISTS task_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints adicionales
    CONSTRAINT task_notes_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- =====================================================
-- TABLA: task_attachments
-- Descripción: Archivos adjuntos asociados a las tareas
-- =====================================================
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints adicionales
    CONSTRAINT task_attachments_filename_not_empty CHECK (LENGTH(TRIM(file_name)) > 0),
    CONSTRAINT task_attachments_url_not_empty CHECK (LENGTH(TRIM(file_url)) > 0),
    CONSTRAINT task_attachments_type_not_empty CHECK (LENGTH(TRIM(file_type)) > 0),
    CONSTRAINT task_attachments_size_positive CHECK (file_size IS NULL OR file_size > 0)
);

-- =====================================================
-- TABLA: user_sessions (para manejo de tokens JWT)
-- Descripción: Gestión de sesiones y tokens de usuarios
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Constraints adicionales
    CONSTRAINT user_sessions_token_not_empty CHECK (LENGTH(TRIM(refresh_token)) > 0),
    CONSTRAINT user_sessions_expires_future CHECK (expires_at > created_at)
);

-- =====================================================
-- TABLA: audit_logs (para auditoría del sistema)
-- Descripción: Registro de acciones importantes del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints adicionales
    CONSTRAINT audit_logs_action_not_empty CHECK (LENGTH(TRIM(action)) > 0),
    CONSTRAINT audit_logs_resource_type_not_empty CHECK (LENGTH(TRIM(resource_type)) > 0)
);

-- =====================================================
-- TABLA: notifications (para notificaciones del sistema)
-- Descripción: Sistema de notificaciones para usuarios
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints adicionales
    CONSTRAINT notifications_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT notifications_message_not_empty CHECK (LENGTH(TRIM(message)) > 0),
    CONSTRAINT notifications_read_logic CHECK (
        (is_read = true AND read_at IS NOT NULL) OR 
        (is_read = false AND read_at IS NULL)
    )
);

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS
-- =====================================================

-- Índices para tabla users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Índices para tabla tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON tasks(assigned_to, status);

-- Índices para tabla task_notes
CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notes_user_id ON task_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_task_notes_created_at ON task_notes(created_at);

-- Índices para tabla task_attachments
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_at ON task_attachments(uploaded_at);

-- Índices para tabla user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- Índices para tabla audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Índices para tabla notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar timestamps automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR is_active = false;
END;
$$ language 'plpgsql';

-- Función para marcar notificación como leída
CREATE OR REPLACE FUNCTION mark_notification_read()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at = NOW();
    ELSIF NEW.is_read = false THEN
        NEW.read_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para notificaciones
CREATE TRIGGER trigger_notification_read_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION mark_notification_read();

-- =====================================================
-- DATOS INICIALES (SEEDS)
-- =====================================================

-- Insertar usuario administrador por defecto
INSERT INTO users (email, name, password_hash, role, is_active) 
VALUES (
    'admin@mantenimiento.com',
    'Administrador del Sistema',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlJO', -- password: admin123
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- Insertar supervisor por defecto
INSERT INTO users (email, name, password_hash, role, is_active) 
VALUES (
    'supervisor@mantenimiento.com',
    'Supervisor de Mantenimiento',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlJO', -- password: admin123
    'supervisor',
    true
) ON CONFLICT (email) DO NOTHING;

-- Insertar operador por defecto
INSERT INTO users (email, name, password_hash, role, is_active) 
VALUES (
    'operador@mantenimiento.com',
    'Operador de Mantenimiento',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlJO', -- password: admin123
    'operator',
    true
) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista para estadísticas de tareas
CREATE OR REPLACE VIEW task_statistics AS
SELECT 
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_tasks,
    COUNT(CASE WHEN due_date < NOW() AND status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue_tasks,
    COUNT(CASE WHEN type = 'electrical' THEN 1 END) as electrical_tasks,
    COUNT(CASE WHEN type = 'mechanical' THEN 1 END) as mechanical_tasks,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_tasks,
    COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tasks
FROM tasks;

-- Vista para tareas con información de usuarios
CREATE OR REPLACE VIEW tasks_with_users AS
SELECT 
    t.*,
    u_assigned.name as assigned_to_name,
    u_assigned.email as assigned_to_email,
    u_created.name as created_by_name,
    u_created.email as created_by_email
FROM tasks t
LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
LEFT JOIN users u_created ON t.created_by = u_created.id;

-- Vista para estadísticas de usuarios
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
    COUNT(CASE WHEN role = 'supervisor' THEN 1 END) as supervisor_users,
    COUNT(CASE WHEN role = 'operator' THEN 1 END) as operator_users,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
    COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
    COUNT(CASE WHEN last_login > NOW() - INTERVAL '30 days' THEN 1 END) as recently_active_users
FROM users;

-- =====================================================
-- COMENTARIOS EN TABLAS Y COLUMNAS
-- =====================================================

-- Comentarios en tablas
COMMENT ON TABLE users IS 'Usuarios del sistema de gestión de mantenimiento';
COMMENT ON TABLE tasks IS 'Tareas de mantenimiento eléctrico y mecánico';
COMMENT ON TABLE task_notes IS 'Notas y comentarios asociados a las tareas';
COMMENT ON TABLE task_attachments IS 'Archivos adjuntos de las tareas';
COMMENT ON TABLE user_sessions IS 'Sesiones activas de usuarios para JWT';
COMMENT ON TABLE audit_logs IS 'Registro de auditoría del sistema';
COMMENT ON TABLE notifications IS 'Notificaciones del sistema para usuarios';

-- Comentarios en columnas importantes
COMMENT ON COLUMN users.role IS 'Rol del usuario: admin, supervisor, operator';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt de la contraseña';
COMMENT ON COLUMN tasks.type IS 'Tipo de mantenimiento: electrical, mechanical';
COMMENT ON COLUMN tasks.priority IS 'Prioridad: low, medium, high, urgent';
COMMENT ON COLUMN tasks.status IS 'Estado: pending, in_progress, completed, cancelled';
COMMENT ON COLUMN tasks.estimated_duration IS 'Duración estimada en minutos';
COMMENT ON COLUMN tasks.required_tools IS 'Array de herramientas necesarias';

-- =====================================================
-- PERMISOS Y SEGURIDAD
-- =====================================================

-- Crear rol para la aplicación
-- CREATE ROLE maintenance_app WITH LOGIN PASSWORD 'secure_password_here';

-- Otorgar permisos necesarios
-- GRANT CONNECT ON DATABASE maintenance_db TO maintenance_app;
-- GRANT USAGE ON SCHEMA public TO maintenance_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO maintenance_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO maintenance_app;

-- =====================================================
-- FINALIZACIÓN
-- =====================================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Base de datos del Sistema de Gestión de Mantenimiento creada exitosamente';
    RAISE NOTICE 'Usuarios por defecto creados con contraseña: admin123';
    RAISE NOTICE 'Recuerda cambiar las contraseñas por defecto en producción';
END $$;