# 🗄️ Instrucciones para Configurar la Base de Datos

## Requisitos Previos

1. **PostgreSQL instalado**: Debes tener PostgreSQL instalado en tu sistema
   - Descarga desde: https://www.postgresql.org/download/windows/
   - Durante la instalación, recuerda la contraseña del usuario `postgres`

2. **PostgreSQL en el PATH**: Asegúrate de que `psql` esté disponible en tu terminal
   - Normalmente se instala en: `C:\Program Files\PostgreSQL\[version]\bin`

## Opción 1: Configuración Automática (Recomendado)

### Paso 1: Ejecutar el script automático

```bash
cd gestionMantenimiento
setup-db.bat
```

Cuando te pida la contraseña, ingresa la contraseña del usuario `postgres` que configuraste durante la instalación.

## Opción 2: Configuración Manual

### Paso 1: Abrir psql como usuario postgres

```bash
psql -U postgres
```

### Paso 2: Crear usuario y base de datos

```sql
-- Crear usuario
CREATE USER maintenance_user WITH PASSWORD 'Activa2025';

-- Crear base de datos
CREATE DATABASE maintenance_db WITH OWNER = maintenance_user ENCODING = 'UTF8';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE maintenance_db TO maintenance_user;

-- Salir
\q
```

### Paso 3: Crear el esquema de tablas

```bash
psql -U maintenance_user -d maintenance_db -f database_schema.sql
```

Cuando te pida la contraseña, ingresa: `Activa2025`

## Verificar la Instalación

### Verificar que la base de datos existe

```bash
psql -U postgres -c "\l" | findstr maintenance_db
```

### Verificar que las tablas se crearon

```bash
psql -U maintenance_user -d maintenance_db -c "\dt"
```

Deberías ver las siguientes tablas:
- users
- tasks
- task_notes
- task_attachments
- user_sessions
- audit_logs
- notifications

### Verificar usuarios por defecto

```bash
psql -U maintenance_user -d maintenance_db -c "SELECT email, name, role FROM users;"
```

## Credenciales del Sistema

### Base de Datos
- **Host**: localhost
- **Puerto**: 5432
- **Base de datos**: maintenance_db
- **Usuario**: maintenance_user
- **Contraseña**: Activa2025

### Usuarios de la Aplicación (por defecto)

| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@mantenimiento.com | admin123 | admin |
| supervisor@mantenimiento.com | admin123 | supervisor |
| operador@mantenimiento.com | admin123 | operator |

## Crear Usuario Personalizado

Si quieres crear tu propio usuario administrador:

```bash
node create-user.js jesuspichastor@hotmail.com "Jesús Pichastor" Activa2025 admin
```

## Solución de Problemas

### Error: "psql no se reconoce como comando"

Agrega PostgreSQL al PATH de Windows:
1. Busca "Variables de entorno" en Windows
2. Edita la variable PATH
3. Agrega: `C:\Program Files\PostgreSQL\[version]\bin`
4. Reinicia la terminal

### Error: "password authentication failed"

Verifica que estás usando la contraseña correcta:
- Para `postgres`: la que configuraste en la instalación
- Para `maintenance_user`: `Activa2025`

### Error: "database already exists"

Si la base de datos ya existe, puedes:
1. Eliminarla y recrearla:
```sql
DROP DATABASE maintenance_db;
CREATE DATABASE maintenance_db WITH OWNER = maintenance_user ENCODING = 'UTF8';
```

2. O simplemente ejecutar el esquema sobre la base existente:
```bash
psql -U maintenance_user -d maintenance_db -f database_schema.sql
```

### Resetear la Base de Datos

Si quieres empezar de cero:

```bash
# Conectarse como postgres
psql -U postgres

# Eliminar y recrear
DROP DATABASE IF EXISTS maintenance_db;
DROP USER IF EXISTS maintenance_user;
CREATE USER maintenance_user WITH PASSWORD 'Activa2025';
CREATE DATABASE maintenance_db WITH OWNER = maintenance_user ENCODING = 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE maintenance_db TO maintenance_user;
\q

# Crear esquema
psql -U maintenance_user -d maintenance_db -f database_schema.sql
```

## Siguiente Paso

Una vez configurada la base de datos, puedes iniciar la aplicación:

```bash
npm run dev
```

La aplicación estará disponible en:
- Backend: http://localhost:3000
- Frontend: http://localhost:3001
