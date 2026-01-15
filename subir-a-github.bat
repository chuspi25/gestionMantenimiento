@echo off
echo ========================================
echo   SUBIR PROYECTO A GITHUB
echo ========================================
echo.
echo Este script te ayudara a subir tu proyecto a GitHub
echo.
echo PASO 1: Asegurate de haber creado un repositorio en GitHub
echo         Ve a: https://github.com/new
echo.
echo PASO 2: Copia la URL de tu repositorio
echo         Ejemplo: https://github.com/tu-usuario/tu-repositorio.git
echo.
set /p REPO_URL="Pega aqui la URL de tu repositorio: "
echo.

if "%REPO_URL%"=="" (
    echo ERROR: No ingresaste ninguna URL
    pause
    exit /b 1
)

echo.
echo Verificando estado del repositorio...
git status
echo.

echo Agregando remote origin...
git remote add origin %REPO_URL% 2>nul
if errorlevel 1 (
    echo.
    echo El remote ya existe. Actualizando...
    git remote set-url origin %REPO_URL%
)

echo.
echo Verificando remote...
git remote -v
echo.

echo ========================================
echo   LISTO PARA SUBIR
echo ========================================
echo.
echo Se subiran 117 archivos con mas de 52,000 lineas de codigo
echo.
set /p CONFIRM="Deseas continuar? (S/N): "

if /i "%CONFIRM%"=="S" (
    echo.
    echo Subiendo codigo a GitHub...
    git push -u origin main
    
    if errorlevel 1 (
        echo.
        echo ========================================
        echo   ERROR AL SUBIR
        echo ========================================
        echo.
        echo Posibles soluciones:
        echo 1. Verifica tu autenticacion en GitHub
        echo 2. Usa un Personal Access Token en lugar de contrasena
        echo 3. Crea un token en: https://github.com/settings/tokens
        echo.
        echo Si el error es "failed to push some refs", intenta:
        echo    git pull origin main --rebase
        echo    git push -u origin main
        echo.
    ) else (
        echo.
        echo ========================================
        echo   EXITO!
        echo ========================================
        echo.
        echo Tu proyecto se ha subido correctamente a GitHub
        echo Puedes verlo en: %REPO_URL%
        echo.
    )
) else (
    echo.
    echo Operacion cancelada.
)

echo.
pause
