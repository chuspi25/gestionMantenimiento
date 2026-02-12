-- =====================================================
-- CONFIGURACIÓN COMPLETA DEL SISTEMA
-- =====================================================

-- Paso 1: Crear usuario para la aplicación
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'maintenance_user') THEN
        CREATE USER maintenance_user WITH PASSWORD 'secure_password_2024';
        RAISE NOTICE 'Usuario maintenance_user creado';
    ELSE
        RAISE NOTICE 'Usuario maintenance_user ya existe';
    END IF;
END
$$;

-- Paso 2: Crear base de datos principal
SELECT 'CREATE DATABASE maintenance_db WITH OWNER = maintenance_user ENCODING = ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'maintenance_db')\gexec

-- Otorgar permisos al usuario
GRANT ALL PRIVILEGES ON DATABASE maintenance_db TO maintenance_user;

-- Mensaje de confirmación
\echo 'Paso 1 completado: Base de datos y usuario creados'