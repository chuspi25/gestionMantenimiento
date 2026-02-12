@echo off
REM =====================================================
REM Script para configurar la base de datos en Windows
REM =====================================================

echo ========================================
echo Configuracion de Base de Datos
echo Sistema de Gestion de Mantenimiento
echo ========================================
echo.

echo Paso 1: Creando usuario y base de datos...
psql -U postgres -c "CREATE USER maintenance_user WITH PASSWORD 'Activa2025';" 2>nul
if %errorlevel% neq 0 (
    echo Usuario ya existe o error al crear
)

psql -U postgres -c "CREATE DATABASE maintenance_db WITH OWNER = maintenance_user ENCODING = 'UTF8';" 2>nul
if %errorlevel% neq 0 (
    echo Base de datos ya existe o error al crear
)

psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE maintenance_db TO maintenance_user;"

echo.
echo Paso 2: Creando esquema de tablas...
psql -U maintenance_user -d maintenance_db -f database_schema.sql

echo.
echo ========================================
echo Configuracion completada!
echo ========================================
echo.
echo Credenciales de la base de datos:
echo   Host: localhost
echo   Puerto: 5432
echo   Base de datos: maintenance_db
echo   Usuario: maintenance_user
echo   Contrasena: Activa2025
echo.
echo Usuarios por defecto creados:
echo   Admin: admin@mantenimiento.com / admin123
echo   Supervisor: supervisor@mantenimiento.com / admin123
echo   Operador: operador@mantenimiento.com / admin123
echo.
pause
