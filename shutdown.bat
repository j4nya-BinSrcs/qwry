@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

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

REM ---------------------------------------------------------------------
REM Kill processes by port
REM ---------------------------------------------------------------------
:kill_by_port
set "P=%~1"
for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%P% .*LISTENING"') do (
    if not "%%I"=="" (
        call :warn "Killing PID %%I on port %P%"
        taskkill /PID %%I /F >nul 2>&1
    )
)
exit /b 0

REM ---------------------------------------------------------------------
REM Kill lingering processes by image/command-line match
REM ---------------------------------------------------------------------
:kill_by_name
set "NAME=%~1"
set "FOUND=false"
for /f "tokens=2 delims=," %%I in ('wmic process where "CommandLine like '%%%NAME%%%'" get ProcessId^,CommandLine /format:csv 2^>nul ^| findstr /R /C:"[0-9]"') do (
    rem placeholder, real logic below via PowerShell for reliability
)
REM wmic CSV parsing is unreliable across locales; use PowerShell instead.
for /f "delims=" %%I in ('powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*%NAME%*' } | Select-Object -ExpandProperty ProcessId"') do (
    if not "%%I"=="" (
        call :warn "Killing %NAME% process: %%I"
        taskkill /PID %%I /F >nul 2>&1
        set "FOUND=true"
    )
)
exit /b 0

REM ---------------------------------------------------------------------
REM Docker teardown
REM ---------------------------------------------------------------------
:stop_docker
where docker >nul 2>&1
if errorlevel 1 exit /b 0

set "HASCONTAINER=false"
for /f "delims=" %%N in ('docker ps -a --format "{{.Names}}" 2^>nul') do (
    echo %%N | findstr /I "searxng" >nul && set "HASCONTAINER=true"
    echo %%N | findstr /I "valkey" >nul && set "HASCONTAINER=true"
)

if "%HASCONTAINER%"=="true" (
    call :info "Stopping SearXNG Docker containers ..."
    docker compose -f infra\docker-compose.yml --profile searxng down >nul 2>&1
)
exit /b 0

REM ---------------------------------------------------------------------
REM Main
REM ---------------------------------------------------------------------
:main

for %%P in (8000 8001 5173 6379 8080) do call :kill_by_port %%P

for %%N in (uvicorn vite indexer node) do call :kill_by_name %%N

call :stop_docker

call :info "All services stopped"
endlocal
exit /b 0
