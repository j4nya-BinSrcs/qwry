@echo off
cd /d "%~dp0"

if not exist server\.venv (
    echo Creating virtual environment...
    python -m venv server\.venv
    server\.venv\Scripts\pip install --upgrade pip
    server\.venv\Scripts\pip install -e server\
)

call server\.venv\Scripts\activate.bat

if "%ENVIRONMENT%"=="" set ENVIRONMENT=development
if "%HOST%"=="" set HOST=127.0.0.1
if "%PORT%"=="" set PORT=8000

echo Starting QWRY server on %HOST%:%PORT% (%ENVIRONMENT%)
uvicorn server.src.main:app --host %HOST% --port %PORT% --reload
