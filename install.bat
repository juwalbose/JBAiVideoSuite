@echo off
title JBAiVideoSuite Installer
setlocal

echo ============================================
echo   JBAiVideoSuite - Installer
echo ============================================
echo.

:: --- Check Python ---
echo [1/6] Checking Python...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Install Python 3.12+ from https://python.org
    pause
    exit /b 1
)
for /f "tokens=2 delims=:" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo       Python found: %PYVER%

:: --- Check Node.js ---
echo [2/6] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=1" %%v in ('node --version') do set NODEVER=%%v
echo       Node.js found: %NODEVER%

:: --- Backend venv ---
echo [3/6] Setting up backend virtual environment...
cd /d "%~dp0backend"
if not exist .venv (
    echo       Creating venv...
    python -m venv .venv
) else (
    echo       venv already exists.
)
call .venv\Scripts\activate

echo       Installing Python dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
)

:: --- Prisma ---
echo [4/6] Setting up Prisma database...
echo       Generating Prisma client...
call .venv\Scripts\prisma generate
if %errorlevel% neq 0 (
    echo ERROR: prisma generate failed.
    pause
    exit /b 1
)

echo       Pushing database schema...
call .venv\Scripts\prisma db push
if %errorlevel% neq 0 (
    echo ERROR: prisma db push failed.
    pause
    exit /b 1
)

:: --- Frontend ---
echo [5/6] Setting up frontend...
cd /d "%~dp0frontend"
echo       Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

:: --- Done ---
echo [6/6] Installation complete!
echo.
echo ============================================
echo   Install successful!
echo ============================================
echo.
echo   To launch the app, double-click StartApp.bat
echo   or run:  StartApp.bat
echo.
echo   Backend:  http://127.0.0.1:8000
echo   Frontend: http://localhost:3000
echo.
pause
endlocal
