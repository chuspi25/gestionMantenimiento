# 🗄️ Configuración de Base de Datos - Sistema de Gestión de Mantenimiento

## 📋 Requisitos Previos

- PostgreSQL 12+ instalado y ejecutándose
- Acceso como superusuario (postgres)
- Cliente psql o herramienta de administración de PostgreSQL

## 🚀 Instalación Paso a Paso

### 1. Configurar PostgreSQL

```bash
# En Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# En CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb

# En macOS con Homebrew
brew install postgresql
brew services start postgresql

# En Windows
# Descargar e instalar desde https://www.postgresql.org/download/windows/
```

### 2. Crear Base de Datos y Usuario

```bash
# Conectarse como superusuario
sudo -u postgres psql

# O en Windows/macOS
psql -U postgres
```

```sql
-- Ejecutar el script de configuración inicial
\i setup-database.sql
```

### 3. Crear Esquema de Tablas

```bash
# Conectarse a la base de datos principal
psql -U maintenance_user -d maintenance_db -h localhost

# Ejecutar el esquema de base de datos
\i database_schema.sql
```

### 4. Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar las variables de base de datos
nano .env
```

Configurar las siguientes variables:
```env
DATABASE_URL=postgresql://maintenance_user:secure_password_2024@localhost:5432/maintenance_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=maintenance_db
DB_USER=maintenance_user
DB_PASSWORD=secure_password_2024
```

## 📊 Estructura de la Base de Datos

### Tablas Principales

| Tabla | Descripción | Campos Principales |
|-------|-------------|-------------------|
| `users` | Usuarios del sistema | id, email, name, password_hash, role, is_active |
| `tasks` | Tareas de mantenimiento | id, title, description, type, priority, status, assigned_to |
| `task_notes` | Notas de tareas | id, task_id, user_id, content |
| `task_attachments` | Archivos adjuntos | id, task_id, file_name, file_url, file_type |
| `user_sessions` | Sesiones JWT | id, user_id, refresh_token, expires_at |
| `audit_logs` | Auditoría del sistema | id, user_id, action, resource_type, old_values, new_values |
| `notifications` | Notificaciones | id, user_id, title, message, type, is_read |

### Roles de Usuario

- **admin**: Acceso completo al sistema
- **supervisor**: Gestión de tareas y usuarios operadores
- **operator**: Ejecución de tareas asignadas

### Estados de Tareas

- **pending**: Tarea pendiente de iniciar
- **in_progress**: Tarea en progreso
- **completed**: Tarea completada
- **cancelled**: Tarea cancelada

### Tipos de Mantenimiento

- **electrical**: Mantenimiento eléctrico
- **mechanical**: Mantenimiento mecánico

### Prioridades

- **low**: Prioridad baja
- **medium**: Prioridad media
- **high**: Prioridad alta
- **urgent**: Urgente

## 👥 Usuarios por Defecto

El sistema crea automáticamente tres usuarios de ejemplo:

| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@mantenimiento.com | admin123 | admin |
| supervisor@mantenimiento.com | admin123 | supervisor |
| operador@mantenimiento.com | admin123 | operator |

> ⚠️ **IMPORTANTE**: Cambiar estas contraseñas en producción

## 🔧 Comandos Útiles

### Verificar Conexión
```bash
# Probar conexión a la base de datos
psql -U maintenance_user -d maintenance_db -h localhost -c "SELECT NOW();"
```

### Backup de Base de Datos
```bash
# Crear backup
pg_dump -U maintenance_user -h localhost maintenance_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
psql -U maintenance_user -h localhost maintenance_db < backup_file.sql
```

### Limpiar Datos de Prueba
```sql
-- Limpiar todas las tablas (CUIDADO: elimina todos los datos)
TRUNCATE TABLE task_attachments, task_notes, tasks, user_sessions, audit_logs, notifications RESTART IDENTITY CASCADE;

-- Mantener solo usuarios por defecto
DELETE FROM users WHERE email NOT IN ('admin@mantenimiento.com', 'supervisor@mantenimiento.com', 'operador@mantenimiento.com');
```

### Estadísticas de Base de Datos
```sql
-- Ver estadísticas generales
SELECT * FROM task_statistics;
SELECT * FROM user_statistics;

-- Ver tareas por estado
SELECT status, COUNT(*) FROM tasks GROUP BY status;

-- Ver usuarios por rol
SELECT role, COUNT(*) FROM users GROUP BY role;
```

## 🔍 Vistas Disponibles

- `task_statistics`: Estadísticas generales de tareas
- `tasks_with_users`: Tareas con información de usuarios
- `user_statistics`: Estadísticas de usuarios

## 🛠️ Mantenimiento

### Limpieza Automática
```sql
-- Limpiar sesiones expiradas
SELECT cleanup_expired_sessions();

-- Limpiar logs de auditoría antiguos (más de 90 días)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Limpiar notificaciones leídas antiguas (más de 30 días)
DELETE FROM notifications WHERE is_read = true AND read_at < NOW() - INTERVAL '30 days';
```

### Optimización
```sql
-- Actualizar estadísticas de tablas
ANALYZE;

-- Reindexar si es necesario
REINDEX DATABASE maintenance_db;
```

## 🚨 Solución de Problemas

### Error de Conexión
```bash
# Verificar que PostgreSQL esté ejecutándose
sudo systemctl status postgresql

# Verificar configuración de pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

### Error de Permisos
```sql
-- Otorgar permisos faltantes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO maintenance_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO maintenance_user;
```

### Resetear Contraseña de Usuario
```sql
-- Como superusuario postgres
ALTER USER maintenance_user PASSWORD 'nueva_contraseña';
```

## 📝 Notas Adicionales

- La base de datos usa UUID como identificadores primarios
- Todas las fechas se almacenan con zona horaria (TIMESTAMP WITH TIME ZONE)
- Los passwords se almacenan hasheados con bcrypt
- Se incluye auditoría automática de cambios importantes
- Las sesiones JWT se gestionan en base de datos para mayor seguridad

## 🔐 Seguridad

- Cambiar contraseñas por defecto en producción
- Configurar firewall para limitar acceso a PostgreSQL
- Usar conexiones SSL en producción
- Realizar backups regulares
- Monitorear logs de auditoría