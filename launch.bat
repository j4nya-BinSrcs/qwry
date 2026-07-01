@echo off
cd /d "%~dp0"

setlocal enabledelayedexpansion

set "START_ALL=false"
set "START_SEARXNG=false"
set "START_ENGINE=false"
set "START_SERVER=true"

:parse_args
if "%~1"=="" goto :done_parse
if /i "%~1"=="--all" (
    set START_ALL=true
    shift
    goto :parse_args
)
if /i "%~1"=="--searxng" (
    set START_SEARXNG=true
    shift
    goto :parse_args
)
if /i "%~1"=="--engine" (
    set START_ENGINE=true
    shift
    goto :parse_args
)
if /i "%~1"=="--server" (
    set START_SERVER=true
    shift
    goto :parse_args
)
if /i "%~1"=="--help" goto :usage
if /i "%~1"=="-h" goto :usage
echo Unknown option: %~1
goto :usage

:done_parse
if "%START_ALL%"=="true" (
    set START_SEARXNG=true
    set START_ENGINE=true
    set START_SERVER=true
)

:: Python venv
if not exist server\.venv (
    echo Creating virtual environment...
    python -m venv server\.venv
    server\.venv\Scripts\pip install --quiet --upgrade pip
    server\.venv\Scripts\pip install --quiet -e server\
)

:: SearXNG
if "%START_SEARXNG%"=="true" (
    where docker >nul 2>&1
    if errorlevel 1 (
        echo Docker not found — skipping SearXNG
    ) else (
        echo Starting SearXNG via Docker Compose ...
        docker compose -f infra/docker-compose.yml --profile searxng up -d
    )
)

:: Rust engine
if "%START_ENGINE%"=="true" (
    if not exist engine\target\release\indexer.exe (
        echo Building Rust engine (release) ...
        cargo build --release --manifest-path engine\Cargo.toml --bin indexer
    )
    cd engine
    echo Starting Rust engine indexer on port 8001 ...
    start "qwry-engine" target\release\indexer.exe --index-dir .\data\index serve --port 8001
    cd ..
)

:: FastAPI server
if "%START_SERVER%"=="true" (
    if "%ENVIRONMENT%"=="" set ENVIRONMENT=development
    if "%HOST%"=="" set HOST=127.0.0.1
    if "%PORT%"=="" set PORT=8000
    echo Starting QWRY server on %HOST%:%PORT% (%ENVIRONMENT%)
    call server\.venv\Scripts\activate.bat
    uvicorn server.src.main:app --host %HOST% --port %PORT% --reload
)

endlocal
goto :eof

:usage
echo Usage: %~nx0 [--all^|--searxng^|--engine^|--server]
echo.
echo Options:
echo   --all         Start all services
echo   --searxng     Start SearXNG via Docker Compose
echo   --engine      Start the Rust indexer server
echo   --server      Start the FastAPI server ^(default^)
echo   --help        Show this help
echo.
echo Without options, only the FastAPI server starts.
endlocal
