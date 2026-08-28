@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title InmoControl - SilvaCooperativa
cls

echo ===================================================================
echo               INMOCONTROL - SILVACOOPERATIVA
echo             Sistema de Gestión y Liquidación Inmobiliaria
echo ===================================================================
echo.

:: Agregar rutas estándar de Node.js al PATH por si acaso
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%APPDATA%\npm"

:: 1. Verificar si Node.js / NPM está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    if not exist "C:\Program Files\nodejs\node.exe" (
        goto AUTO_INSTALAR_NODE
    ) else (
        set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"
    )
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    goto AUTO_INSTALAR_NODE
)

goto VERIFICAR_DEPENDENCIAS

:AUTO_INSTALAR_NODE
echo [1/3] No se detectó Node.js / NPM en esta computadora.
echo       Descargando e instalando Node.js (LTS) automáticamente...
echo       (Por favor espere unos momentos mientras se completa la instalación...)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi'; ^
     $dest = [System.IO.Path]::Combine($env:TEMP, 'nodejs_installer.msi'); ^
     Write-Host '⬇️  Descargando instalador oficial de Node.js...' -ForegroundColor Cyan; ^
     [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
     (New-Object System.Net.WebClient).DownloadFile($url, $dest); ^
     Write-Host '⚙️  Instalando Node.js y NPM...' -ForegroundColor Yellow; ^
     Start-Process msiexec.exe -ArgumentList '/i', $dest, '/passive', '/norestart' -Wait; ^
     Remove-Item -Force $dest -ErrorAction SilentlyContinue"

:: Actualizar PATH en la sesión actual
set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"

where node >nul 2>nul
if %errorlevel% neq 0 (
    if not exist "C:\Program Files\nodejs\node.exe" (
        echo.
        echo [ERROR] No se pudo completar la instalación automática de Node.js.
        echo Por favor instálelo manualmente desde: https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
)
echo.
echo [OK] Node.js y NPM instalados y configurados correctamente.
echo.

:VERIFICAR_DEPENDENCIAS
:: 2. Verificar si falta instalar librerías del proyecto
if not exist "node_modules" goto INSTALAR_LIBRERIAS
goto ARRANCAR

:INSTALAR_LIBRERIAS
echo [2/3] Primera ejecución en este equipo. Descargando librerías del sistema...
echo       (Espere un momento, esto solo se hace la primera vez...)
echo.
call npm.cmd install --no-audit --no-fund --legacy-peer-deps
if errorlevel 1 (
    echo.
    echo [ERROR] Ocurrió un error al descargar las librerías.
    echo Verifique su conexión a internet y vuelva a intentar.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Optimizando archivos del sistema...
call npm.cmd run build
echo.

:ARRANCAR
echo [OK] Iniciando InmoControl...
echo.
echo ===================================================================
echo  La aplicación se abrirá en su navegador: http://localhost:5173/
echo  Para cerrar el sistema, simplemente cierre esta ventana.
echo ===================================================================
echo.

start "" http://localhost:5173/
call npm.cmd run dev

pause
