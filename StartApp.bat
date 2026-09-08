@echo off
title Launching App...

echo Starting Backend Service...
start "FastAPI Backend" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate && uvicorn main:app --reload --port 8000"

echo Starting Frontend Service...
start "Frontend Dev" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser...
start http://localhost:3000

echo All services launched!
exit