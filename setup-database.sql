-- =====================================================
-- SCRIPT DE CONFIGURACIÓN INICIAL DE BASE DE DATOS
-- Sistema de Gestión de Mantenimiento
-- =====================================================

-- INSTRUCCIONES:
-- 1. Conectarse a PostgreSQL como superusuario (postgres)
-- 2. Ejecutar este script para crear la base de datos y usuario
-- 3. Luego ejecutar database_schema.sql para crear las tablas

-- =====================================================
-- CREAR BASE DE DATOS Y USUARIO
-- =====================================================

-- Crear usuario para la aplicación
CREATE USER maintenance_user WITH PASSWORD 'secure_password_2024';

-- Crear base de datos principal
CREATE DATABASE maintenance_db 
    WITH OWNER = maintenance_user
    ENCODING = 'UTF8'
    LC_COLLATE = 'es_ES.UTF-8'
    LC_CTYPE = 'es_ES.UTF-8'
    TEMPLATE = template0;

-- Crear base de datos de pruebas
CREATE DATABASE maintenance_test_db 
    WITH OWNER = maintenance_user
    ENCODING = 'UTF8'
    LC_COLLATE = 'es_ES.UTF-8'
    LC_CTYPE = 'es_ES.UTF-8'
    TEMPLATE = template0;

-- Otorgar permisos al usuario
GRANT ALL PRIVILEGES ON DATABASE maintenance_db TO maintenance_user;
GRANT ALL PRIVILEGES ON DATABASE maintenance_test_db TO maintenance_user;

-- Conectarse a la base de datos principal
\c maintenance_db;

-- Otorgar permisos en el esquema public
GRANT ALL ON SCHEMA public TO maintenance_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO maintenance_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO maintenance_user;

-- Configurar permisos por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO maintenance_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO maintenance_user;

-- Conectarse a la base de datos de pruebas
\c maintenance_test_db;

-- Otorgar permisos en el esquema public para BD de pruebas
GRANT ALL ON SCHEMA public TO maintenance_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO maintenance_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO maintenance_user;

-- Configurar permisos por defecto para objetos futuros en BD de pruebas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO maintenance_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO maintenance_user;

-- =====================================================
-- MENSAJE DE CONFIRMACIÓN
-- =====================================================

\echo '=============================================='
\echo 'CONFIGURACIÓN DE BASE DE DATOS COMPLETADA'
\echo '=============================================='
\echo 'Usuario creado: maintenance_user'
\echo 'Base de datos principal: maintenance_db'
\echo 'Base de datos de pruebas: maintenance_test_db'
\echo ''
\echo 'SIGUIENTE PASO:'
\echo 'Ejecutar database_schema.sql en maintenance_db'
\echo '=============================================='