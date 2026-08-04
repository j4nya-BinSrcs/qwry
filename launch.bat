@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM ---------------------------------------------------------------------
REM Helpers
REM ---------------------------------------------------------------------
goto :main

:info
echo [INFO]  %~1
exit /b 0

:warn
echo [WARN]  %~1
exit /b 0

:error
echo [ERROR] %~1
exit /b 0

:cmdlog
echo [CMD]   %~1
exit /b 0

REM Kill whatever process is listening on %1 (TCP)
:kill_port
set "PORT_TO_KILL=%~1"
if "%PORT_TO_KILL%"=="" exit /b 0
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT_TO_KILL% .*LISTENING"') do (
    if not "%%P"=="" (
        call :warn "Port %PORT_TO_KILL% in use by PID %%P -- killing ..."
        taskkill /PID %%P /F >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)
exit /b 0

REM ---------------------------------------------------------------------
REM Usage
REM ---------------------------------------------------------------------
:usage
echo Usage:  %~nx0 [options]
echo.
echo Options:
echo   --all         Start all services (SearXNG + Rust engine + FastAPI + frontend)
echo   --searxng     Start SearXNG via Docker Compose
echo   --engine      Start the Rust indexer server on port 8001
echo   --server      Start the FastAPI server (default)
echo   --frontend    Start the Vite dev server for the frontend
echo   --help        Show this help
echo.
echo If no option is given, only the FastAPI server starts.
exit /b 0

REM ---------------------------------------------------------------------
REM Python / uvicorn
REM ---------------------------------------------------------------------
:ensure_python_env
if not exist "server\.venv\" (
    call :info "Creating Python virtual environment ..."
    python -m venv server\.venv
)
if not exist "server\.venv\Scripts\pip3.exe" (
    call :info "Installing pip in virtual environment ..."
    server\.venv\Scripts\python.exe -m ensurepip --upgrade
)
call :info "Installing / updating Python dependencies ..."
server\.venv\Scripts\pip3.exe install --quiet -e server\
exit /b 0

:start_server
call :ensure_python_env

if "%HOST%"=="" (set "SERVER_HOST=127.0.0.1") else (set "SERVER_HOST=%HOST%")
if "%PORT%"=="" (set "SERVER_PORT=8000") else (set "SERVER_PORT=%PORT%")
if "%ENVIRONMENT%"=="" (set "SERVER_ENV=development") else (set "SERVER_ENV=%ENVIRONMENT%")

call :kill_port "%SERVER_PORT%"
call :info "Starting FastAPI server on %SERVER_HOST%:%SERVER_PORT% (%SERVER_ENV%)"
start "launch_server" /min cmd /c "call server\.venv\Scripts\activate.bat && uvicorn server.src.main:app --host %SERVER_HOST% --port %SERVER_PORT% --reload"
exit /b 0

REM ---------------------------------------------------------------------
REM Rust engine indexer
REM ---------------------------------------------------------------------
:ensure_engine_bin
if not exist "engine\target\release\indexer.exe" (
    call :info "Building Rust engine (release) ..."
    cargo build --release --manifest-path engine\Cargo.toml --bin indexer
)
exit /b 0

:start_engine
call :ensure_engine_bin
if "%ENGINE_PORT%"=="" (set "ENGINE_PORT_USE=8001") else (set "ENGINE_PORT_USE=%ENGINE_PORT%")
call :kill_port "%ENGINE_PORT_USE%"
if "%INDEX_DIR%"=="" (set "INDEX_DIR_USE=.\data\index") else (set "INDEX_DIR_USE=%INDEX_DIR%")

call :info "Starting Rust engine indexer on port %ENGINE_PORT_USE%"
pushd engine
start "launch_engine" /min cmd /c "target\release\indexer.exe --index-dir "%INDEX_DIR_USE%" serve --port %ENGINE_PORT_USE%"
popd
exit /b 0

REM ---------------------------------------------------------------------
REM Frontend Vite dev server
REM ---------------------------------------------------------------------
:start_frontend
if "%FRONTEND_HOST%"=="" (set "FE_HOST=127.0.0.1") else (set "FE_HOST=%FRONTEND_HOST%")
if "%FRONTEND_PORT%"=="" (set "FE_PORT=5173") else (set "FE_PORT=%FRONTEND_PORT%")

call :kill_port "%FE_PORT%"
call :info "Starting Vite dev server on %FE_HOST%:%FE_PORT%"
pushd client
start "launch_frontend" /min cmd /c "npx vite --host %FE_HOST% --port %FE_PORT%"
popd
exit /b 0

REM ---------------------------------------------------------------------
REM SearXNG via Docker Compose
REM ---------------------------------------------------------------------
:start_searxng
where docker >nul 2>&1
if errorlevel 1 (
    call :error "Docker not found. Cannot start SearXNG."
    exit /b 1
)

if "%SEARXNG_PORT%"=="" (set "SEARXNG_PORT_USE=8080") else (set "SEARXNG_PORT_USE=%SEARXNG_PORT%")
call :kill_port "%SEARXNG_PORT_USE%"
call :kill_port "6379"

call :info "Starting SearXNG via Docker Compose ..."
docker compose -f infra\docker-compose.yml --profile searxng up -d
timeout /t 4 /nobreak >nul

curl -s -o NUL -w "" "http://127.0.0.1:%SEARXNG_PORT_USE%/" >nul 2>&1
if errorlevel 1 (
    call :warn "SearXNG may still be starting -- check logs: docker logs (container id)"
) else (
    call :info "SearXNG is running on http://127.0.0.1:%SEARXNG_PORT_USE%"
)
call :health_searxng
exit /b 0

:health_searxng
for /f "delims=" %%C in ('docker ps -q --filter "name=searxng" 2^>nul') do set "SEARXNG_CID=%%C"
if not "%SEARXNG_CID%"=="" (
    curl -s --max-time 5 "http://127.0.0.1:%SEARXNG_PORT_USE%/search?q=test&format=json" > "%TEMP%\searxng_health.json" 2>nul
    python -c "import sys,json;d=json.load(open(r'%TEMP%\searxng_health.json'));[print(f'  {e[0]}: {e[1]}') for e in d.get('unresponsive_engines', [])]" > "%TEMP%\searxng_engines.txt" 2>nul
    for %%S in ("%TEMP%\searxng_engines.txt") do set "ENGSIZE=%%~zS"
    if defined ENGSIZE if not "!ENGSIZE!"=="0" (
        call :warn "SearXNG upstream engines unreachable:"
        type "%TEMP%\searxng_engines.txt"
        call :warn "This is often a DNS/networking issue in the Docker container."
        call :warn "See logs: docker logs %SEARXNG_CID%"
    ) else (
        call :info "SearXNG upstream engines are responding"
    )
    del /q "%TEMP%\searxng_health.json" >nul 2>&1
    del /q "%TEMP%\searxng_engines.txt" >nul 2>&1
)
exit /b 0

REM ---------------------------------------------------------------------
REM Cleanup (invoked on Ctrl+C via choice /break, or at the end)
REM ---------------------------------------------------------------------
:cleanup
call :info "Shutting down services ..."
call :kill_by_title "launch_frontend"
call :kill_by_title "launch_server"
call :kill_by_title "launch_engine"
if "%START_SEARXNG%"=="true" (
    docker compose -f infra\docker-compose.yml down >nul 2>&1
)
call :info "All services stopped"
exit /b 0

:kill_by_title
taskkill /FI "WINDOWTITLE eq %~1*" /T /F >nul 2>&1
exit /b 0

REM ---------------------------------------------------------------------
REM Main
REM ---------------------------------------------------------------------
:main
set "START_ALL=false"
set "START_SEARXNG=false"
set "START_ENGINE=false"
set "START_SERVER=false"
set "START_FRONTEND=false"

if "%~1"=="" (
    set "START_SERVER=true"
) else (
    :parse_args
    if "%~1"=="" goto :after_parse
    if /I "%~1"=="--all"      set "START_ALL=true"
    if /I "%~1"=="--searxng"  set "START_SEARXNG=true"
    if /I "%~1"=="--engine"   set "START_ENGINE=true"
    if /I "%~1"=="--server"   set "START_SERVER=true"
    if /I "%~1"=="--frontend" set "START_FRONTEND=true"
    if /I "%~1"=="--help" (
        call :usage
        exit /b 0
    )
    if /I "%~1"=="-h" (
        call :usage
        exit /b 0
    )
    set "KNOWN=false"
    for %%O in (--all --searxng --engine --server --frontend --help -h) do (
        if /I "%~1"=="%%O" set "KNOWN=true"
    )
    if "!KNOWN!"=="false" (
        call :error "Unknown option: %~1"
        call :usage
        exit /b 1
    )
    shift
    goto :parse_args
)
:after_parse

if "%START_ALL%"=="true" (
    set "START_SEARXNG=true"
    set "START_ENGINE=true"
    set "START_SERVER=true"
    set "START_FRONTEND=true"
)

if "%START_SEARXNG%"=="true" call :start_searxng
if "%START_ENGINE%"=="true" call :start_engine
if "%START_SERVER%"=="true" call :start_server
if "%START_FRONTEND%"=="true" call :start_frontend

if "%START_SERVER%"=="true" (
    set "SHOULD_WAIT=true"
) else if "%START_FRONTEND%"=="true" (
    set "SHOULD_WAIT=true"
) else (
    set "SHOULD_WAIT=false"
)

if "%SHOULD_WAIT%"=="true" (
    call :info "Services running -- press Ctrl+C to stop, or close this window"
    if "%START_SEARXNG%"=="true" (
        for /f "delims=" %%C in ('docker ps -q --filter "name=searxng" 2^>nul') do set "SEARXNG_CONTAINER=%%C"
        if not "!SEARXNG_CONTAINER!"=="" (
            call :warn "Check SearXNG errors:  docker logs !SEARXNG_CONTAINER!"
        )
    )
    call :info "Stop everything:   shutdown.bat"
    REM Batch has no native trap/wait-for-children; pause keeps the window
    REM open and Ctrl+C below runs cleanup before exiting.
    pause >nul
)

call :cleanup
endlocal
exit /b 0
